import { eq } from "drizzle-orm"
import { db } from "../lib/db/client"
import { resourceDryRuns, type StoredResourceDryRun } from "../lib/db/schema"
import type { ResourcePlan } from "./workflows/steps"

export type ResourceDryRunAction = StoredResourceDryRun["action"]

type ResourceDryRunItemKind =
	| "create_resource"
	| "update_resource"
	| "delete_resource"
	| "import_resource"

// Reconstitutes the cached plan the user reviewed at dry-run time. Apply
// hands this to the bridge as the seed for its re-Plan; config gets freshly
// inlined at apply because by then sibling-ref parents have actually applied,
// and the bridge's apply uses the re-plan output rather than the stored
// plannedState. Drift in the target's prior state is caught by the bridge's
// ReadResource → re-Plan → Diverged action check.
export async function getCachedResourcePlan(
	changeSetItemId: string,
): Promise<ResourcePlan> {
	"use step"
	const row = await db.query.resourceDryRuns.findFirst({
		where: eq(resourceDryRuns.changeSetItemId, changeSetItemId),
	})
	if (!row) {
		throw new Error(`no cached dry-run for change set item ${changeSetItemId}`)
	}
	if (
		row.action === "pending" ||
		row.action === "deferred" ||
		row.action === "error"
	) {
		throw new Error(
			`cached dry-run for change set item ${changeSetItemId} is ${row.action}`,
		)
	}
	return {
		priorState: row.priorState,
		plannedState: row.plannedState,
		plannedPrivate: row.plannedPrivate,
		requiresReplace: row.requiresReplace ?? [],
	}
}

export function getResourceDryRunAction(
	priorState: unknown,
	plannedState: unknown,
	requiresReplace: string[][] | null,
	itemKind: ResourceDryRunItemKind,
): ResourceDryRunAction {
	if (itemKind === "import_resource") return "noop"
	if (priorState == null && plannedState == null) return "noop"
	if (priorState == null) return "create"
	if (plannedState == null) return "delete"
	if (requiresReplace && requiresReplace.length > 0) return "replace"
	return "update"
}
