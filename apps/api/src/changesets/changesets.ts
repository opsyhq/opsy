import {
	ChangeSetDryRunDeferred,
	ChangeSetDryRunNotSettled,
	Conflict,
	InvalidInput,
	NotFound,
} from "@opsy/contracts/errors"
import { and, eq, inArray, isNull, type SQL } from "drizzle-orm"
import { start } from "workflow/api"
import { getIntegrationByResourceType } from "../integrations"
import { actorRendersArtifacts } from "../lib/actor"
import { db } from "../lib/db/client"
import { isUniqueViolation } from "../lib/db/errors"
import { pgNotify } from "../lib/notify"
import {
	type ChangeSet,
	type ChangeSetItem,
	changeSetItems,
	changeSets,
	type Operation,
	type Project,
	type Resource,
	resourceDryRuns,
	resources,
	type StoredResourceDryRun,
} from "../lib/db/schema"
import { extractRefs } from "../lib/refs/ast"
import {
	getResourceDisplayArtifactsBySubjectId,
	type ResourceDisplayArtifacts,
} from "../resources/artifacts"
import type { Actor } from "../types"
import {
	changeSetItemSlug,
	getChangeSetApplyGraph,
	planChangesetApply,
} from "./plan"
import type {
	AddChangeSetItemBody,
	ChangeSetItemChanges,
	CreateResourceChanges,
	DeleteResourceChanges,
	ImportResourceChanges,
	UpdateChangeSetItemBody,
} from "./schemas"
import {
	getStructuralValidationContext,
	type ValidationIssue,
	validateChangeSetItems,
} from "./validation"
import { applyChangeSetWorkflow, dryRunChangeWorkflow, refreshDryRunsWorkflow } from "./workflows"

// Public view types — co-located with the producer. ChangeSetItemView enriches
// the DB row with derived fields that aren't columns (display artifacts,
// apply-time status, structural validation, dry-run projection). The
// validation/apply enums are spelled out inline; pure rename aliases buy
// nothing here.
export type ResourceDryRunView = Omit<
	StoredResourceDryRun,
	"changeSetItemId" | "plannedPrivate"
>

export type ChangeSetItemView = ChangeSetItem & {
	display: ResourceDisplayArtifacts | null
	applyStatus: "pending" | "succeeded" | "failed"
	applyError: { message?: string } | null
	validationStatus: "valid" | "invalid"
	validationResult: { message: string } | null
	dryRun: ResourceDryRunView | null
}

export type ChangeSetView = ChangeSet & { items: ChangeSetItemView[] }

// Project SSE delta channel for changeset state transitions. The payload is the
// bare ChangeSet row (no items / displays / dry-runs) — the web client fetches
// the enriched view via the REST endpoint when it needs item details; the
// notification only signals that the row changed.
export const CHANGESET_NOTIFY_CHANNEL = "opsy_changesets"
export const CHANGESET_UPDATED_EVENT = "changeset.updated"

type SerializedChangeSet = Omit<
	ChangeSet,
	"createdAt" | "updatedAt" | "appliedAt"
> & {
	createdAt: string
	updatedAt: string
	appliedAt: string | null
}

// Bare changeset row carried over pg_notify. The per-project SSE projector
// strips no envelope — the row is shipped as-is and the web client
// invalidates its changesets list on receipt.
export type ChangeSetUpdatedNotification = SerializedChangeSet

function iso(value: Date | string): string {
	return value instanceof Date ? value.toISOString() : value
}

function serializeChangeSet(changeSet: ChangeSet): SerializedChangeSet {
	return {
		...changeSet,
		createdAt: iso(changeSet.createdAt),
		updatedAt: iso(changeSet.updatedAt),
		appliedAt: changeSet.appliedAt ? iso(changeSet.appliedAt) : null,
	}
}

export async function notifyChangeSet(changeSet: ChangeSet): Promise<void> {
	await pgNotify(
		CHANGESET_NOTIFY_CHANNEL,
		JSON.stringify(serializeChangeSet(changeSet)),
	)
}

// Drizzle infers a flat `changes` column on the row; the discriminator is
// validated at insertion so the raw shape is safe to narrow. These aliases
// stay file-private — they describe the Drizzle return shape only at the
// single cast site in `loadRawChangeSets`.
type RawItemOperation = Pick<Operation, "status" | "error" | "createdAt">
type RawChangeSetItem = ChangeSetItem & { operations: RawItemOperation[] }
type RawChangeSetView = ChangeSet & { items: RawChangeSetItem[] }

