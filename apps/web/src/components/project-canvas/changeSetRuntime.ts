import type { ChangeSetItem } from "@/lib/changeSetReactQuery"

export type ChangeSetItemRuntimePhase =
	| "staged"
	| "pending"
	| "creating"
	| "importing"
	| "updating"
	| "deleting"
	| "done"
	| "failed"
	| "canceled"

export type ChangeSetItemRunningPhase =
	| "creating"
	| "updating"
	| "deleting"
	| "importing"

export function isRunningPhase(
	phase: ChangeSetItemRuntimePhase,
): phase is ChangeSetItemRunningPhase {
	return (
		phase === "creating" ||
		phase === "updating" ||
		phase === "deleting" ||
		phase === "importing"
	)
}

export type ChangeSetItemRuntime<TOperation = unknown, TResource = unknown> = {
	operation: TOperation | null
	resource: TResource | null
	phase: ChangeSetItemRuntimePhase
	position: { x: number; y: number } | null
}

export type CanvasChangeSetItem<
	TOperation = unknown,
	TResource = unknown,
> = ChangeSetItem & {
	runtime: ChangeSetItemRuntime<TOperation, TResource>
}

export function hasChangeSetItemRuntime(
	item: ChangeSetItem,
): item is CanvasChangeSetItem {
	return "runtime" in item
}
