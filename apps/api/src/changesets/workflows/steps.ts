import {
	BridgeDiagnosticError,
	BridgeTransportError,
} from "@opsy/bridge-client"
import type { State } from "@opsy/provider"
import { InvalidInput } from "@opsy/contracts/errors"
import { and, eq, inArray, isNull, or } from "drizzle-orm"
import { getIntegrationById } from "../../integrations"
import { db } from "../../lib/db/client"
import {
	type ChangeSet,
	type ChangeSetItem,
	changeSetItems,
	changeSetItemSlugFromChanges,
	changeSets,
	type Operation,
	type Resource,
	resourceDryRuns,
	resources,
	type StoredResourceDryRun,
} from "../../lib/db/schema"
import { type RefTarget, substituteRefs } from "../../lib/refs/ast"
import * as operations from "../../operations"
import {
	getResourceDryRunAction,
	type ResourceDryRunAction,
} from "../../resources/dry-run"
import { getReferenceTargetsBySlug } from "../../resources/references"
import { getResourceByChangeSetItem } from "../../resources/resources"
import { notifyChangeSet } from "../changesets"
import type {
	CreateResourceBody,
	ImportResourceBody,
	UpdateResourceBody,
} from "../../resources/schemas"
import { resourceState } from "../../resources/schemas"
import {
	planResource,
	readImportState,
	type ResourcePlan,
} from "../../resources/workflows/steps"
import { ImportNotFoundError } from "../../lib/errors"
import type { ChangeSetView } from "../changesets"

type DeleteResourceBody = {
	slug: string
	mode: "delete" | "forget"
}

// Apply-side ops. Each step creates one Operation row that the corresponding
// resource workflow then drives. Names use `apply*Operation` because the step
// belongs to the apply lifecycle — `createChangeSet*Operation` confused the
// resource-create verb with the workflow-step responsibility. Create/import
// allocate the resource row + operation atomically (one tx) so the lock and
// the `creating`/`importing` lifecycle come into existence together.
export async function applyCreateOperation(
	changeSet: ChangeSetView,
	item: Extract<ChangeSetItem, { kind: "create_resource" }>,
): Promise<Operation<CreateResourceBody>> {
	"use step"

	const body = item.changes
	const isProvider = body.type !== undefined
	const integration =
		isProvider && item.integrationId
			? await getIntegrationById(changeSet.projectId, item.integrationId)
			: null
	const { extractRefs } = await import("../../lib/refs/ast")
	const refs = isProvider ? extractRefs(body.inputs) : []
	const { operation } = await operations.createResourceWithOperation({
		actor: { type: changeSet.actorType, id: changeSet.actorId },
		projectId: changeSet.projectId,
		changeSetItemId: item.id,
		kind: "create",
		request: body,
		resource: {
			slug: body.slug,
			type: isProvider ? (body.type as string) : "resource",
			status: "creating",
			inputs: isProvider ? (body.inputs ?? null) : null,
			provider: integration?.provider ?? null,
			integrationId: integration?.id ?? null,
			dependsOn: refs.length > 0 ? refs : null,
			metadata: body.displayName ? { displayName: body.displayName } : {},
			position: body.position ?? null,
		},
	})
	return operation
}

export async function applyImportOperation(
	changeSet: ChangeSetView,
	item: Extract<ChangeSetItem, { kind: "import_resource" }>,
): Promise<Operation<ImportResourceBody>> {
	"use step"

	const body = item.changes
	if (!item.integrationId) {
		throw new InvalidInput({
			detail: `import item ${body.slug} has no integration resolved`,
		})
	}
	const integration = await getIntegrationById(
		changeSet.projectId,
		item.integrationId,
	)
	const { operation } = await operations.createResourceWithOperation({
		actor: { type: changeSet.actorType, id: changeSet.actorId },
		projectId: changeSet.projectId,
		changeSetItemId: item.id,
		kind: "import",
		request: body,
		resource: {
			slug: body.slug,
			type: body.type,
			status: "importing",
			inputs: null,
			provider: integration.provider,
			integrationId: integration.id,
			metadata: {},
			position: body.position ?? null,
		},
	})
	return operation
}