// Single Drizzle entry point for loading change-set rows in the raw shape the
// rest of this module narrows on. All four list/find paths flow through here
// so the cast lives in exactly one place and the `with:` projection cannot
// drift across call sites.
async function loadRawChangeSets(options: {
	where: SQL | undefined
	orderBy?: "createdAt-asc" | "updatedAt-desc"
}): Promise<RawChangeSetView[]> {
	const rows = await db.query.changeSets.findMany({
		where: options.where,
		orderBy: (t, { asc, desc }) =>
			options.orderBy === "updatedAt-desc"
				? [desc(t.updatedAt)]
				: options.orderBy === "createdAt-asc"
					? [asc(t.createdAt)]
					: [],
		with: {
			items: {
				orderBy: (t, { asc }) => [asc(t.createdAt)],
				with: {
					operations: {
						columns: { status: true, error: true, createdAt: true },
					},
				},
			},
		},
	})
	return rows as RawChangeSetView[]
}

function assertDraft(changeSet: ChangeSet): void {
	if (changeSet.status !== "draft") {
		throw new Conflict({
			detail: `changeset ${changeSet.id} is ${changeSet.status}`,
		})
	}
}

function errorMessage(error: unknown): { message?: string } | null {
	if (error && typeof error === "object" && "message" in error) {
		const message = Reflect.get(error, "message")
		return { message: typeof message === "string" ? message : undefined }
	}
	return null
}

function currentOperations<T extends { createdAt: Date }>(
	updatedAt: Date,
	operations: T[],
): T[] {
	return operations.filter(
		(op) => op.createdAt.getTime() >= updatedAt.getTime(),
	)
}

// Public-only because apply-state.test.ts pins the resumable-retry skip rule
// against this function directly.
export function hasCurrentSuccess(
	updatedAt: Date,
	operations: { status: Operation["status"]; createdAt: Date }[],
): boolean {
	return currentOperations(updatedAt, operations).some(
		(op) => op.status === "succeeded",
	)
}

function getChangeSetItemApplyResult(
	updatedAt: Date,
	operations: RawItemOperation[],
): {
	applyStatus: "pending" | "succeeded" | "failed"
	applyError: { message?: string } | null
} {
	const current = currentOperations(updatedAt, operations)
	if (current.some((op) => op.status === "succeeded")) {
		return { applyStatus: "succeeded", applyError: null }
	}
	const failed = current.reduce<RawItemOperation | null>(
		(latest, op) =>
			op.status === "failed" &&
			(!latest || op.createdAt.getTime() > latest.createdAt.getTime())
				? op
				: latest,
		null,
	)
	if (failed) {
		return { applyStatus: "failed", applyError: errorMessage(failed.error) }
	}
	return { applyStatus: "pending", applyError: null }
}

async function getDryRunsByItemId(
	itemIds: string[],
): Promise<Map<string, ResourceDryRunView>> {
	if (itemIds.length === 0) return new Map()
	const rows = await db.query.resourceDryRuns.findMany({
		where: inArray(resourceDryRuns.changeSetItemId, itemIds),
		columns: {
			changeSetItemId: true,
			action: true,
			priorState: true,
			plannedState: true,
			requiresReplace: true,
			error: true,
			updatedAt: true,
		},
	})
	return new Map(
		rows.map((row) => [
			row.changeSetItemId,
			{
				action: row.action,
				priorState: row.priorState,
				plannedState: row.plannedState,
				requiresReplace: row.requiresReplace,
				error: row.error,
				updatedAt: row.updatedAt,
			},
		]),
	)
}

function createItemDisplaySubject(
	item: ChangeSetItem,
): { id: string; type: string; integrationId: string | null } | null {
	if (item.kind !== "import_resource" && item.kind !== "create_resource") {
		return null
	}
	if (!item.resourceType) return null
	return {
		id: item.id,
		type: item.resourceType,
		integrationId: item.integrationId,
	}
}

