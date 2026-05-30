import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	mock,
	test,
} from "bun:test"
import { Conflict, InvalidInput } from "@opsy/contracts/errors"
import { eq, inArray } from "drizzle-orm"
import { db } from "@/lib/db/client"
import { migrate } from "@/lib/db/migrate"
import {
	changeSetItems,
	changeSets,
	integrations,
	organization,
	type Project,
	projects,
	resourceDryRuns,
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
import type { ChangeSetApplyGraph } from "../plan"
import type { ChangeSetView } from "../changesets"

// The pure planning/derivation rules are pinned by apply-plan.test.ts and
// apply-state.test.ts. This is the lifecycle wiring around them: a changeset
// driven through the real service (create → stage → apply → discard) against
// Postgres + a fake provider, asserting the status machine, the apply graph
// handed to the workflow, and resumable-retry suppression.

type ApplyInput = { changeSet: ChangeSetView; applyGraph: ChangeSetApplyGraph }

let applyInputs: ApplyInput[] = []

mock.module("workflow/api", () => ({
	start: async (_workflow: unknown, args: unknown[]) => {
		const input = args[0]
		// addItem/updateItem fan out plan workflows here too; filter to the
		// apply input shape so existing assertions keep their meaning.
		if (input && typeof input === "object" && "applyGraph" in input) {
			applyInputs.push(input as ApplyInput)
		}
		return { runId: `cs-test-${crypto.randomUUID()}` }
	},
}))

type ChangeSetService = typeof import("../changesets")
let changeSetService: ChangeSetService

const lifecycleBridge = createSchemaBridgeForTest({
	providerSource: "fakecorp/fakep",
	resourceSchemas: {
		fakep_bucket: {
			version: 0,
			block: {
				attributes: {
					name: { type: "string", required: true },
					arn: { type: "string", computed: true },
				},
			},
		},
		fakep_policy: {
			version: 0,
			block: {
				attributes: {
					bucket_arn: { type: "string", required: true },
				},
			},
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
		.values({ name: "CS Life", email: `csl-${suffix}@example.com` })
		.returning()
	const [org] = await db
		.insert(organization)
		.values({
			name: `csl-org-${suffix}`,
			slug: `csl-${suffix.slice(0, 12)}`,
			createdAt: new Date(),
		})
		.returning()
	const actor: Actor = { type: "user", id: u!.id, orgId: org!.id }
	const [project] = await db
		.insert(projects)
		.values({
			orgId: org!.id,
			slug: `csl-proj-${suffix.slice(0, 12)}`,
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
			createdByType: actor.type,
			createdById: actor.id,
			config: {},
			credentials: {},
		})
		.returning()
	return { id: integration!.id }
}

async function makeLiveResource(args: {
	project: Project
	actor: Actor
	integrationId: string
	slug: string
	dependsOn?: string[] | null
}) {
	const [row] = await db
		.insert(resources)
		.values({
			projectId: args.project.id,
			slug: args.slug,
			type: "fakep_bucket",
			inputs: { name: args.slug },
			identity: { id: args.slug },
			status: "live",
			provider: "fakep",
			integrationId: args.integrationId,
			dependsOn: args.dependsOn ?? null,
			createdByType: args.actor.type,
			createdById: args.actor.id,
		})
		.returning()
	return row!
}

function itemBySlug(view: ChangeSetView, slug: string) {
	const item = view.items.find((i) => i.targetResourceSlug === slug)
	if (!item) throw new Error(`no changeset item for ${slug}`)
	return item
}

function levelOf(graph: ChangeSetApplyGraph, itemId: string): number {
	const index = graph.levels.findIndex((level) =>
		level.some((entry) => entry.id === itemId),
	)
	if (index < 0) throw new Error(`item ${itemId} absent from apply graph`)
	return index
}

async function settleDryRuns(changeSetId: string): Promise<void> {
	const items = await db.query.changeSetItems.findMany({
		where: eq(changeSetItems.changeSetId, changeSetId),
		columns: { id: true },
	})
	if (items.length === 0) return
	await db
		.update(resourceDryRuns)
		.set({ action: "noop" })
		.where(
			inArray(
				resourceDryRuns.changeSetItemId,
				items.map((i) => i.id),
			),
		)
}

beforeAll(async () => {
	await migrate()
	setTerraformProviderCatalogForTest([
		{ name: "fakep", source: "fakecorp/fakep", versions: ["0.0.0"] },
	])
	setTerraformBridgeClientForTest(lifecycleBridge)
	changeSetService = await import("../changesets")
})

afterAll(() => {
	setTerraformBridgeClientForTest(null)
	setTerraformProviderCatalogForTest(null)
	clearTerraformRuntimeCacheForTest()
	mock.restore()
})

beforeEach(() => {
	clearTerraformRuntimeCacheForTest()
	applyInputs = []
})

describe("changeset lifecycle (#21)", () => {
	test("stage bucket + ref-bound policy → validate → ordered apply graph", async () => {
		const { actor, project } = await makeActorProject()
		const integration = await makeIntegration(project, actor)
		const cs = await changeSetService.create(actor, project)
		await changeSetService.stageItem(actor, project, cs.id, {
			kind: "create_resource",
			changes: {
				slug: "bucket",
				type: "fakep_bucket",
				integrationSlug: "default",
				inputs: { name: "bucket" },
			},
		})
		await changeSetService.stageItem(actor, project, cs.id, {
			kind: "create_resource",
			changes: {
				slug: "policy",
				type: "fakep_policy",
				integrationSlug: "default",
				// The CLI's `--set-ref bucket_arn=bucket.arn` lands as a $ref.
				inputs: { bucket_arn: { $ref: "bucket.arn" } },
			},
		})

		const validated = await changeSetService.get(actor, project, cs.id)
		expect(validated.items.every((i) => i.validationStatus === "valid")).toBe(
			true,
		)
		expect(integration.id).toBeTruthy()

		await settleDryRuns(cs.id)
		const { changeSet } = await changeSetService.apply(actor, project, cs.id)
		expect(changeSet.status).toBe("applying")

		const stored = await db.query.changeSets.findFirst({
			where: eq(changeSets.id, cs.id),
		})
		expect(stored!.status).toBe("applying")

		expect(applyInputs).toHaveLength(1)
		const graph = applyInputs[0]!.applyGraph
		const bucket = itemBySlug(validated, "bucket")
		const policy = itemBySlug(validated, "policy")
		// The ref makes policy depend on bucket: bucket on an earlier level.
		expect(levelOf(graph, bucket.id)).toBeLessThan(levelOf(graph, policy.id))
		const kinds = graph.levels.flat().map((e) => e.kind)
		expect(kinds).toEqual(["create_resource", "create_resource"])
	})

	test("apply rejects an invalid changeset without starting the workflow", async () => {
		const { actor, project } = await makeActorProject()
		await makeIntegration(project, actor)
		const cs = await changeSetService.create(actor, project)
		await changeSetService.stageItem(actor, project, cs.id, {
			kind: "create_resource",
			changes: {
				slug: "orphan",
				type: "fakep_policy",
				integrationSlug: "default",
				inputs: { bucket_arn: { $ref: "ghost.arn" } },
			},
		})

		await expect(
			changeSetService.apply(actor, project, cs.id),
		).rejects.toBeInstanceOf(InvalidInput)
		expect(applyInputs).toHaveLength(0)

		// Apply asserts draft and runs the same structural pass before flipping
		// state, so a rejected apply leaves the changeset in `draft`.
		const stored = await db.query.changeSets.findFirst({
			where: eq(changeSets.id, cs.id),
		})
		expect(stored!.status).toBe("draft")
	})

	test("apply on an empty changeset is rejected", async () => {
		const { actor, project } = await makeActorProject()
		const cs = await changeSetService.create(actor, project)

		await expect(
			changeSetService.apply(actor, project, cs.id),
		).rejects.toBeInstanceOf(InvalidInput)
		expect(applyInputs).toHaveLength(0)
	})

	test("resumable retry: a current success suppresses the stale 'already exists' check", async () => {
		const { actor, project } = await makeActorProject()
		const integration = await makeIntegration(project, actor)
		const cs = await changeSetService.create(actor, project)
		await changeSetService.stageItem(actor, project, cs.id, {
			kind: "create_resource",
			changes: {
				slug: "bucket",
				type: "fakep_bucket",
				integrationSlug: "default",
				inputs: { name: "bucket" },
			},
		})
		await changeSetService.stageItem(actor, project, cs.id, {
			kind: "create_resource",
			changes: {
				slug: "policy",
				type: "fakep_policy",
				integrationSlug: "default",
				inputs: { bucket_arn: { $ref: "bucket.arn" } },
			},
		})

		const before = await changeSetService.get(actor, project, cs.id)
		const bucketItem = itemBySlug(before, "bucket")
		const policyItem = itemBySlug(before, "policy")

		// First apply pass: the bucket op succeeded and materialized the live
		// row; the policy op failed. The next validate must NOT block bucket on
		// "resource bucket already exists" — its current success means re-apply
		// is a no-op skip, not a conflict.
		await makeLiveResource({
			project,
			actor,
			integrationId: integration.id,
			slug: "bucket",
		})
		const bucketOp = await operations.createOperation({
			actor,
			projectId: project.id,
			changeSetItemId: bucketItem.id,
			kind: "create",
			lockKey: `slug:bucket-${crypto.randomUUID()}`,
			request: { slug: "bucket" },
		})
		await operations.markOperationSucceeded(bucketOp, {})
		const policyOp = await operations.createOperation({
			actor,
			projectId: project.id,
			changeSetItemId: policyItem.id,
			kind: "create",
			lockKey: `slug:policy-${crypto.randomUUID()}`,
			request: { slug: "policy" },
		})
		await operations.markOperationFailed(policyOp, {
			message: "boom",
			code: "Error",
			details: null,
		})

		const after = await changeSetService.get(actor, project, cs.id)
		const retriedBucket = itemBySlug(after, "bucket")
		const retriedPolicy = itemBySlug(after, "policy")
		expect(retriedBucket.validationStatus).toBe("valid")
		expect(retriedBucket.applyStatus).toBe("succeeded")
		expect(retriedPolicy.applyStatus).toBe("failed")

		// Apply proceeds; the workflow input carries the per-item apply state so
		// the already-succeeded bucket is skipped on the retry.
		await settleDryRuns(cs.id)
		const { changeSet } = await changeSetService.apply(actor, project, cs.id)
		expect(changeSet.status).toBe("applying")
		expect(applyInputs).toHaveLength(1)
		const workflowBucket = applyInputs[0]!.changeSet.items.find(
			(i) => i.id === bucketItem.id,
		)
		expect(workflowBucket?.applyStatus).toBe("succeeded")
	})

	test("teardown order: a live dependent is deleted before the resource it depends on", async () => {
		const { actor, project } = await makeActorProject()
		const integration = await makeIntegration(project, actor)
		await makeLiveResource({
			project,
			actor,
			integrationId: integration.id,
			slug: "bucket",
		})
		await makeLiveResource({
			project,
			actor,
			integrationId: integration.id,
			slug: "policy",
			dependsOn: ["bucket"],
		})
		const cs = await changeSetService.create(actor, project)
		await changeSetService.stageItem(actor, project, cs.id, {
			kind: "delete_resource",
			targetResourceSlug: "bucket",
			changes: { mode: "delete" },
		})
		await changeSetService.stageItem(actor, project, cs.id, {
			kind: "delete_resource",
			targetResourceSlug: "policy",
			changes: { mode: "delete" },
		})

		const validated = await changeSetService.get(actor, project, cs.id)
		expect(validated.items.every((i) => i.validationStatus === "valid")).toBe(
			true,
		)

		await settleDryRuns(cs.id)
		const { changeSet } = await changeSetService.apply(actor, project, cs.id)
		expect(changeSet.status).toBe("applying")
		const graph = applyInputs[0]!.applyGraph
		const bucketDelete = itemBySlug(validated, "bucket")
		const policyDelete = itemBySlug(validated, "policy")
		expect(levelOf(graph, policyDelete.id)).toBeLessThan(
			levelOf(graph, bucketDelete.id),
		)
		expect(graph.levels.flat().map((e) => e.kind)).toEqual([
			"delete_resource",
			"delete_resource",
		])
	})

	test("discard moves a draft to discarded and is rejected once non-draft", async () => {
		const { actor, project } = await makeActorProject()
		await makeIntegration(project, actor)
		const cs = await changeSetService.create(actor, project)
		await changeSetService.stageItem(actor, project, cs.id, {
			kind: "create_resource",
			changes: {
				slug: "throwaway",
				type: "fakep_bucket",
				integrationSlug: "default",
				inputs: { name: "throwaway" },
			},
		})

		const discarded = await changeSetService.discard(actor, project, cs.id)
		expect(discarded.status).toBe("discarded")
		// A discarded changeset is no longer the project's active draft.
		const active = await changeSetService.getActive(actor, project)
		expect(active.draft).toBeNull()
		expect(active.applying).toEqual([])
		// assertDraft guards re-discard and any further mutation.
		await expect(
			changeSetService.discard(actor, project, cs.id),
		).rejects.toBeInstanceOf(Conflict)
		await expect(
			changeSetService.apply(actor, project, cs.id),
		).rejects.toBeInstanceOf(Conflict)
		expect(applyInputs).toHaveLength(0)
	})
})
