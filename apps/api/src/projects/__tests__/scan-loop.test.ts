import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	mock,
	test,
} from "bun:test"
import { Conflict } from "@opsy/contracts/errors"
import { and, eq } from "drizzle-orm"
import { db } from "@/lib/db/client"
import { migrate } from "@/lib/db/migrate"
import { operations, organization, projects, user } from "@/lib/db/schema"
import type { Actor } from "@/types"

mock.module("workflow/api", () => ({
	start: async () => ({ runId: `scan-loop-test-${crypto.randomUUID()}` }),
}))

let scan: typeof import("../projects").startProjectScan
let tick: typeof import("../projects").runScanLoopTick

async function makeOrg(): Promise<{ orgId: string; actor: Actor }> {
	const suffix = crypto.randomUUID()
	const [u] = await db
		.insert(user)
		.values({ name: "Loop Test", email: `loop-${suffix}@example.com` })
		.returning()
	const [org] = await db
		.insert(organization)
		.values({
			name: `loop-org-${suffix}`,
			slug: `loop-org-${suffix.slice(0, 12)}`,
			createdAt: new Date(),
		})
		.returning()
	return { orgId: org!.id, actor: { type: "user", id: u!.id, orgId: org!.id } }
}

async function makeProject(
	orgId: string,
	actor: Actor,
	args: {
		scanInterval: "off" | "hourly" | "daily"
		lastScanClaimedAt?: Date | null
	},
): Promise<{ id: string; orgId: string; slug: string }> {
	const [p] = await db
		.insert(projects)
		.values({
			orgId,
			slug: `loop-proj-${crypto.randomUUID().slice(0, 12)}`,
			createdByType: actor.type,
			createdById: actor.id,
			scanInterval: args.scanInterval,
			lastScanClaimedAt: args.lastScanClaimedAt ?? null,
		})
		.returning()
	return { id: p!.id, orgId: p!.orgId, slug: p!.slug }
}

async function countRuns(projectId: string): Promise<number> {
	const rows = await db.query.operations.findMany({
		where: and(
			eq(operations.projectId, projectId),
			eq(operations.kind, "scan"),
		),
	})
	return rows.length
}

beforeAll(async () => {
	;({ startProjectScan: scan, runScanLoopTick: tick } = await import("../projects"))
	await migrate()
})

afterAll(() => {})

beforeEach(async () => {
	await db.update(projects).set({ scanInterval: "off" })
})

describe("scan loop — claim semantics", () => {
	test("scan_interval='off' projects are never claimed", async () => {
		const { orgId, actor } = await makeOrg()
		const proj = await makeProject(orgId, actor, { scanInterval: "off" })

		await tick()

		expect(await countRuns(proj.id)).toBe(0)
	})

	test("hourly with last claim 30m ago is not claimed; 90m ago is claimed", async () => {
		const { orgId, actor } = await makeOrg()
		const recent = await makeProject(orgId, actor, {
			scanInterval: "hourly",
			lastScanClaimedAt: new Date(Date.now() - 30 * 60 * 1000),
		})
		const stale = await makeProject(orgId, actor, {
			scanInterval: "hourly",
			lastScanClaimedAt: new Date(Date.now() - 90 * 60 * 1000),
		})

		await tick()

		expect(await countRuns(recent.id)).toBe(0)
		expect(await countRuns(stale.id)).toBe(1)
	})

	test("daily project just shy of 24h is not claimed; past 24h is claimed", async () => {
		const { orgId, actor } = await makeOrg()
		const recent = await makeProject(orgId, actor, {
			scanInterval: "daily",
			lastScanClaimedAt: new Date(Date.now() - 23 * 60 * 60 * 1000),
		})
		const stale = await makeProject(orgId, actor, {
			scanInterval: "daily",
			lastScanClaimedAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
		})

		await tick()

		expect(await countRuns(recent.id)).toBe(0)
		expect(await countRuns(stale.id)).toBe(1)
	})

	test("hourly with null last_scan_claimed_at is claimed", async () => {
		const { orgId, actor } = await makeOrg()
		const proj = await makeProject(orgId, actor, {
			scanInterval: "hourly",
			lastScanClaimedAt: null,
		})

		await tick()

		expect(await countRuns(proj.id)).toBe(1)
	})

	test("two concurrent claims against the same project yield exactly one scan", async () => {
		const { orgId, actor } = await makeOrg()
		const projRow = await makeProject(orgId, actor, {
			scanInterval: "hourly",
			lastScanClaimedAt: new Date(Date.now() - 90 * 60 * 1000),
		})
		const project = await db.query.projects.findFirst({
			where: eq(projects.id, projRow.id),
		})

		// The atomic claim is the scan-operation insert, serialized by the
		// `operations_open_lock_unique` partial index on (project_id, lock_key).
		// The loser of the race must see a Conflict, not a second scan.
		const results = await Promise.allSettled([
			scan(actor, project!),
			scan(actor, project!),
		])

		const fulfilled = results.filter((r) => r.status === "fulfilled")
		const rejected = results.filter((r) => r.status === "rejected")
		expect(fulfilled.length).toBe(1)
		expect(rejected.length).toBe(1)
		expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(
			Conflict,
		)
		expect(await countRuns(projRow.id)).toBe(1)
	})

	test("a concurrent tick that loses the claim race does not double-scan", async () => {
		const { orgId, actor } = await makeOrg()
		const projRow = await makeProject(orgId, actor, {
			scanInterval: "hourly",
			lastScanClaimedAt: new Date(Date.now() - 90 * 60 * 1000),
		})

		// tick() swallows Conflict for the losing claim, so both ticks settle
		// successfully but only one scan operation exists for the project.
		await Promise.all([tick(), tick()])

		expect(await countRuns(projRow.id)).toBe(1)
	})

	test("manual scan bumps last_scan_claimed_at so the loop skips on next tick", async () => {
		const { orgId, actor } = await makeOrg()
		const projRow = await makeProject(orgId, actor, {
			scanInterval: "hourly",
			lastScanClaimedAt: new Date(Date.now() - 90 * 60 * 1000),
		})
		const project = await db.query.projects.findFirst({
			where: eq(projects.id, projRow.id),
		})

		await scan(actor, project!)
		expect(await countRuns(projRow.id)).toBe(1)

		await tick()
		expect(await countRuns(projRow.id)).toBe(1)
	})

	test("soft-deleted projects are never claimed", async () => {
		const { orgId, actor } = await makeOrg()
		const proj = await makeProject(orgId, actor, {
			scanInterval: "hourly",
			lastScanClaimedAt: new Date(Date.now() - 90 * 60 * 1000),
		})
		await db
			.update(projects)
			.set({ deletedAt: new Date() })
			.where(and(eq(projects.id, proj.id)))

		await tick()

		expect(await countRuns(proj.id)).toBe(0)
	})
})