async function targetResourcesByItemId(
	project: Project,
	items: ChangeSetItem[],
): Promise<Map<string, Resource>> {
	const targetIds = Array.from(
		new Set(
			items.flatMap((item) =>
				item.targetResourceId ? [item.targetResourceId] : [],
			),
		),
	)
	const targetSlugs = Array.from(
		new Set(
			items.flatMap((item) =>
				item.targetResourceId || !item.targetResourceSlug
					? []
					: [item.targetResourceSlug],
			),
		),
	)
	const [byIdRows, bySlugRows] = await Promise.all([
		targetIds.length > 0
			? db.query.resources.findMany({
					where: and(
						eq(resources.projectId, project.id),
						isNull(resources.deletedAt),
						inArray(resources.id, targetIds),
					),
				})
			: [],
		targetSlugs.length > 0
			? db.query.resources.findMany({
					where: and(
						eq(resources.projectId, project.id),
						isNull(resources.deletedAt),
						inArray(resources.slug, targetSlugs),
					),
				})
			: [],
	])
	const resourcesById = new Map(byIdRows.map((row) => [row.id, row]))
	const resourcesBySlug = new Map(bySlugRows.map((row) => [row.slug, row]))
	const resourcesByItemId = new Map<string, Resource>()
	for (const item of items) {
		const resource = item.targetResourceId
			? resourcesById.get(item.targetResourceId)
			: item.targetResourceSlug
				? resourcesBySlug.get(item.targetResourceSlug)
				: undefined
		if (resource) resourcesByItemId.set(item.id, resource)
	}
	return resourcesByItemId
}

// Single private assembler that produces an enriched ChangeSetView from a raw
// Drizzle row plus pre-fetched enrichment maps. Mirrors the
// `resources/resources.ts:getResourceView` pattern.
function getChangeSetView(
	row: RawChangeSetView,
	enrichment: {
		dryRuns: Map<string, ResourceDryRunView>
		issues: Map<string, ValidationIssue>
		displays: Map<string, ResourceDisplayArtifacts | null> | null
	},
): ChangeSetView {
	return {
		...row,
		items: row.items.map(({ operations, ...item }): ChangeSetItemView => {
			const issue = enrichment.issues.get(item.id)
			return {
				...(item as ChangeSetItem),
				display: enrichment.displays?.get(item.id) ?? null,
				dryRun: enrichment.dryRuns.get(item.id) ?? null,
				validationStatus: issue ? "invalid" : "valid",
				validationResult: issue ? { message: issue.message } : null,
				...getChangeSetItemApplyResult(item.updatedAt, operations),
			}
		}),
	}
}

async function getChangeSetViewsWithDisplays(
	actor: Actor,
	project: Project,
	rows: RawChangeSetView[],
): Promise<ChangeSetView[]> {
	const allItems = rows.flatMap((row) => row.items)
	const itemIds = allItems.map((item) => item.id)
	const [dryRunByItemId, structuralContext] = await Promise.all([
		getDryRunsByItemId(itemIds),
		getStructuralValidationContext(project),
	])
	const issuesByChangeSetId = new Map<string, Map<string, ValidationIssue>>()
	for (const row of rows) {
		// View time skips the expensive apply-plan graph pass — only the cheap
		// structural checks run on every read. Apply-time blockers (cycles,
		// blocked dependencies) surface when the user actually clicks apply.
		issuesByChangeSetId.set(
			row.id,
			validateChangeSetItems(row.items, structuralContext, []),
		)
	}

	if (!actorRendersArtifacts(actor)) {
		return rows.map((row) =>
			getChangeSetView(row, {
				dryRuns: dryRunByItemId,
				issues: issuesByChangeSetId.get(row.id) ?? new Map(),
				displays: null,
			}),
		)
	}
	const targetResources = await targetResourcesByItemId(project, allItems)
	const subjects = allItems.flatMap((item) => {
		const createSubject = createItemDisplaySubject(item)
		if (createSubject) return [createSubject]
		const resource = targetResources.get(item.id)
		return resource
			? [
					{
						id: item.id,
						type: resource.type,
						integrationId: resource.integrationId,
					},
				]
			: []
	})
	const displayByItemId = await getResourceDisplayArtifactsBySubjectId(
		project.id,
		subjects,
	)
	return rows.map((row) =>
		getChangeSetView(row, {
			dryRuns: dryRunByItemId,
			issues: issuesByChangeSetId.get(row.id) ?? new Map(),
			displays: displayByItemId,
		}),
	)
}

