import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	mock,
	test,
} from "bun:test"
import { BridgeDiagnosticError } from "@opsy/bridge-client"
import {
	ResourceDuplicateSlug,
	ResourceImportMissingProviderId,
	ResourceReservedSlug,
} from "@opsy/contracts/errors"
import { and, eq, isNull } from "drizzle-orm"
import { db } from "@/lib/db/client"
import { migrate } from "@/lib/db/migrate"
import {
	integrations,
	organization,
	type Project,
	projects,
	resources,
	user,
} from "@/lib/db/schema"
import * as operations from "@/operations"
import {
	clearTerraformRuntimeCacheForTest,
	setTerraformBridgeClientForTest,
	setTerraformProviderCatalogForTest,
} from "@/provider-runtime"
import { createSchemaBridgeForTest } from "@/test/fake-bridge"
import type { Actor } from "@/types"
import type { ImportResourceBody } from "../schemas"

mock.module("workflow/api", () => ({
	start: async () => ({ runId: `imp-test-${crypto.randomUUID()}` }),
}))

let importResourceStep: typeof import("../workflows/steps").importResource
let completeResourceOperation: typeof import("../workflows/steps").completeResourceOperation
let deleteResourceComplete: typeof import("../workflows/steps").deleteResourceComplete
let importResourceService: typeof import("../resources").importResource

let importCalls = 0
let importThrows: unknown = null

const fakeBridge = createSchemaBridgeForTest({
	providerSource: "fakecorp/fakep",
	resourceSchemas: {
		fakep_bucket: {
			version: 0,
			block: {
				attributes: {
					name: { type: "string", required: true },
					id: { type: "string", computed: true },
					arn: { type: "string", computed: true },
				},
			},
		},
	},
	overrides: {
		importResource: async (req: { type: string; provider_id: string }) => {
			importCalls++
			if (importThrows) throw importThrows
			return {
				imported_resources: [
					{
						type: req.type,
						state: {
							name: req.provider_id,
							id: req.provider_id,
							arn: `arn:aws:s3:::${req.provider_id}`,
						},
					},
				],
			}
		},
	},
})

async function makeActorProject(): Promise<{
	actor: Actor
	project: Project
}> {
	const suffix = crypto.randomUUID()
	const [u] = await db
		.insert(user)
		.values({ name: "Imp", email: `imp-${suffix}@example.com` })
		.returning()
	const [org] = await db
		.insert(organization)
		.values({
			name: `imp-org-${suffix}`,
			slug: `imp-${suffix.slice(0, 12)}`,
			createdAt: new Date(),
		})
		.returning()
	const actor: Actor = { type: "user", id: u!.id, orgId: org!.id }
	const [project] = await db
		.insert(projects)
		.values({
			orgId: org!.id,
			slug: `imp-proj-${suffix.slice(0, 12)}`,
			createdByType: actor.type,
			createdById: actor.id,
		})
		.returning()
	return { actor, project: project! }
}

async function makeIntegration(
	project: Project,
	actor: Actor,
): Promise<{ id: string }> {
	const [integration] = await db
		.insert(integrations)
		.values({
			projectId: project.id,
			provider: "fakep",
			providerSource: "fakecorp/fakep",
			providerVersion: "0.0.0",
			slug: "default",
			name: `fakep-${crypto.randomUUID().slice(0, 8)}`,
			isDefault: true,
			createdByType: actor.type,
			createdById: actor.id,
			config: {},
			credentials: {},
		})
		.returning()
	return { id: integration!.id }
}

async function makeImportOperationWithResource(
	actor: Actor,
	project: Project,
	body: ImportResourceBody,
	integrationId: string,
) {
	const integration = await db.query.integrations.findFirst({
		where: eq(integrations.id, integrationId),
	})
	return operations.createResourceWithOperation({
		actor,
		projectId: project.id,
		kind: "import",
		request: body,
		resource: {
			slug: body.slug,
			type: body.type,
			status: "importing",
			inputs: null,
			provider: integration!.provider,
			integrationId: integration!.id,
			metadata: {},
		},
	})
}

beforeAll(async () => {
	await migrate()
	setTerraformProviderCatalogForTest([
		{ name: "fakep", source: "fakecorp/fakep", versions: ["0.0.0"] },
	])
	setTerraformBridgeClientForTest(fakeBridge)
	;({
		importResource: importResourceStep,
		completeResourceOperation,
		deleteResourceComplete,
	} = await import("../workflows/steps"))
	;({ importResource: importResourceService } = await import("../resources"))
})

afterAll(() => {
	setTerraformBridgeClientForTest(null)
	setTerraformProviderCatalogForTest(null)
	clearTerraformRuntimeCacheForTest()
	mock.restore()
})

beforeEach(() => {
	clearTerraformRuntimeCacheForTest()
	importCalls = 0
	importThrows = null
})

