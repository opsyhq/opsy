import { and, eq, gte, inArray, isNull } from "drizzle-orm"
import { db } from "../lib/db/client"
import {
	type ChangeSetItem,
	changeSetItems,
	operations,
	type Project,
	resources,
} from "../lib/db/schema"
import { OPEN_OPERATION_STATUSES } from "../operations/operations"
import type { ApplyPlanBlocker, ApplyPlanLiveResource } from "./plan"

// Pure structural validation: produces a Map<itemId, issue> from the items
// plus the project's live-resource snapshot and the set of currently locked
// keys (from open operations). Callers (review, apply, view) load that
// context once and pass it in — there's no DB access here so the function
// can run in the request path and be re-derived on every read.

export type ValidationIssue = { itemId: string; message: string }

export type StructuralValidationContext = {
	liveResources: ApplyPlanLiveResource[]
	lockedKeys: ReadonlySet<string>
	// Items whose latest content has a current succeeded operation. The
	// "already exists" check skips these so a resumed apply (where the create
	// op succeeded but a sibling failed) doesn't trip on the live row the
	// successful op just materialized.
	currentlySucceededItemIds: ReadonlySet<string>
}

// Snapshot the project's live resources + open-operation lock keys for one
// validation pass. View time loads this once per project and re-uses it
// across every changeset in the response.
export async function getStructuralValidationContext(
	project: Project,
): Promise<StructuralValidationContext> {
	const [liveResources, openLocks, succeededRows] = await Promise.all([
		db.query.resources.findMany({
			where: and(
				eq(resources.projectId, project.id),
				isNull(resources.deletedAt),
			),
			columns: {
				id: true,
				slug: true,
				dependsOn: true,
				deletedAt: true,
			},
		}),
		db.query.operations.findMany({
			where: and(
				eq(operations.projectId, project.id),
				inArray(operations.status, [...OPEN_OPERATION_STATUSES]),
			),
			columns: { lockKey: true },
		}),
		db
			.select({ itemId: changeSetItems.id })
			.from(operations)
			.innerJoin(
				changeSetItems,
				eq(operations.changeSetItemId, changeSetItems.id),
			)
			.where(
				and(
					eq(operations.projectId, project.id),
					eq(operations.status, "succeeded"),
					gte(operations.createdAt, changeSetItems.updatedAt),
				),
			),
	])
	const lockedKeys = new Set(
		openLocks
			.map((op) => op.lockKey)
			.filter((key): key is string => key !== null),
	)
	const currentlySucceededItemIds = new Set(
		succeededRows.map((row) => row.itemId),
	)
	return { liveResources, lockedKeys, currentlySucceededItemIds }
}

type ParsedChangeSetItem =
	| {
			item: ChangeSetItem
			kind: "create_resource"
			slug: string
			inputs: unknown
	  }
	| {
			item: ChangeSetItem
			kind: "import_resource"
			slug: string
	  }
	| {
			item: ChangeSetItem
			kind: "update_resource"
			targetSlug: string
			inputs: unknown
	  }
	| {
			item: ChangeSetItem
			kind: "delete_resource"
			targetSlug: string
			mode: "delete" | "forget"
	  }

function parseChangeSetItemForValidation(
	item: ChangeSetItem,
	issues: Map<string, ValidationIssue>,
): ParsedChangeSetItem | null {
	if (item.kind === "create_resource") {
		return {
			item,
			kind: item.kind,
			slug: item.changes.slug,
			inputs: "inputs" in item.changes ? item.changes.inputs : undefined,
		}
	}
	if (item.kind === "import_resource") {
		return {
			item,
			kind: item.kind,
			slug: item.changes.slug,
		}
	}
	if (item.kind === "update_resource") {
		const targetSlug = item.targetResourceSlug
		if (!targetSlug) {
			if (!issues.has(item.id))
				issues.set(item.id, {
					itemId: item.id,
					message: "update item missing target slug",
				})
			return null
		}
		return {
			item,
			kind: item.kind,
			targetSlug,
			inputs: item.changes.inputs,
		}
	}
	const targetSlug = item.targetResourceSlug
	if (!targetSlug) {
		if (!issues.has(item.id))
			issues.set(item.id, {
				itemId: item.id,
				message: "delete item missing target slug",
			})
		return null
	}
	return {
		item,
		kind: "delete_resource",
		targetSlug,
		mode: item.changes.mode,
	}
}