async function getChangeSetViewWithItemDisplays(
	actor: Actor,
	project: Project,
	row: RawChangeSetView,
): Promise<ChangeSetView> {
	const [view] = await getChangeSetViewsWithDisplays(actor, project, [row])
	return view
}

async function getRawChangeSetView(
	id: string,
): Promise<RawChangeSetView | null> {
	const [row] = await loadRawChangeSets({ where: eq(changeSets.id, id) })
	return row ?? null
}

async function getRawChangeSetViewByProject(
	project: Project,
	id: string,
): Promise<RawChangeSetView> {
	const row = await getRawChangeSetView(id)
	if (!row || row.projectId !== project.id) {
		throw new NotFound({ detail: `changeset ${id} not found` })
	}
	return row
}

async function getChangeSetViewByProject(
	actor: Actor,
	project: Project,
	id: string,
): Promise<ChangeSetView> {
	const row = await getRawChangeSetViewByProject(project, id)
	return getChangeSetViewWithItemDisplays(actor, project, row)
}

// ─── Reads ─────────────────────────────────────────────────────────────────

export async function list(
	actor: Actor,
	project: Project,
): Promise<ChangeSetView[]> {
	const rows = await loadRawChangeSets({
		where: eq(changeSets.projectId, project.id),
		orderBy: "updatedAt-desc",
	})
	return getChangeSetViewsWithDisplays(actor, project, rows)
}

export async function get(
	actor: Actor,
	project: Project,
	id: string,
): Promise<ChangeSetView> {
	return getChangeSetViewByProject(actor, project, id)
}

async function findDraft(
	actor: Actor,
	project: Project,
): Promise<ChangeSetView | null> {
	const [row] = await loadRawChangeSets({
		where: and(
			eq(changeSets.projectId, project.id),
			eq(changeSets.status, "draft"),
		),
	})
	return row ? getChangeSetViewWithItemDisplays(actor, project, row) : null
}

async function findApplying(
	actor: Actor,
	project: Project,
): Promise<ChangeSetView[]> {
	const rows = await loadRawChangeSets({
		where: and(
			eq(changeSets.projectId, project.id),
			eq(changeSets.status, "applying"),
		),
		orderBy: "createdAt-asc",
	})
	return Promise.all(
		rows.map((row) => getChangeSetViewWithItemDisplays(actor, project, row)),
	)
}

export async function getActive(
	actor: Actor,
	project: Project,
): Promise<{ draft: ChangeSetView | null; applying: ChangeSetView[] }> {
	const [draft, applying] = await Promise.all([
		findDraft(actor, project),
		findApplying(actor, project),
	])
	return { draft, applying }
}

export async function getItemDryRun(
	project: Project,
	changeSetId: string,
	itemId: string,
): Promise<ResourceDryRunView> {
	const item = await db.query.changeSetItems.findFirst({
		where: eq(changeSetItems.id, itemId),
		columns: { id: true, changeSetId: true },
		with: {
			changeSet: { columns: { projectId: true } },
			dryRun: {
				columns: {
					action: true,
					priorState: true,
					plannedState: true,
					requiresReplace: true,
					error: true,
					updatedAt: true,
				},
			},
		},
	})
	if (
		!item ||
		item.changeSetId !== changeSetId ||
		item.changeSet.projectId !== project.id ||
		!item.dryRun
	) {
		throw new NotFound({ detail: `dry-run for item ${itemId} not found` })
	}
	return item.dryRun
}

// ─── Mutations ─────────────────────────────────────────────────────────────

export async function create(
	actor: Actor,
	project: Project,
	body: { title?: string | null } = {},
): Promise<ChangeSetView> {
	try {
		const [row] = await db
			.insert(changeSets)
			.values({
				projectId: project.id,
				title: body.title ?? null,
				actorType: actor.type,
				actorId: actor.id,
			})
			.returning()
		if (!row) throw new InvalidInput({ detail: "failed to create changeset" })
		await notifyChangeSet(row)
		return { ...row, items: [] }
	} catch (err) {
		if (isUniqueViolation(err)) {
			throw new Conflict({ detail: "project already has a draft changeset" })
		}
		throw err
	}
}