// Loads the live resource an apply step is acting on, or null when it's gone.
// Prefers `getResourceByChangeSetItem` (single join on targetResourceId) but
// falls back to the historical slug lookup so an item whose target was deleted
// and recreated under the same slug still resolves.
async function findApplyTargetResource(
	changeSet: ChangeSet,
	item: ChangeSetItem,
): Promise<Resource | null> {
	if (item.targetResourceId) {
		const byId = await getResourceByChangeSetItem(changeSet.projectId, item.id)
		if (byId) return byId
	}
	if (item.targetResourceSlug) {
		const bySlug = await db.query.resources.findFirst({
			where: and(
				eq(resources.projectId, changeSet.projectId),
				eq(resources.slug, item.targetResourceSlug),
				isNull(resources.deletedAt),
			),
		})
		if (bySlug) return bySlug
	}
	return null
}

async function getApplyTargetResource(
	changeSet: ChangeSet,
	item: ChangeSetItem,
): Promise<Resource> {
	const resource = await findApplyTargetResource(changeSet, item)
	if (!resource) {
		throw new InvalidInput({
			detail: `target resource ${item.targetResourceSlug ?? item.targetResourceId} not found`,
		})
	}
	return resource
}

export async function applyUpdateOperation(
	changeSet: ChangeSetView,
	item: Extract<ChangeSetItem, { kind: "update_resource" }>,
): Promise<Operation<UpdateResourceBody>> {
	"use step"

	const resource = await getApplyTargetResource(changeSet, item)
	return operations.createOperation({
		actor: { type: changeSet.actorType, id: changeSet.actorId },
		projectId: changeSet.projectId,
		changeSetItemId: item.id,
		kind: "update",
		resourceId: resource.id,
		lockKey: `resource:${resource.id}`,
		request: { inputs: item.changes.inputs },
	})
}

export async function applyDeleteOperation(
	changeSet: ChangeSetView,
	item: Extract<ChangeSetItem, { kind: "delete_resource" }>,
): Promise<Operation<DeleteResourceBody>> {
	"use step"

	const resource = await getApplyTargetResource(changeSet, item)
	return operations.createOperation({
		actor: { type: changeSet.actorType, id: changeSet.actorId },
		projectId: changeSet.projectId,
		changeSetItemId: item.id,
		kind: "delete",
		resourceId: resource.id,
		lockKey: `resource:${resource.id}`,
		request: {
			slug: resource.slug,
			mode: "delete",
		},
	})
}

// Forget on an already-gone target (tombstoned or hard-deleted) has no live row
// to stop managing, so there's nothing to operate on — return null and let the
// orchestration settle the item as succeeded without a provider round-trip.
export async function applyForgetOperation(
	changeSet: ChangeSetView,
	item: Extract<ChangeSetItem, { kind: "delete_resource" }>,
): Promise<Operation<DeleteResourceBody> | null> {
	"use step"

	const resource = await findApplyTargetResource(changeSet, item)
	if (!resource) return null
	return operations.createOperation({
		actor: { type: changeSet.actorType, id: changeSet.actorId },
		projectId: changeSet.projectId,
		changeSetItemId: item.id,
		kind: "delete",
		resourceId: resource.id,
		lockKey: `resource:${resource.id}`,
		request: {
			slug: resource.slug,
			mode: "forget",
		},
	})
}

export async function closeChangeSet(
	changeSet: ChangeSetView,
): Promise<ChangeSetView> {
	"use step"

	const [updated] = await db
		.update(changeSets)
		.set({ status: "applied", appliedAt: new Date() })
		.where(eq(changeSets.id, changeSet.id))
		.returning()
	if (!updated) throw new Error(`changeset not found: ${changeSet.id}`)
	await notifyChangeSet(updated)
	return { ...updated, items: changeSet.items }
}

export async function cancelChangeSet(
	changeSet: ChangeSetView,
): Promise<ChangeSetView> {
	"use step"

	const [updated] = await db
		.update(changeSets)
		.set({ status: "canceled" })
		.where(eq(changeSets.id, changeSet.id))
		.returning()
	if (!updated) throw new Error(`changeset not found: ${changeSet.id}`)
	await notifyChangeSet(updated)
	return { ...updated, items: changeSet.items }
}

