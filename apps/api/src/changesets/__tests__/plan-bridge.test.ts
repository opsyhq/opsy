import { BridgeDiagnosticError } from "@opsy/bridge-client"
import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	mock,
	test,
} from "bun:test"
import { db } from "@/lib/db/client"
import { migrate } from "@/lib/db/migrate"
import {
	type ChangeSetItem,
	changeSetItems,
	changeSets,
	integrations,
	organization,
	type Project,
	projects,
	resourceDryRuns,
	user,
} from "@/lib/db/schema"
import {
	clearTerraformRuntimeCacheForTest,
	setTerraformBridgeClientForTest,
	setTerraformProviderCatalogForTest,
} from "@/provider-runtime"
import { createSchemaBridgeForTest } from "@/test/fake-bridge"
import type { Actor } from "@/types"
import { planResourceDryRun } from "../workflows/steps"

// The bridge-call success path is exercised end-to-end via the workflow
// integration tests. Here we pin the pure precondition branches of planResourceDryRun
// that produce "noop" / "deferred" without ever reaching the provider runtime.

mock.module("workflow/api", () => ({
	start: async () => ({ runId: `cs-bridge-${crypto.randomUUID()}` }),
	getRun: async () => null,
}))

// Drives the import-probe branch: the dry-run reads import state through the
// provider runtime, so the fake bridge decides whether the target "exists".
let importFound = true

const bridge = createSchemaBridgeForTest({
	providerSource: "fakecorp/fakep",
	resourceSchemas: {
		fakep_bucket: {
			version: 0,
			block: {
				attributes: {
					name: { type: "string", required: true },
					id: { type: "string", computed: true },
				},
			},
		},
	},
	overrides: {
		importResource: async () => {
			if (!importFound) {
				throw new BridgeDiagnosticError([
					{
						severity: "error",
						summary: "Cannot import non-existent remote object",
						detail: "the resource was not found",
					},
				])
			}
			return {
				imported_resources: [
					{ type_name: "fakep_bucket", state: { name: "adopted", id: "bucket-1" } },
				],
			}
		},
	},
})

async function makeProject(): Promise<{ actor: Actor; project: Project }> {
	const suffix = crypto.randomUUID()
	const [u] = await db
		.insert(user)
		.values({ name: "Bridge Test", email: `bridge-${suffix}@example.com` })
		.returning()
	const [org] = await db
		.insert(organization)
		.values({
			name: `bridge-org-${suffix}`,
			slug: `b-${suffix.slice(0, 12)}`,
			createdAt: new Date(),
		})
		.returning()
	const actor: Actor = { type: "user", id: u!.id, orgId: org!.id }
	const [project] = await db
		.insert(projects)
		.values({
			orgId: org!.id,
			slug: `b-proj-${suffix.slice(0, 12)}`,
			createdByType: actor.type,
			createdById: actor.id,
		})
		.returning()
	return { actor, project: project! }
}

async function stageRawItem(
	actor: Actor,
	project: Project,
	kind: ChangeSetItem["kind"],
	changes: unknown,
	targetSlug: string | null = null,
	integrationId: string | null = null,
): Promise<ChangeSetItem> {
	const [cs] = await db
		.insert(changeSets)
		.values({
			projectId: project.id,
			status: "draft",
			actorType: actor.type,
			actorId: actor.id,
		})
		.returning()
	const [item] = await db
		.insert(changeSetItems)
		.values({
			changeSetId: cs!.id,
			kind,
			targetResourceSlug: targetSlug,
			integrationId,
			changes: changes as ChangeSetItem["changes"],
		})
		.returning()
	await db.insert(resourceDryRuns).values({
		changeSetItemId: item!.id,
		action: "pending",
	})
	return item!
}

async function makeIntegration(
	actor: Actor,
	project: Project,
): Promise<string> {
	const [integration] = await db
		.insert(integrations)
		.values({
			projectId: project.id,
			provider: "fakep",
			providerSource: "fakecorp/fakep",
			providerVersion: "0.0.0",
			slug: "default",
			name: `fakep-${crypto.randomUUID().slice(0, 8)}`,
			createdByType: actor.type,
			createdById: actor.id,
			config: {},
			credentials: {},
		})
		.returning()
	return integration!.id
}