export async function getOrCreateActive(
	actor: Actor,
	project: Project,
): Promise<ChangeSetView> {
	const draft = await findDraft(actor, project)
	if (draft) return draft
	try {
		return await create(actor, project, {})
	} catch (err) {
		if (err instanceof Conflict) {
			const raced = await findDraft(actor, project)
			if (raced) return raced
		}
		throw err
	}
}

async function getTargetResourceForItem(input: {
	project: Project
	targetResourceId?: string | null
	targetResourceSlug?: string | null
}): Promise<Resource | null> {
	if (!input.targetResourceId && !input.targetResourceSlug) return null
	const conds = [
		eq(resources.projectId, input.project.id),
		isNull(resources.deletedAt),
	]
	if (input.targetResourceId)
		conds.push(eq(resources.id, input.targetResourceId))
	if (input.targetResourceSlug)
		conds.push(eq(resources.slug, input.targetResourceSlug))
	const row = await db.query.resources.findFirst({ where: and(...conds) })
	return row ?? null
}

// Branch-by-branch merge of an update body onto an existing item. The
// discriminator (`kind`) is checked equal at the call site; this function
// narrows on `body.kind` and reconstructs a valid AddChangeSetItemBody by
// overlaying body fields onto existing fields per variant. No Zod re-parse —
// the route validated `body` and the DB validated `existing.changes`. The
// casts bridge `existing.changes` (typed as the full union) into the
// per-branch variant proven by the kind-equality guard.
function mergeUpdateBody(
	existing: ChangeSetItem,
	body: UpdateChangeSetItemBody,
): AddChangeSetItemBody {
	const source = body.source ?? existing.source
	if (body.kind === "create_resource" && existing.kind === "create_resource") {
		const prev = existing.changes as CreateResourceChanges
		return {
			kind: "create_resource",
			source,
			changes: { ...prev, ...(body.changes ?? {}) } as CreateResourceChanges,
		}
	}
	if (body.kind === "import_resource" && existing.kind === "import_resource") {
		const prev = existing.changes as ImportResourceChanges
		return {
			kind: "import_resource",
			source,
			changes: { ...prev, ...(body.changes ?? {}) } as ImportResourceChanges,
		}
	}
	if (body.kind === "update_resource" && existing.kind === "update_resource") {
		const mergedInputs =
			body.changes?.inputs ??
			(existing.changes as { inputs: Record<string, unknown> }).inputs
		return {
			kind: "update_resource",
			source,
			changes: { inputs: mergedInputs },
			targetResourceId:
				body.targetResourceId !== undefined
					? body.targetResourceId
					: existing.targetResourceId,
			targetResourceSlug:
				body.targetResourceSlug !== undefined
					? body.targetResourceSlug
					: existing.targetResourceSlug,
		}
	}
	if (body.kind === "delete_resource" && existing.kind === "delete_resource") {
		const prev = existing.changes as DeleteResourceChanges
		return {
			kind: "delete_resource",
			source,
			changes: { ...prev, ...(body.changes ?? {}) } as DeleteResourceChanges,
			targetResourceId:
				body.targetResourceId !== undefined
					? body.targetResourceId
					: existing.targetResourceId,
			targetResourceSlug:
				body.targetResourceSlug !== undefined
					? body.targetResourceSlug
					: existing.targetResourceSlug,
		}
	}
	// Discriminator equality is asserted by the caller; this branch is
	// unreachable. Throw to make the missing-narrow case obvious if it ever
	// fires.
	throw new InvalidInput({ detail: "update body kind mismatch" })
}