// Resumable retry: a partial apply failure rolls the changeset back to `draft`
// (not the terminal `failed`) so the user can fix the offending items and
// re-apply. Items that already succeeded are skipped on the next run.
export async function reopenChangeSet(
	changeSet: ChangeSetView,
): Promise<ChangeSetView> {
	"use step"

	const [updated] = await db
		.update(changeSets)
		.set({ status: "draft", appliedAt: null })
		.where(eq(changeSets.id, changeSet.id))
		.returning()
	if (!updated) throw new Error(`changeset not found: ${changeSet.id}`)
	await notifyChangeSet(updated)
	return { ...updated, items: changeSet.items }
}

// Dry-run steps. Below this line is the in-flight planning computation that
// produces the dry-run row the user reviews before apply.

export type ResourceDryRunPlan = ResourcePlan & {
	action: StoredResourceDryRun["action"]
	error: { message: string } | null
}

export async function getChangeSetItem(
	itemId: string,
): Promise<ChangeSetItem | null> {
	"use step"
	const row = await db.query.changeSetItems.findFirst({
		where: eq(changeSetItems.id, itemId),
	})
	// Drizzle infers a flat `changes` column; insertion validates the
	// kind/changes discriminator pair, so the row is safe to narrow here.
	return (row as ChangeSetItem | undefined) ?? null
}

export async function updateDryRunDeferred(
	itemId: string,
	observed: Date,
): Promise<void> {
	"use step"
	await db
		.update(resourceDryRuns)
		.set({
			action: "deferred",
			priorState: null,
			plannedState: null,
			plannedPrivate: null,
			requiresReplace: null,
			error: null,
			updatedAt: new Date(),
		})
		.where(
			and(
				eq(resourceDryRuns.changeSetItemId, itemId),
				eq(resourceDryRuns.updatedAt, observed),
			),
		)
}

