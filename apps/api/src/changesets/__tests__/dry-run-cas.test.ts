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
	changeSetItems,
	changeSets,
	organization,
	type Project,
	projects,
	resourceDryRuns,
	user,
} from "@/lib/db/schema"
import type { Actor } from "@/types"
import { type ResourceDryRunPlan, updateDryRun } from "../workflows/steps"

mock.module("workflow/api", () => ({
	start: async () => ({ runId: `cs-cas-${crypto.randomUUID()}` }),
	getRun: async () => null,
}))

async function makeActorProject(): Promise<{ actor: Actor; project: Project }> {
	const suffix = crypto.randomUUID()
	const [u] = await db
		.insert(user)
		.values({ name: "CAS Test", email: `cas-${suffix}@example.com` })
		.returning()
	const [org] = await db
		.insert(organization)
		.values({
			name: `cas-org-${suffix}`,
			slug: `cas-${suffix.slice(0, 12)}`,
			createdAt: new Date(),
		})
		.returning()
	const actor: Actor = { type: "user", id: u!.id, orgId: org!.id }
	const [project] = await db
		.insert(projects)
		.values({
			orgId: org!.id,
			slug: `cas-proj-${suffix.slice(0, 12)}`,
			createdByType: actor.type,
			createdById: actor.id,
		})
		.returning()
	return { actor, project: project! }
}

const successRecord: ResourceDryRunPlan = {
	action: "update",
	priorState: { name: "before" },
	plannedState: { name: "after" },
	requiresReplace: [],
	error: null,
}

const replaceRecord: ResourceDryRunPlan = {
	action: "replace",
	priorState: { name: "before" },
	plannedState: { name: "new" },
	requiresReplace: [["name"]],
	error: null,
}

beforeAll(async () => {
	await migrate()
})

afterAll(() => {
	mock.restore()
})

beforeEach(() => {})

async function stageItem(actor: Actor, project: Project, slug: string) {
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
			kind: "update_resource",
			targetResourceSlug: slug,
			changes: { inputs: { name: slug } },
		})
		.returning()
	const now = new Date()
	await db.insert(resourceDryRuns).values({
		changeSetItemId: item!.id,
		action: "pending",
		updatedAt: now,
	})
	return { item: item!, dryRunUpdatedAt: now }
}

describe("dry-run CAS persistence", () => {
	test("UPDATE writes when observed matches the dry-run row's updated_at", async () => {
		const { actor, project } = await makeActorProject()
		const { item, dryRunUpdatedAt } = await stageItem(
			actor,
			project,
			"cas-fresh",
		)
		await updateDryRun(item.id, successRecord, dryRunUpdatedAt)

		const row = await db.query.resourceDryRuns.findFirst({
			where: eq(resourceDryRuns.changeSetItemId, item.id),
		})
		expect(row?.action).toBe("update")
		expect(row?.plannedState).toEqual({ name: "after" })
		expect(row?.requiresReplace).toBeNull()
	})

	test("stale observed drops silently; newer flight's write wins", async () => {
		const { actor, project } = await makeActorProject()
		const { item, dryRunUpdatedAt } = await stageItem(
			actor,
			project,
			"cas-stale",
		)
		const observedByWorkflowA = dryRunUpdatedAt

		const newerUpdatedAt = new Date(observedByWorkflowA.getTime() + 1_000)
		await db
			.update(resourceDryRuns)
			.set({ updatedAt: newerUpdatedAt })
			.where(eq(resourceDryRuns.changeSetItemId, item.id))

		await updateDryRun(item.id, replaceRecord, newerUpdatedAt)
		await updateDryRun(item.id, successRecord, observedByWorkflowA)

		const row = await db.query.resourceDryRuns.findFirst({
			where: eq(resourceDryRuns.changeSetItemId, item.id),
		})
		expect(row?.action).toBe("replace")
		expect(row?.plannedState).toEqual({ name: "new" })
		expect(row?.requiresReplace).toEqual([["name"]])
	})
})