async function normalizeAddChangeSetItemBody(
	project: Project,
	body: AddChangeSetItemBody,
): Promise<{
	kind: ChangeSetItem["kind"]
	targetResourceId: string | null
	targetResourceSlug: string | null
	integrationId: string | null
	resourceType: string | null
	changes: ChangeSetItemChanges
	source: ChangeSetItem["source"]
	dependsOn: string[]
}> {
	if (body.kind === "create_resource") {
		const inputs = body.changes.inputs ?? null
		return {
			kind: body.kind,
			targetResourceId: null,
			targetResourceSlug: body.changes.slug,
			integrationId: body.changes.type
				? (
						await getIntegrationByResourceType(
							project.id,
							body.changes.type,
							body.changes.integrationSlug,
						)
					).id
				: null,
			resourceType: body.changes.type ?? null,
			changes: body.changes,
			source: body.source ?? "user",
			dependsOn: extractRefs(inputs),
		}
	}
	if (body.kind === "import_resource") {
		return {
			kind: body.kind,
			targetResourceId: null,
			targetResourceSlug: body.changes.slug,
			integrationId: (
				await getIntegrationByResourceType(
					project.id,
					body.changes.type,
					body.changes.integrationSlug,
				)
			).id,
			resourceType: body.changes.type,
			changes: body.changes,
			source: body.source ?? "import",
			dependsOn: [],
		}
	}

	const target = await getTargetResourceForItem({
		project,
		targetResourceId: body.targetResourceId,
		targetResourceSlug: body.targetResourceSlug,
	})
	if (!target) {
		throw new NotFound({ detail: "target resource not found" })
	}
	return {
		kind: body.kind,
		targetResourceId: target.id,
		targetResourceSlug: target.slug,
		integrationId: target.integrationId,
		resourceType: target.type,
		changes: body.changes,
		source: body.source ?? "user",
		dependsOn: extractRefs(
			body.kind === "update_resource" ? body.changes.inputs : null,
		),
	}
}

export async function stageItem(
	actor: Actor,
	project: Project,
	id: string,
	body: AddChangeSetItemBody,
): Promise<ChangeSetView> {
	const changeSet = await getRawChangeSetViewByProject(project, id)
	assertDraft(changeSet)
	const normalized = await normalizeAddChangeSetItemBody(project, body)
	const observed = new Date()
	const newItem = {
		id: crypto.randomUUID(),
		changeSetId: id,
		...normalized,
		updatedAt: observed,
	}
	const inserted = await db.transaction(async (tx) => {
		const [row] = await tx.insert(changeSetItems).values(newItem).returning()
		if (!row) throw new InvalidInput({ detail: "failed to insert item" })
		await tx.insert(resourceDryRuns).values({
			changeSetItemId: row.id,
			action: "pending",
			updatedAt: observed,
		})
		return row
	})
	await start(dryRunChangeWorkflow, [
		{
			itemId: inserted.id,
			projectId: project.id,
			observed,
		},
	])
	return getChangeSetViewByProject(actor, project, id)
}

export async function updateItem(
	actor: Actor,
	project: Project,
	id: string,
	itemId: string,
	body: UpdateChangeSetItemBody,
): Promise<ChangeSetView> {
	const changeSet = await getRawChangeSetViewByProject(project, id)
	assertDraft(changeSet)
	const existing = changeSet.items.find((item) => item.id === itemId)
	if (!existing)
		throw new NotFound({ detail: `changeset item ${itemId} not found` })
	if (body.kind !== existing.kind) {
		throw new InvalidInput({
			detail: `cannot change kind of item ${itemId} from ${existing.kind} to ${body.kind}`,
		})
	}
	const merged = mergeUpdateBody(existing, body)
	const normalized = await normalizeAddChangeSetItemBody(project, merged)
	const updatedAt = new Date()
	const [updated] = await db.transaction(async (tx) => {
		const rows = await tx
			.update(changeSetItems)
			.set({ ...normalized, updatedAt })
			.where(eq(changeSetItems.id, itemId))
			.returning()
		if (rows[0]) {
			await tx
				.update(resourceDryRuns)
				.set({
					action: "pending",
					priorState: null,
					plannedState: null,
					plannedPrivate: null,
					requiresReplace: null,
					error: null,
					updatedAt,
				})
				.where(eq(resourceDryRuns.changeSetItemId, itemId))
		}
		return rows
	})
	if (!updated)
		throw new NotFound({ detail: `changeset item ${itemId} not found` })
	await start(dryRunChangeWorkflow, [
		{
			itemId: updated.id,
			projectId: project.id,
			observed: updatedAt,
		},
	])
	return getChangeSetViewByProject(actor, project, id)
}

export async function deleteItem(
	actor: Actor,
	project: Project,
	id: string,
	itemId: string,
): Promise<ChangeSetView> {
	const changeSet = await getRawChangeSetViewByProject(project, id)
	assertDraft(changeSet)
	const existing = changeSet.items.find((item) => item.id === itemId)
	if (!existing)
		throw new NotFound({ detail: `changeset item ${itemId} not found` })
	await db.delete(changeSetItems).where(eq(changeSetItems.id, itemId))
	return getChangeSetViewByProject(actor, project, id)
}