describe("import → complete → forget round-trip (#14)", () => {
	test("atomic import sets identity, status=live, and normalized inputs", async () => {
		const { actor, project } = await makeActorProject()
		const integration = await makeIntegration(project, actor)
		const integrationRow = await db.query.integrations.findFirst({
			where: eq(integrations.id, integration.id),
		})
		const { resource: stub, operation: op } =
			await makeImportOperationWithResource(
				actor,
				project,
				{
					slug: "vpc-prod",
					type: "fakep_bucket",
					providerId: "vpc-prod",
				},
				integration.id,
			)
		expect(stub.identity).toBeNull()
		expect(stub.inputs).toBeNull()
		expect(stub.status).toBe("importing")
		expect(op.lockKey).toBe(`resource:${stub.id}`)

		const applied = await importResourceStep(op, stub, integrationRow!)
		const { resource: live } = await completeResourceOperation(
			op,
			{ resourceId: stub.id },
			{
				status: "live",
				inputs: applied.inputs,
				identity: applied.state,
				outputs: applied.state,
			},
		)

		expect(live.identity).toEqual({
			name: "vpc-prod",
			id: "vpc-prod",
			arn: "arn:aws:s3:::vpc-prod",
		})
		expect(live.outputs).toEqual({
			name: "vpc-prod",
			id: "vpc-prod",
			arn: "arn:aws:s3:::vpc-prod",
		})
		expect(live.status).toBe("live")
		expect(live.inputs).toEqual({ name: "vpc-prod" })
		expect(live.identity !== null).toBe(true)
		expect(importCalls).toBe(1)
	})

	test("forget soft-deletes without a second provider call and frees the slug", async () => {
		const { actor, project } = await makeActorProject()
		const integration = await makeIntegration(project, actor)
		const integrationRow = await db.query.integrations.findFirst({
			where: eq(integrations.id, integration.id),
		})
		const { resource: stub, operation: op } =
			await makeImportOperationWithResource(
				actor,
				project,
				{
					slug: "bucket-a",
					type: "fakep_bucket",
					providerId: "bucket-a",
				},
				integration.id,
			)
		const applied = await importResourceStep(op, stub, integrationRow!)
		const { resource: live } = await completeResourceOperation(
			op,
			{ resourceId: stub.id },
			{
				status: "live",
				inputs: applied.inputs,
				identity: applied.state,
				outputs: applied.state,
			},
		)
		expect(importCalls).toBe(1)

		// Forget op acts on the existing live row.
		const forgetOp = await operations.createOperation({
			actor,
			projectId: project.id,
			resourceId: live.id,
			kind: "delete",
			lockKey: `resource:${live.id}`,
			request: { slug: live.slug, mode: "forget" },
		})
		const { resource: forgotten } = await deleteResourceComplete(forgetOp, live)
		expect(forgotten.deletedAt).not.toBeNull()
		expect(importCalls).toBe(1)
		expect(forgotten.identity).toEqual(live.identity)

		const { resource: restub } = await makeImportOperationWithResource(
			actor,
			project,
			{
				slug: "bucket-a",
				type: "fakep_bucket",
				providerId: "bucket-a",
			},
			integration.id,
		)
		expect(restub.slug).toBe("bucket-a")
		expect(restub.id).not.toBe(stub.id)
	})

	test("an import the provider cannot find raises ResourceImportMissingProviderId", async () => {
		const { actor, project } = await makeActorProject()
		const integration = await makeIntegration(project, actor)
		const integrationRow = await db.query.integrations.findFirst({
			where: eq(integrations.id, integration.id),
		})
		const { resource: stub, operation: op } =
			await makeImportOperationWithResource(
				actor,
				project,
				{
					slug: "ghost",
					type: "fakep_bucket",
					providerId: "ghost",
				},
				integration.id,
			)
		importThrows = new BridgeDiagnosticError([
			{
				severity: "error",
				summary: "Cannot import non-existent remote object",
				detail: "resource ghost does not exist",
			},
		])

		await expect(
			importResourceStep(op, stub, integrationRow!),
		).rejects.toBeInstanceOf(ResourceImportMissingProviderId)
	})
})

describe("importResource service guards (pre-workflow)", () => {
	test("rejects the reserved 'data' slug", async () => {
		const { actor, project } = await makeActorProject()
		await makeIntegration(project, actor)
		await expect(
			importResourceService(actor, project, {
				slug: "data",
				type: "fakep_bucket",
				providerId: "x",
			}),
		).rejects.toBeInstanceOf(ResourceReservedSlug)
	})

	test("rejects a slug already taken by an active resource", async () => {
		const { actor, project } = await makeActorProject()
		const integration = await makeIntegration(project, actor)
		await db.insert(resources).values({
			projectId: project.id,
			slug: "dup",
			type: "fakep_bucket",
			identity: { id: "dup" },
			status: "live",
			provider: "fakep",
			integrationId: integration.id,
			createdByType: actor.type,
			createdById: actor.id,
		})

		await expect(
			importResourceService(actor, project, {
				slug: "dup",
				type: "fakep_bucket",
				providerId: "dup",
			}),
		).rejects.toBeInstanceOf(ResourceDuplicateSlug)
	})

	test("allows a slug whose only occupant is soft-deleted", async () => {
		const { actor, project } = await makeActorProject()
		const integration = await makeIntegration(project, actor)
		await db.insert(resources).values({
			projectId: project.id,
			slug: "recycled",
			type: "fakep_bucket",
			identity: { id: "recycled" },
			status: "live",
			provider: "fakep",
			integrationId: integration.id,
			deletedAt: new Date(),
			createdByType: actor.type,
			createdById: actor.id,
		})

		const result = await importResourceService(actor, project, {
			slug: "recycled",
			type: "fakep_bucket",
			providerId: "recycled",
		})
		expect(result.operation.kind).toBe("import")
		expect(result.operation.projectId).toBe(project.id)

		const liveBySlug = await db.query.resources.findMany({
			where: and(
				eq(resources.projectId, project.id),
				eq(resources.slug, "recycled"),
				isNull(resources.deletedAt),
			),
		})
		// Atomic create: a fresh stub now exists in `importing` status from the
		// service call (the soft-deleted occupant doesn't block since the partial
		// unique index skips it).
		expect(liveBySlug).toHaveLength(1)
		expect(liveBySlug[0]!.status).toBe("importing")
	})
})
