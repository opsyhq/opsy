import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	mock,
	test,
} from "bun:test"
import type { State } from "@opsy/provider"
import { and, eq, sql } from "drizzle-orm"
import { db } from "@/lib/db/client"
import { migrate } from "@/lib/db/migrate"
import {
	integrations,
	operations as operationsTable,
	organization,
	type Project,
	projects,
	type Resource,
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

let startWorkflow = async () => ({
	runId: `scan-test-${crypto.randomUUID()}`,
})

mock.module("workflow/api", () => ({
	start: () => startWorkflow(),
}))

let scan: typeof import("../projects").startProjectScan
let tick: typeof import("../projects").runScanLoopTick
let scanProjectWorkflow: typeof import("../workflows/index").scanProjectWorkflow
let getNextScanResources: typeof import("../workflows/steps").getNextScanResources
let getScanResourceIntegrationGroups: typeof import("../workflows/steps").getScanResourceIntegrationGroups

type ReadFn = (
	state: State,
	req: { type: string; current_state: unknown | null },
) => Promise<{ state: State | null }>

let nextRead: ReadFn = async () => {
	throw new Error("test did not configure nextRead")
}

const fakeBridge = createSchemaBridgeForTest({
	providerSource: "fakecorp/fakep",
	resourceSchemas: {
		fakep_bucket: {
			version: 0,
			block: {
				attributes: {
					id: { type: "string", optional: true, computed: true },
					name: { type: "string", optional: true },
				},
			},
		},
	},
	overrides: {
		readResource: async (req: {
			type: string
			current_state: unknown | null
		}) => {
			const { state } = await nextRead((req.current_state ?? {}) as State, req)
			return { new_state: state }
		},
	},
})

async function makeOrgAndUser(): Promise<{ orgId: string; actor: Actor }> {
	const suffix = crypto.randomUUID()
	const [u] = await db
		.insert(user)
		.values({ name: "Scan Test", email: `scan-${suffix}@example.com` })
		.returning()
	const [org] = await db
		.insert(organization)
		.values({
			name: `scan-org-${suffix}`,
			slug: `scan-org-${suffix.slice(0, 12)}`,
			createdAt: new Date(),
		})
		.returning()
	return { orgId: org!.id, actor: { type: "user", id: u!.id, orgId: org!.id } }
}

async function makeProject(
	orgId: string,
	actor: Actor,
	options: { scanInterval?: Project["scanInterval"] } = {},
): Promise<Project> {
	const [project] = await db
		.insert(projects)
		.values({
			orgId,
			slug: `scan-proj-${crypto.randomUUID().slice(0, 12)}`,
			scanInterval: options.scanInterval ?? "off",
			createdByType: actor.type,
			createdById: actor.id,
		})
		.returning()
	return project!
}

async function makeIntegration(
	projectId: string,
	actor: Actor,
	slug = "default",
): Promise<{ integrationId: string }> {
	const [integration] = await db
		.insert(integrations)
		.values({
			projectId,
			provider: "fakep",
			providerSource: "fakecorp/fakep",
			providerVersion: "0.0.0",
			slug,
			name: `fakep-${slug}-${crypto.randomUUID().slice(0, 8)}`,
			createdByType: actor.type,
			createdById: actor.id,
			config: {},
			credentials: {},
		})
		.returning()
	return { integrationId: integration!.id }
}

// An applied managed resource: `identity` set (the read handle the fake
// bridge echoes back as `current_state`), `inputs` the declared mirror.
async function insertResource(args: {
	projectId: string
	integrationId: string | null
	actor: Actor
	slug: string
	inputs?: Record<string, unknown> | null
	identity?: Record<string, unknown> | null
	status?: Resource["status"]
	createdAt?: Date
}): Promise<Resource> {
	const inputs = args.inputs === undefined ? { name: args.slug } : args.inputs
	// A scannable resource has been applied/read, so its `outputs` mirror the
	// `identity` cloud-state handle (apply/import writes both from the same applied
	// state). The §H absorb no-op gate compares the read against `outputs`, so a
	// fixture that left `outputs` null would absorb on its first identical read.
	const identity =
		args.identity === undefined
			? { id: args.slug, name: args.slug }
			: args.identity
	const status = args.status ?? (identity ? "live" : "creating")
	const [row] = await db
		.insert(resources)
		.values({
			projectId: args.projectId,
			slug: args.slug,
			type: "fakep_bucket",
			inputs,
			identity,
			outputs: identity,
			status,
			provider: args.integrationId ? "fakep" : null,
			integrationId: args.integrationId,
			createdAt: args.createdAt ?? new Date(Date.now() - 1000),
			createdByType: args.actor.type,
			createdById: args.actor.id,
		})
		.returning()
	return row!
}

async function makeScanOperation(actor: Actor, project: Project) {
	return operations.createOperation({
		actor,
		projectId: project.id,
		kind: "scan",
		lockKey: `scan:${project.id}`,
		request: {},
	})
}

beforeAll(async () => {
	await migrate()
	setTerraformProviderCatalogForTest([
		{ name: "fakep", source: "fakecorp/fakep", versions: ["0.0.0"] },
	])
	setTerraformBridgeClientForTest(fakeBridge)
	;({ startProjectScan: scan, runScanLoopTick: tick } = await import("../projects"))
	;({ scanProjectWorkflow } = await import("../workflows/index"))
	;({ getNextScanResources, getScanResourceIntegrationGroups } = await import(
		"../workflows/steps"
	))
})

afterAll(() => {
	setTerraformBridgeClientForTest(null)
	setTerraformProviderCatalogForTest(null)
	clearTerraformRuntimeCacheForTest()
})

beforeEach(() => {
	clearTerraformRuntimeCacheForTest()
	startWorkflow = async () => ({
		runId: `scan-test-${crypto.randomUUID()}`,
	})
	nextRead = async () => {
		throw new Error("test did not configure nextRead")
	}
})

describe("scan", () => {
	test("manual scan creates one scan operation with no scan runs or child read operations", async () => {
		const { orgId, actor } = await makeOrgAndUser()
		const project = await makeProject(orgId, actor)

		const result = await scan(actor, project)

		expect(result.operation.kind).toBe("scan")
		expect(result.operation.projectId).toBe(project.id)
		expect(result.operation.actorType).toBe("user")
		expect(result.operation.actorId).toBe(actor.id)
		expect(result.operation.lockKey).toBe(`scan:${project.id}`)

		const projectOperations = await db.query.operations.findMany({
			where: eq(operationsTable.projectId, project.id),
		})
		expect(projectOperations).toHaveLength(1)
		expect(projectOperations[0]!.kind).toBe("scan")
		expect(
			projectOperations.some((operation) => operation.kind === "read"),
		).toBe(false)

		const scanRuns = await db.execute(
			sql<{
				tableName: string | null
			}>`select to_regclass('public.scan_runs')::text as "tableName"`,
		)
		expect(scanRuns[0]?.tableName ?? null).toBeNull()

		const updatedProject = await db.query.projects.findFirst({
			where: eq(projects.id, project.id),
		})
		expect(updatedProject!.lastScanClaimedAt).not.toBeNull()
	})

	test("scheduled scan creates the same scan operation kind", async () => {
		const { orgId, actor } = await makeOrgAndUser()
		const project = await makeProject(orgId, actor, { scanInterval: "hourly" })

		await tick()

		const projectOperations = await db.query.operations.findMany({
			where: eq(operationsTable.projectId, project.id),
		})
		expect(projectOperations).toHaveLength(1)
		expect(projectOperations[0]!.kind).toBe("scan")
		expect(projectOperations[0]!.lockKey).toBe(`scan:${project.id}`)
		expect(projectOperations[0]!.actorType).toBe("system")
	})

	test("marks the scan operation failed if the workflow cannot start", async () => {
		const { orgId, actor } = await makeOrgAndUser()
		const project = await makeProject(orgId, actor)
		startWorkflow = async () => {
			throw new Error("workflow unavailable")
		}

		await expect(scan(actor, project)).rejects.toThrow("workflow unavailable")

		const failed = await db.query.operations.findMany({
			where: and(
				eq(operationsTable.projectId, project.id),
				eq(operationsTable.kind, "scan"),
			),
		})
		expect(failed).toHaveLength(1)
		expect(failed[0]!.status).toBe("failed")
		expect(failed[0]!.closedAt).not.toBeNull()
		expect(failed[0]!.error).toMatchObject({
			message: "workflow unavailable",
			code: "Error",
		})
	})

	test("walks 25-resource windows, groups integrations, and reads each resource individually", async () => {
		const { actor } = await makeOrgAndUser()
		const project = await makeProject(actor.orgId, actor)
		const defaultIntegration = await makeIntegration(project.id, actor)
		const westIntegration = await makeIntegration(project.id, actor, "west")
		for (let index = 0; index < 26; index++) {
			await insertResource({
				projectId: project.id,
				integrationId:
					index % 2 === 0
						? defaultIntegration.integrationId
						: westIntegration.integrationId,
				actor,
				slug: `bucket-${index}`,
			})
		}
		const reads: string[] = []
		nextRead = async (state) => {
			reads.push(String(state.id))
			return { state }
		}

		const operation = await makeScanOperation(actor, project)
		const firstWindow = await getNextScanResources(operation, null, 25)
		expect(firstWindow.resources).toHaveLength(25)
		expect(firstWindow.skippedInflight).toBe(0)
		const groups = await getScanResourceIntegrationGroups(
			operation,
			firstWindow.resources,
		)
		expect(groups.failedResources).toHaveLength(0)
		expect(groups.groups).toHaveLength(2)
		expect(groups.groups.every((group) => group.resources.length > 0)).toBe(
			true,
		)

		const secondWindow = await getNextScanResources(
			operation,
			firstWindow.lastSeenResourceId,
			25,
		)
		expect(secondWindow.resources).toHaveLength(1)

		const result = await scanProjectWorkflow(operation)

		expect(result).toEqual({
			totalResources: 26,
			scanned: 26,
			unchanged: 26,
			absorbed: 0,
			missing: 0,
			failed: 0,
			skippedInflight: 0,
			skippedDuringRun: 0,
		})
		expect(reads).toHaveLength(26)

		const readOperations = await db.query.operations.findMany({
			where: and(
				eq(operationsTable.projectId, project.id),
				eq(operationsTable.kind, "read"),
			),
		})
		expect(readOperations).toHaveLength(0)
	})

	test("identical reads absorb nothing and create no alignment operations", async () => {
		const { actor } = await makeOrgAndUser()
		const project = await makeProject(actor.orgId, actor)
		const { integrationId } = await makeIntegration(project.id, actor)
		const resource = await insertResource({
			projectId: project.id,
			integrationId,
			actor,
			slug: "stable",
			inputs: { name: "stable" },
		})
		nextRead = async (state) => ({ state })

		const operation = await makeScanOperation(actor, project)
		const result = await scanProjectWorkflow(operation)

		expect(result).toEqual({
			totalResources: 1,
			scanned: 1,
			unchanged: 1,
			absorbed: 0,
			missing: 0,
			failed: 0,
			skippedInflight: 0,
			skippedDuringRun: 0,
		})

		const updated = await db.query.resources.findFirst({
			where: eq(resources.id, resource.id),
		})
		expect(updated!.inputs).toEqual({ name: "stable" })
		expect(updated!.status).toBe("live")

		const alignmentOperations = await db.query.operations.findMany({
			where: and(
				eq(operationsTable.projectId, project.id),
				eq(operationsTable.kind, "update"),
			),
		})
		expect(alignmentOperations).toHaveLength(0)
	})

	test("absorbs declared-field changes and flags missing resources via closed alignment operations", async () => {
		const { actor } = await makeOrgAndUser()
		const project = await makeProject(actor.orgId, actor)
		const { integrationId } = await makeIntegration(project.id, actor)
		const absorbed = await insertResource({
			projectId: project.id,
			integrationId,
			actor,
			slug: "absorbed",
		})
		const volatile = await insertResource({
			projectId: project.id,
			integrationId,
			actor,
			slug: "volatile",
		})
		const missing = await insertResource({
			projectId: project.id,
			integrationId,
			actor,
			slug: "missing",
		})
		nextRead = async (state) => {
			if (state.id === "absorbed") {
				return { state: { ...state, name: "provider-name" } }
			}
			// A non-declared cloud field must not leak into the declared mirror
			// (never-widen: projecting onto the inputs shape drops it). The
			// declared mirror stays put, but §H refreshes `outputs` wholesale
			// from live cloud state, so this still absorbs (outputs-only).
			if (state.id === "volatile") {
				return { state: { ...state, external: "yes" } }
			}
			if (state.id === "missing") return { state: null }
			return { state }
		}

		const operation = await makeScanOperation(actor, project)
		const result = await scanProjectWorkflow(operation)

		expect(result).toEqual({
			totalResources: 3,
			scanned: 3,
			unchanged: 0,
			absorbed: 2,
			missing: 1,
			failed: 0,
			skippedInflight: 0,
			skippedDuringRun: 0,
		})

		const updatedAbsorbed = await db.query.resources.findFirst({
			where: eq(resources.id, absorbed.id),
		})
		expect(updatedAbsorbed!.inputs).toEqual({ name: "provider-name" })
		expect(updatedAbsorbed!.status).toBe("live")

		const updatedVolatile = await db.query.resources.findFirst({
			where: eq(resources.id, volatile.id),
		})
		expect(updatedVolatile!.inputs).toEqual({ name: "volatile" })

		const updatedMissing = await db.query.resources.findFirst({
			where: eq(resources.id, missing.id),
		})
		expect(updatedMissing!.status).toBe("missing")

		const alignmentOperations = await db.query.operations.findMany({
			where: and(
				eq(operationsTable.projectId, project.id),
				eq(operationsTable.kind, "update"),
			),
		})
		expect(alignmentOperations).toHaveLength(3)
		expect(alignmentOperations.every((row) => row.status === "succeeded")).toBe(
			true,
		)
		expect(alignmentOperations.every((row) => row.closedAt !== null)).toBe(true)
		expect(alignmentOperations.map((row) => row.result?.reason).sort()).toEqual(
			["absorbed", "absorbed", "missing"],
		)
	})

	test("a previously-missing resource that reads back is un-flagged", async () => {
		const { actor } = await makeOrgAndUser()
		const project = await makeProject(actor.orgId, actor)
		const { integrationId } = await makeIntegration(project.id, actor)
		const resource = await insertResource({
			projectId: project.id,
			integrationId,
			actor,
			slug: "resurrected",
			inputs: { name: "resurrected" },
			status: "missing",
		})
		nextRead = async (state) => ({ state })

		const operation = await makeScanOperation(actor, project)
		const result = await scanProjectWorkflow(operation)

		expect(result.absorbed).toBe(1)
		expect(result.unchanged).toBe(0)

		const updated = await db.query.resources.findFirst({
			where: eq(resources.id, resource.id),
		})
		expect(updated!.status).toBe("live")
		expect(updated!.inputs).toEqual({ name: "resurrected" })
	})

	test("lock races do not overwrite direct resource operations", async () => {
		const { actor } = await makeOrgAndUser()
		const project = await makeProject(actor.orgId, actor)
		const { integrationId } = await makeIntegration(project.id, actor)
		const resource = await insertResource({
			projectId: project.id,
			integrationId,
			actor,
			slug: "race",
		})
		nextRead = async (state) => {
			await operations.createOperation({
				actor,
				projectId: project.id,
				resourceId: resource.id,
				kind: "update",
				lockKey: `resource:${resource.id}`,
				request: { inputs: { name: "direct" } },
			})
			return { state: { ...state, name: "provider-name" } }
		}

		const operation = await makeScanOperation(actor, project)
		const result = await scanProjectWorkflow(operation)

		expect(result).toEqual({
			totalResources: 1,
			scanned: 1,
			unchanged: 0,
			absorbed: 0,
			missing: 0,
			failed: 0,
			skippedInflight: 0,
			skippedDuringRun: 1,
		})

		const row = await db.query.resources.findFirst({
			where: eq(resources.id, resource.id),
		})
		expect(row!.inputs).toEqual({ name: "race" })

		const updateOperations = await db.query.operations.findMany({
			where: and(
				eq(operationsTable.projectId, project.id),
				eq(operationsTable.kind, "update"),
			),
		})
		expect(updateOperations).toHaveLength(1)
		expect(updateOperations[0]!.request).toEqual({ inputs: { name: "direct" } })
	})

	test("failed reads are counted and do not fail the scan", async () => {
		const { actor } = await makeOrgAndUser()
		const project = await makeProject(actor.orgId, actor)
		const { integrationId } = await makeIntegration(project.id, actor)
		await insertResource({
			projectId: project.id,
			integrationId,
			actor,
			slug: "ok",
		})
		await insertResource({
			projectId: project.id,
			integrationId,
			actor,
			slug: "bad",
		})
		nextRead = async (state) => {
			if (state.id === "bad") throw new Error("read failed")
			return { state }
		}

		const operation = await makeScanOperation(actor, project)
		const result = await scanProjectWorkflow(operation)

		expect(result).toEqual({
			totalResources: 2,
			scanned: 2,
			unchanged: 1,
			absorbed: 0,
			missing: 0,
			failed: 1,
			skippedInflight: 0,
			skippedDuringRun: 0,
		})

		const closed = await db.query.operations.findFirst({
			where: eq(operationsTable.id, operation.id),
		})
		expect(closed!.status).toBe("succeeded")
		expect(closed!.result).toEqual(result)
		expect(closed!.closedAt).not.toBeNull()
		expect("resources" in closed!.result!).toBe(false)
	})

	test("non-candidate resources are left out of the scan snapshot", async () => {
		const { actor } = await makeOrgAndUser()
		const project = await makeProject(actor.orgId, actor)
		const { integrationId } = await makeIntegration(project.id, actor)
		const busy = await insertResource({
			projectId: project.id,
			integrationId,
			actor,
			slug: "busy",
		})
		await insertResource({
			projectId: project.id,
			integrationId,
			actor,
			slug: "free",
		})
		// Never applied — no identity handle to read back.
		await insertResource({
			projectId: project.id,
			integrationId,
			actor,
			slug: "never-applied",
			identity: null,
		})
		// Providerless — no cloud truth to absorb.
		await insertResource({
			projectId: project.id,
			integrationId: null,
			actor,
			slug: "providerless",
		})
		await operations.createOperation({
			actor,
			projectId: project.id,
			resourceId: busy.id,
			kind: "update",
			lockKey: `resource:${busy.id}`,
			request: {},
		})
		const operation = await makeScanOperation(actor, project)
		await insertResource({
			projectId: project.id,
			integrationId,
			actor,
			slug: "after-scan-started",
			createdAt: new Date(operation.createdAt.getTime() + 1000),
		})
		let reads = 0
		nextRead = async (state) => {
			reads++
			return { state }
		}

		const result = await scanProjectWorkflow(operation)

		expect(result).toEqual({
			totalResources: 2,
			scanned: 1,
			unchanged: 1,
			absorbed: 0,
			missing: 0,
			failed: 0,
			skippedInflight: 1,
			skippedDuringRun: 0,
		})
		expect(reads).toBe(1)

		const readOperations = await db.query.operations.findMany({
			where: and(
				eq(operationsTable.projectId, project.id),
				eq(operationsTable.kind, "read"),
			),
		})
		expect(readOperations).toHaveLength(0)
	})
})
