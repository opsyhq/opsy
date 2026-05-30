import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	mock,
	test,
} from "bun:test"
import { eq } from "drizzle-orm"
import { db } from "@/lib/db/client"
import { migrate } from "@/lib/db/migrate"
import {
	integrations,
	operations,
	organization,
	type Project,
	projects,
	resources,
	user,
} from "@/lib/db/schema"
import {
	clearTerraformRuntimeCacheForTest,
	setTerraformBridgeClientForTest,
	setTerraformProviderCatalogForTest,
} from "@/provider-runtime"
import { createSchemaBridgeForTest } from "@/test/fake-bridge"
import type { Actor } from "@/types"

// Direct-resource dry-run endpoints. The dry-run helpers (dryRunCreate,
// dryRunUpdate, dryRunDelete) are pure: they hit the bridge, never write an
// operation row, never start a workflow. The mutation paths (createResource
// etc) never invoke them anymore — dry-run is a separate route.

let workflowStartCount = 0
mock.module("workflow/api", () => ({
	start: async () => {
		workflowStartCount++
		return { runId: `dry-run-${crypto.randomUUID()}` }
	},
	getRun: async () => null,
}))

let requiresReplaceFromPlan: string[][] = []

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
		readResource: async (req: { current_state: unknown }) => ({
			new_state: req.current_state,
		}),
		planResource: async (req: { config: unknown }) => ({
			planned_state: req.config,
			planned_private: null,
			requires_replace: requiresReplaceFromPlan,
		}),
	},
})

let resourcesApi: typeof import("../resources")

async function makeFixture(): Promise<{
	actor: Actor
	project: Project
	bucket: { id: string; slug: string }
}> {
	const suffix = crypto.randomUUID()
	const [u] = await db
		.insert(user)
		.values({ name: "Dry", email: `dry-${suffix}@example.com` })
		.returning()
	const [org] = await db
		.insert(organization)
		.values({
			name: `dry-org-${suffix}`,
			slug: `d-${suffix.slice(0, 12)}`,
			createdAt: new Date(),
		})
		.returning()
	const actor: Actor = { type: "user", id: u!.id, orgId: org!.id }
	const [project] = await db
		.insert(projects)
		.values({
			orgId: org!.id,
			slug: `d-proj-${suffix.slice(0, 12)}`,
			createdByType: actor.type,
			createdById: actor.id,
		})
		.returning()
	const [integration] = await db
		.insert(integrations)
		.values({
			projectId: project!.id,
			provider: "fakep",
			providerSource: "fakecorp/fakep",
			providerVersion: "0.0.0",
			slug: "default",
			name: `fakep-${suffix.slice(0, 8)}`,
			createdByType: actor.type,
			createdById: actor.id,
			config: {},
			credentials: {},
		})
		.returning()
	const [bucket] = await db
		.insert(resources)
		.values({
			projectId: project!.id,
			slug: "db",
			type: "fakep_bucket",
			inputs: { name: "db" },
			identity: { id: "db-1" },
			status: "live",
			provider: "fakep",
			integrationId: integration!.id,
			createdByType: actor.type,
			createdById: actor.id,
		})
		.returning()
	return {
		actor,
		project: project!,
		bucket: { id: bucket!.id, slug: bucket!.slug },
	}
}

beforeAll(async () => {
	await migrate()
	setTerraformProviderCatalogForTest([
		{ name: "fakep", source: "fakecorp/fakep", versions: ["0.0.0"] },
	])
	setTerraformBridgeClientForTest(bridge)
	resourcesApi = await import("../resources")
})

afterAll(() => {
	setTerraformBridgeClientForTest(null)
	setTerraformProviderCatalogForTest(null)
	clearTerraformRuntimeCacheForTest()
	mock.restore()
})

beforeEach(() => {
	clearTerraformRuntimeCacheForTest()
	workflowStartCount = 0
	requiresReplaceFromPlan = []
})

describe("direct-resource dry-run endpoints", () => {
	test("dryRunUpdate returns a plan and writes nothing", async () => {
		const { project, bucket } = await makeFixture()
		const resource = await db.query.resources.findFirst({
			where: eq(resources.id, bucket.id),
		})
		const plan = await resourcesApi.planUpdateResource(project, resource!, {
			inputs: { name: "renamed" },
		})
		expect(plan.plannedState).toEqual({ name: "renamed" })
		expect(plan.requiresReplace).toEqual([])
		const ops = await db.query.operations.findMany({
			where: eq(operations.projectId, project.id),
		})
		expect(ops).toHaveLength(0)
		expect(workflowStartCount).toBe(0)
	})

	test("dryRunUpdate surfaces requiresReplace from the bridge", async () => {
		const { project, bucket } = await makeFixture()
		const resource = await db.query.resources.findFirst({
			where: eq(resources.id, bucket.id),
		})
		requiresReplaceFromPlan = [["name"]]
		const plan = await resourcesApi.planUpdateResource(project, resource!, {
			inputs: { name: "renamed" },
		})
		expect(plan.requiresReplace).toEqual([["name"]])
	})

	test("updateResource always proceeds — no replace gate", async () => {
		const { actor, project, bucket } = await makeFixture()
		const resource = await db.query.resources.findFirst({
			where: eq(resources.id, bucket.id),
		})
		requiresReplaceFromPlan = [["name"]]
		const result = await resourcesApi.updateResource(
			actor,
			project,
			resource!,
			{ inputs: { name: "renamed" } },
		)
		expect("operation" in result).toBe(true)
		expect(workflowStartCount).toBe(1)
		const ops = await db.query.operations.findMany({
			where: eq(operations.projectId, project.id),
		})
		expect(ops).toHaveLength(1)
		expect(ops[0]?.kind).toBe("update")
	})

	test("dryRunDelete on a never-applied resource is a bridge-free noop", async () => {
		const { actor, project } = await makeFixture()
		// Never applied: type is set but identity is null, so there's no live
		// cloud object to plan a delete against.
		const [stub] = await db
			.insert(resources)
			.values({
				projectId: project.id,
				slug: "stub",
				type: "fakep_bucket",
				status: "creating",
				createdByType: actor.type,
				createdById: actor.id,
			})
			.returning()
		const plan = await resourcesApi.planDeleteResource(project, stub!)
		expect(plan.priorState).toBeNull()
		expect(plan.plannedState).toBeNull()
		expect(plan.requiresReplace).toEqual([])
	})

	test("dryRunDelete on a live resource asks the bridge", async () => {
		const { project, bucket } = await makeFixture()
		const resource = await db.query.resources.findFirst({
			where: eq(resources.id, bucket.id),
		})
		const plan = await resourcesApi.planDeleteResource(project, resource!)
		expect(plan.plannedState).toBeNull()
	})
})
