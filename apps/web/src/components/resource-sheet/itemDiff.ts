import { isRecord } from "@/lib/changeDiff"
import type { ChangeSetItem, ResourceDryRun } from "@/lib/changeSetReactQuery"

export type ItemDiff =
	| { kind: "destroy"; mode: "delete" | "forget" }
	| {
			kind: "fields"
			before: unknown
			after: unknown
			status: "settled" | "computing" | "failed"
			error: { message: string } | null
	  }

function itemInputs(value: unknown): unknown {
	if (!isRecord(value)) return value
	return "inputs" in value ? value.inputs : value
}

function intentFallback(item: ChangeSetItem): {
	before: unknown
	after: unknown
} {
	return { before: null, after: itemInputs(item.changes) }
}

// For create/import, strip plannedState of fields the user didn't ask for that
// came back null — provider-computed/default fields show up as noise otherwise
// (every schema key with `null`). Nested intent is honored: if the user typed
// `versioning.enabled`, sibling `versioning.mfa_delete: null` is dropped, but
// `versioning.enabled: null` would survive (user's explicit null).
function pruneUntouchedNulls(planned: unknown, intent: unknown): unknown {
	if (!isRecord(planned)) return planned
	const intentRecord = isRecord(intent) ? intent : {}
	const result: Record<string, unknown> = {}
	for (const key of Object.keys(planned)) {
		const value = planned[key]
		const inIntent = key in intentRecord
		if (value === null && !inIntent) continue
		result[key] = isRecord(value)
			? pruneUntouchedNulls(value, intentRecord[key])
			: value
	}
	return result
}

export function resolveItemDiff(
	item: ChangeSetItem,
	dryRun: ResourceDryRun | null,
): ItemDiff {
	if (item.kind === "delete_resource") {
		const changes = isRecord(item.changes) ? item.changes : {}
		return {
			kind: "destroy",
			mode: changes.mode === "forget" ? "forget" : "delete",
		}
	}

	if (!dryRun || dryRun.action === "pending") {
		const fallback = intentFallback(item)
		return {
			kind: "fields",
			before: fallback.before,
			after: fallback.after,
			status: "computing",
			error: null,
		}
	}
	if (dryRun.action === "error") {
		const fallback = intentFallback(item)
		return {
			kind: "fields",
			before: fallback.before,
			after: fallback.after,
			status: "failed",
			error: dryRun.error,
		}
	}
	const after =
		item.kind === "create_resource" || item.kind === "import_resource"
			? pruneUntouchedNulls(dryRun.plannedState, itemInputs(item.changes))
			: dryRun.plannedState
	return {
		kind: "fields",
		before: dryRun.priorState,
		after,
		status: "settled",
		error: null,
	}
}