beforeAll(async () => {
	await migrate()
	setTerraformProviderCatalogForTest([
		{ name: "fakep", source: "fakecorp/fakep", versions: ["0.0.0"] },
	])
	setTerraformBridgeClientForTest(bridge)
})

afterAll(() => {
	setTerraformBridgeClientForTest(null)
	setTerraformProviderCatalogForTest(null)
	clearTerraformRuntimeCacheForTest()
	mock.restore()
})

beforeEach(() => {
	clearTerraformRuntimeCacheForTest()
	importFound = true
})

describe("planResourceDryRun precondition branches", () => {
	test("import_resource with no integration resolved → deferred", async () => {
		const { actor, project } = await makeProject()
		const item = await stageRawItem(actor, project, "import_resource", {
			slug: "adopted",
			type: "fakep_bucket",
			providerId: "bucket-1",
		})
		const outcome = await planResourceDryRun(item, project.id, null)
		expect(outcome.action).toBe("deferred")
		expect(outcome.error?.message).toMatch(/no integration resolved/)
	})

	test("import_resource whose target exists → noop", async () => {
		const { actor, project } = await makeProject()
		const integrationId = await makeIntegration(actor, project)
		const item = await stageRawItem(
			actor,
			project,
			"import_resource",
			{ slug: "adopted", type: "fakep_bucket", providerId: "bucket-1" },
			null,
			integrationId,
		)
		const outcome = await planResourceDryRun(item, project.id, null)
		expect(outcome.action).toBe("noop")
		expect(outcome.priorState).toBeNull()
		expect(outcome.plannedState).toBeNull()
		expect(outcome.requiresReplace).toEqual([])
		expect(outcome.error).toBeNull()
	})

	test("import_resource whose target is missing → error (blocks the deploy)", async () => {
		const { actor, project } = await makeProject()
		const integrationId = await makeIntegration(actor, project)
		importFound = false
		const item = await stageRawItem(
			actor,
			project,
			"import_resource",
			{ slug: "adopted", type: "fakep_bucket", providerId: "bucket-1" },
			null,
			integrationId,
		)
		const outcome = await planResourceDryRun(item, project.id, null)
		expect(outcome.action).toBe("error")
		// Surfaces the provider's not-found diagnostic so the dry-run review shows
		// the real reason the import can't proceed.
		expect(outcome.error?.message).toMatch(/non-existent remote object/i)
	})

	test("create_resource with no type field → noop (empty placeholder)", async () => {
		const { actor, project } = await makeProject()
		const item = await stageRawItem(actor, project, "create_resource", {
			slug: "placeholder",
		})
		const outcome = await planResourceDryRun(item, project.id, null)
		expect(outcome.action).toBe("noop")
	})

	test("create_resource with no integration resolved → deferred with explanatory error", async () => {
		const { actor, project } = await makeProject()
		const item = await stageRawItem(actor, project, "create_resource", {
			slug: "no-int",
			type: "fakep_bucket",
			inputs: { name: "no-int" },
		})
		// integrationId stays null when no integration matches the provider.
		const outcome = await planResourceDryRun(item, project.id, null)
		expect(outcome.action).toBe("deferred")
		expect(outcome.error?.message).toMatch(/no integration resolved/)
	})

	test("update_resource with no live target → deferred", async () => {
		const { actor, project } = await makeProject()
		const item = await stageRawItem(
			actor,
			project,
			"update_resource",
			{ inputs: { name: "x" } },
			"missing",
		)
		const outcome = await planResourceDryRun(item, project.id, null)
		expect(outcome.action).toBe("deferred")
		expect(outcome.error?.message).toMatch(/not found/)
	})

	test("delete_resource with no live target → deferred", async () => {
		const { actor, project } = await makeProject()
		const item = await stageRawItem(
			actor,
			project,
			"delete_resource",
			{ mode: "delete" },
			"missing-del",
		)
		const outcome = await planResourceDryRun(item, project.id, null)
		expect(outcome.action).toBe("deferred")
		expect(outcome.error?.message).toMatch(/not found/)
	})
})