// Structural-rejection paths — record as `action: error` so the row settles
// without retry, since no amount of retrying will fix the request shape:
//   - `BridgeDiagnosticError`: TF provider's semantic plan-time rejection
//     (e.g. "content-based dedup only on FIFO queues"). User config error.
//   - `BridgeTransportError` 4xx: Go bridge's wire-shape rejection before
//     the TF provider runs (e.g. object where schema wants list). Could be
//     user input via `--set-json`, or opsy's encoding pipeline; either way
//     retry won't help.
// 5xx and everything else (network blip, DB blip, schema parse bug, …)
// bubble so the step retries and/or the workflow fails loudly.
export async function planResourceDryRun(
	item: ChangeSetItem,
	projectId: string,
	inputs: unknown,
): Promise<ResourceDryRunPlan> {
	"use step"
	try {
		if (item.kind === "import_resource") {
			if (!item.integrationId) {
				return {
					action: "deferred",
					priorState: null,
					plannedState: null,
					plannedPrivate: null,
					requiresReplace: [],
					error: {
						message: `import item ${item.changes.slug} has no integration resolved`,
					},
				}
			}
			const integration = await getIntegrationById(
				projectId,
				item.integrationId,
			)
			// Probe the target by reading its import state now, so a non-existent
			// target surfaces as `error` in the dry-run review before deploy,
			// instead of only failing mid-apply (after the stub row is created and
			// then tombstoned). Import is read-only, so a clean read is noop.
			try {
				await readImportState(
					integration,
					item.changes.type,
					item.changes.identity ?? null,
					item.changes.providerId ?? null,
				)
			} catch (err) {
				if (err instanceof ImportNotFoundError) {
					return {
						action: "error",
						priorState: null,
						plannedState: null,
						plannedPrivate: null,
						requiresReplace: [],
						error: { message: err.message },
					}
				}
				throw err
			}
			return {
				action: "noop",
				priorState: null,
				plannedState: null,
				plannedPrivate: null,
				requiresReplace: [],
				error: null,
			}
		}

		if (item.kind === "create_resource") {
			if (!("type" in item.changes) || item.changes.type === undefined) {
				return {
					action: "noop",
					priorState: null,
					plannedState: null,
					plannedPrivate: null,
					requiresReplace: [],
					error: null,
				}
			}
			if (!item.integrationId) {
				return {
					action: "deferred",
					priorState: null,
					plannedState: null,
					plannedPrivate: null,
					requiresReplace: [],
					error: {
						message: `create item ${item.changes.slug} has no integration resolved`,
					},
				}
			}
			const integration = await getIntegrationById(
				projectId,
				item.integrationId,
			)
			const plan = await planResource(
				integration,
				item.changes.type,
				null,
				resourceState.nullable().parse(inputs),
				"create",
			)
			return {
				action: getResourceDryRunAction(
					plan.priorState,
					plan.plannedState,
					plan.requiresReplace,
					"create_resource",
				),
				...plan,
				error: null,
			}
		}

		if (item.kind === "delete_resource" && item.changes.mode === "forget") {
			// Forget stops managing the resource without touching the provider, so
			// there's no infra change to plan — always a noop, even when the target
			// row is already gone (tombstoned or hard-deleted).
			return {
				action: "noop",
				priorState: null,
				plannedState: null,
				plannedPrivate: null,
				requiresReplace: [],
				error: null,
			}
		}

		const target = await getResourceByChangeSetItem(projectId, item.id)
		if (!target?.integrationId) {
			return {
				action: "deferred",
				priorState: null,
				plannedState: null,
				plannedPrivate: null,
				requiresReplace: [],
				error: {
					message: target
						? `target resource ${target.slug} has no integration`
						: `target resource ${item.targetResourceSlug ?? item.targetResourceId} not found`,
				},
			}
		}

		if (item.kind === "delete_resource") {
			const integration = await getIntegrationById(
				projectId,
				target.integrationId,
			)
			const plan = await planResource(
				integration,
				target.type,
				target.identity,
				null,
				"delete",
			)
			return {
				action: getResourceDryRunAction(
					plan.priorState,
					plan.plannedState,
					plan.requiresReplace,
					"delete_resource",
				),
				...plan,
				error: null,
			}
		}

		// update_resource
		const integration = await getIntegrationById(
			projectId,
			target.integrationId,
		)
		const plan = await planResource(
			integration,
			target.type,
			target.identity,
			resourceState.nullable().parse(inputs),
			"update",
		)
		return {
			action: getResourceDryRunAction(
				plan.priorState,
				plan.plannedState,
				plan.requiresReplace,
				"update_resource",
			),
			...plan,
			error: null,
		}
	} catch (error) {
		const recoverable =
			error instanceof BridgeDiagnosticError ||
			(error instanceof BridgeTransportError &&
				error.status >= 400 &&
				error.status < 500)
		if (!recoverable) throw error
		const message = error instanceof Error ? error.message : String(error)
		return {
			action: "error",
			priorState: null,
			plannedState: null,
			plannedPrivate: null,
			requiresReplace: [],
			error: { message },
		}
	}
}

export async function updateDryRun(
	itemId: string,
	dryRun: ResourceDryRunPlan,
	observed: Date,
): Promise<void> {
	"use step"
	await db
		.update(resourceDryRuns)
		.set({
			action: dryRun.action,
			priorState: dryRun.priorState,
			plannedState: dryRun.plannedState,
			plannedPrivate: dryRun.plannedPrivate,
			requiresReplace:
				dryRun.requiresReplace && dryRun.requiresReplace.length > 0
					? dryRun.requiresReplace
					: null,
			error: dryRun.error,
			updatedAt: new Date(),
		})
		.where(
			and(
				eq(resourceDryRuns.changeSetItemId, itemId),
				eq(resourceDryRuns.updatedAt, observed),
			),
		)
}

// Terminal cleanup when the workflow body itself throws (DB blip during
// `getChangeSetItem`, ref-resolution crash, bridge 5xx that exhausted retries,
// …). Without this the row stays at `action: 'pending'` forever and the UI
// has no way to surface the failure or recover. Same CAS gate as
// `updateDryRun` so a concurrent re-stage / refresh that already raced ahead
// isn't clobbered.
export async function markDryRunFailed(
	itemId: string,
	observed: Date,
	message: string,
): Promise<void> {
	"use step"
	await db
		.update(resourceDryRuns)
		.set({
			action: "error",
			priorState: null,
			plannedState: null,
			plannedPrivate: null,
			requiresReplace: null,
			error: { message },
			updatedAt: new Date(),
		})
		.where(
			and(
				eq(resourceDryRuns.changeSetItemId, itemId),
				eq(resourceDryRuns.updatedAt, observed),
			),
		)
}