export async function refreshDryRuns(
	actor: Actor,
	project: Project,
	id: string,
): Promise<ChangeSetView> {
	const changeSet = await getRawChangeSetViewByProject(project, id)
	assertDraft(changeSet)
	if (changeSet.items.length === 0) {
		throw new InvalidInput({ detail: "changeset has no items" })
	}
	await start(refreshDryRunsWorkflow, [
		{ changeSetId: changeSet.id, projectId: project.id },
	])
	return getChangeSetViewByProject(actor, project, id)
}

export async function apply(
	actor: Actor,
	project: Project,
	id: string,
): Promise<{ changeSet: ChangeSetView }> {
	const rawView = await getRawChangeSetViewByProject(project, id)
	assertDraft(rawView)
	if (rawView.items.length === 0) {
		throw new InvalidInput({ detail: "changeset has no items" })
	}

	const context = await getStructuralValidationContext(project)
	// planChangesetApply runs exactly once per apply(): its blockers feed the
	// validator and its orderedItems/dependencies feed the level graph. The
	// validator no longer reaches into the planner.
	const plan = planChangesetApply(rawView.items, context.liveResources)
	const issues = validateChangeSetItems(rawView.items, context, plan.blockers)
	if (issues.size > 0) {
		const first = issues.values().next().value
		throw new InvalidInput({
			detail: `changeset has ${issues.size} structural issue(s): ${first?.message ?? "unknown"}`,
		})
	}

	const itemIds = rawView.items.map((item) => item.id)
	const applyGraph = getChangeSetApplyGraph(plan)

	const dryRunRows = await db
		.select({
			changeSetItemId: resourceDryRuns.changeSetItemId,
			action: resourceDryRuns.action,
		})
		.from(resourceDryRuns)
		.where(inArray(resourceDryRuns.changeSetItemId, itemIds))

	const slugByItemId = new Map(
		rawView.items.map((item) => [item.id, changeSetItemSlug(item) ?? item.id]),
	)

	const missing: string[] = []
	const pending: string[] = []
	const deferred: string[] = []
	const settled = new Set(dryRunRows.map((r) => r.changeSetItemId))
	for (const itemId of itemIds) {
		if (!settled.has(itemId)) missing.push(slugByItemId.get(itemId) ?? itemId)
	}
	for (const row of dryRunRows) {
		const slug = slugByItemId.get(row.changeSetItemId) ?? row.changeSetItemId
		if (row.action === "pending") pending.push(slug)
		else if (row.action === "deferred") deferred.push(slug)
	}

	if (missing.length > 0 || pending.length > 0) {
		throw new ChangeSetDryRunNotSettled({
			pendingSlugs: [...missing, ...pending],
		})
	}
	if (deferred.length > 0) {
		throw new ChangeSetDryRunDeferred({ blockingSlugs: deferred })
	}

	await db
		.update(changeSets)
		.set({ status: "applying" })
		.where(and(eq(changeSets.id, id), eq(changeSets.status, "draft")))

	// Patch the in-memory raw view to reflect the status transition so the
	// workflow receives status:'applying' without a second DB round-trip.
	const patchedRaw: typeof rawView = { ...rawView, status: "applying" }
	await notifyChangeSet(patchedRaw)
	try {
		const view = await getChangeSetViewWithItemDisplays(
			actor,
			project,
			patchedRaw,
		)
		await start(applyChangeSetWorkflow, [{ changeSet: view, applyGraph }])
		return { changeSet: view }
	} catch (error) {
		const [reverted] = await db
			.update(changeSets)
			.set({ status: "draft", appliedAt: null })
			.where(and(eq(changeSets.id, id), eq(changeSets.status, "applying")))
			.returning()
		if (reverted) await notifyChangeSet(reverted)
		throw error
	}
}

export async function discard(
	actor: Actor,
	project: Project,
	id: string,
): Promise<ChangeSetView> {
	const rawView = await getRawChangeSetViewByProject(project, id)
	assertDraft(rawView)
	await db
		.update(changeSets)
		.set({ status: "discarded" })
		.where(eq(changeSets.id, id))
	const discardedRaw: typeof rawView = {
		...rawView,
		status: "discarded",
	}
	await notifyChangeSet(discardedRaw)
	return getChangeSetViewWithItemDisplays(actor, project, discardedRaw)
}