export function validateChangeSetItems(
	items: ChangeSetItem[],
	context: StructuralValidationContext,
	blockers: ApplyPlanBlocker[],
): Map<string, ValidationIssue> {
	const issues = new Map<string, ValidationIssue>()
	const recordIssue = (itemId: string, message: string) => {
		if (!issues.has(itemId)) issues.set(itemId, { itemId, message })
	}

	const parsedItems = items
		.map((item) => parseChangeSetItemForValidation(item, issues))
		.filter((item): item is ParsedChangeSetItem => item !== null)

	const { liveResources, lockedKeys, currentlySucceededItemIds } = context
	const liveBySlug = new Map(liveResources.map((row) => [row.slug, row]))
	const liveById = new Map(liveResources.map((row) => [row.id, row]))
	const stagedCreateBySlug = new Map<string, ParsedChangeSetItem>()
	const deletedSlugs = new Set<string>()
	const deleteItemsBySlug = new Map<string, ParsedChangeSetItem>()
	const updateItemsBySlug = new Map<string, ParsedChangeSetItem[]>()
	const lockKeysByItemId = new Map<string, string>()

	for (const parsed of parsedItems) {
		if (
			parsed.kind === "create_resource" ||
			parsed.kind === "import_resource"
		) {
			// Create/import items don't have a `resource:<id>` lock until apply
			// allocates the row+op atomically (no `slug:*` phase anymore). Mutual
			// exclusion of duplicate slugs comes from the resources partial unique
			// index + the staged-create dup check below.
			const previous = stagedCreateBySlug.get(parsed.slug)
			if (previous) {
				recordIssue(parsed.item.id, `duplicate staged slug ${parsed.slug}`)
			} else {
				stagedCreateBySlug.set(parsed.slug, parsed)
			}
			// If this item's current op already succeeded, the live row is its
			// own product — suppress the "already exists" flag so a resumed
			// apply doesn't reject the item that already created the row.
			if (
				liveBySlug.has(parsed.slug) &&
				!currentlySucceededItemIds.has(parsed.item.id)
			) {
				recordIssue(parsed.item.id, `resource ${parsed.slug} already exists`)
			}
			continue
		}

		const liveTarget =
			liveBySlug.get(parsed.targetSlug) ??
			(parsed.item.targetResourceId
				? liveById.get(parsed.item.targetResourceId)
				: undefined)
		if (!liveTarget) {
			// Forget just stops managing a resource, so an already-gone target
			// (tombstoned or hard-deleted) is a no-op rather than an error — don't
			// block the changeset on it. Managed delete still requires a live row.
			if (!(parsed.kind === "delete_resource" && parsed.mode === "forget")) {
				recordIssue(
					parsed.item.id,
					`target resource ${parsed.targetSlug} not found`,
				)
			}
		} else {
			lockKeysByItemId.set(parsed.item.id, `resource:${liveTarget.id}`)
		}
		if (parsed.kind === "delete_resource") {
			const previous = deleteItemsBySlug.get(parsed.targetSlug)
			if (previous) {
				recordIssue(
					parsed.item.id,
					`duplicate delete for ${parsed.targetSlug}`,
				)
			} else {
				deleteItemsBySlug.set(parsed.targetSlug, parsed)
			}
			deletedSlugs.add(parsed.targetSlug)
		} else {
			const updates = updateItemsBySlug.get(parsed.targetSlug) ?? []
			if (updates.length > 0) {
				recordIssue(
					parsed.item.id,
					`duplicate update for ${parsed.targetSlug}`,
				)
			}
			updates.push(parsed)
			updateItemsBySlug.set(parsed.targetSlug, updates)
		}
	}

	for (const [slug, updates] of updateItemsBySlug) {
		if (!deleteItemsBySlug.has(slug)) continue
		for (const update of updates) {
			recordIssue(
				update.item.id,
				`cannot update ${slug} because it is also staged for delete`,
			)
		}
	}

	const availableSlugs = new Set(liveResources.map((row) => row.slug))
	for (const parsed of parsedItems) {
		if (parsed.kind === "delete_resource") {
			availableSlugs.delete(parsed.targetSlug)
			continue
		}
		if (
			parsed.kind === "create_resource" ||
			parsed.kind === "import_resource"
		) {
			availableSlugs.add(parsed.slug)
		}
	}

	for (const parsed of parsedItems) {
		if (parsed.kind !== "create_resource" && parsed.kind !== "update_resource")
			continue
		const ownSlug =
			parsed.kind === "create_resource" ? parsed.slug : parsed.targetSlug
		for (const refSlug of parsed.item.dependsOn) {
			if (refSlug === ownSlug) {
				recordIssue(
					parsed.item.id,
					`resource ${ownSlug} cannot reference itself`,
				)
				continue
			}
			if (deletedSlugs.has(refSlug) || !availableSlugs.has(refSlug)) {
				recordIssue(
					parsed.item.id,
					`referenced resource ${refSlug} is missing or staged for delete`,
				)
			}
		}
	}

	for (const [itemId, lockKey] of lockKeysByItemId) {
		if (!lockedKeys.has(lockKey)) continue
		recordIssue(itemId, "target resource or slug is locked by an open operation")
	}

	for (const blocker of blockers) {
		recordIssue(blocker.itemId, blocker.message)
	}

	return issues
}