// Sibling dry-run lookup for ref substitution during dry-run planning. Pulls
// the most recent planned state per dependent slug from the same change set.
async function getChangeSetDryRunsBySlug(
	changeSetId: string,
	slugs: string[],
): Promise<
	Map<string, { action: ResourceDryRunAction; plannedState: State | null }>
> {
	if (slugs.length === 0) return new Map()
	const siblingRows = await db
		.select({
			id: changeSetItems.id,
			kind: changeSetItems.kind,
			targetResourceSlug: changeSetItems.targetResourceSlug,
			changesSlug: changeSetItemSlugFromChanges(changeSetItems.changes),
			action: resourceDryRuns.action,
			plannedState: resourceDryRuns.plannedState,
		})
		.from(changeSetItems)
		.leftJoin(
			resourceDryRuns,
			eq(resourceDryRuns.changeSetItemId, changeSetItems.id),
		)
		.where(
			and(
				eq(changeSetItems.changeSetId, changeSetId),
				or(
					inArray(changeSetItems.targetResourceSlug, slugs),
					inArray(changeSetItemSlugFromChanges(changeSetItems.changes), slugs),
				),
			),
		)

	const slugSet = new Set(slugs)
	const dryRunBySlug = new Map<
		string,
		{ action: ResourceDryRunAction; plannedState: State | null }
	>()
	for (const row of siblingRows) {
		const slug =
			row.kind === "create_resource" || row.kind === "import_resource"
				? row.changesSlug
				: row.targetResourceSlug
		if (!slug || !slugSet.has(slug)) continue
		// When the same slug appears as both a sibling create/import row and an
		// update row, the create/import row wins — it's the row that establishes
		// the slug in this change set, so its plannedState is the canonical
		// "what does X look like" for ref substitution. The update row's plan
		// describes a delta against an existing live resource and is irrelevant
		// for refs targeting the new slug.
		if (
			dryRunBySlug.has(slug) &&
			row.kind !== "create_resource" &&
			row.kind !== "import_resource"
		) {
			continue
		}
		dryRunBySlug.set(slug, {
			action: row.action ?? "pending",
			plannedState: row.plannedState ?? null,
		})
	}
	return dryRunBySlug
}

// Resolves `$ref` substitutions for dry-run planning by merging two sources:
// in-flight sibling planned states (for create/import/update items that
// haven't applied yet but exist in this change set) and persisted DB outputs
// (for non-sibling deps). If any sibling is unplanned, pending, or queued for
// delete we defer this dry-run rather than guess.
export async function getChangeSetDryRunInputs(
	item: ChangeSetItem,
	projectId: string,
): Promise<{ inputs: unknown; deferredOn: string[] }> {
	"use step"
	const inputs =
		item.kind === "create_resource"
			? "inputs" in item.changes
				? item.changes.inputs
				: null
			: item.kind === "update_resource"
				? item.changes.inputs
				: null
	const slugs = item.dependsOn
	if (slugs.length === 0) return { inputs, deferredOn: [] }

	const siblings = await getChangeSetDryRunsBySlug(item.changeSetId, slugs)
	const liveSlugs = slugs.filter((s) => !siblings.has(s))
	const liveTargets =
		liveSlugs.length > 0
			? await getReferenceTargetsBySlug(projectId, liveSlugs)
			: new Map<string, RefTarget>()

	const merged = new Map<string, RefTarget>()
	const deferredOn: string[] = []
	for (const slug of slugs) {
		const sib = siblings.get(slug)
		if (sib) {
			if (
				sib.action === "pending" ||
				sib.action === "deferred" ||
				sib.action === "delete" ||
				sib.plannedState == null
			) {
				deferredOn.push(slug)
				continue
			}
			merged.set(slug, {
				slug,
				ok: true,
				state: sib.plannedState,
			})
		} else {
			const live = liveTargets.get(slug)
			if (!live?.ok) {
				deferredOn.push(slug)
				continue
			}
			merged.set(slug, live)
		}
	}
	if (deferredOn.length > 0) return { inputs, deferredOn }
	return { inputs: substituteRefs(inputs, merged), deferredOn: [] }
}
