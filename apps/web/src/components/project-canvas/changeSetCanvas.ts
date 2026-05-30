import type { ChangeSetItemRuntimePhase } from "@/components/project-canvas/changeSetRuntime"
import { type ChangeSetItem, changesRecord } from "@/lib/changeSetReactQuery"

type OperationStatusBearer = {
	status:
		| "pending"
		| "running"
		| "awaiting_approval"
		| "canceling"
		| "succeeded"
		| "failed"
		| "canceled"
}

export function itemSlug(item: ChangeSetItem): string | null {
	if (item.kind === "update_resource" || item.kind === "delete_resource") {
		return item.targetResourceSlug
	}
	const slug = changesRecord(item).slug
	return typeof slug === "string" ? slug : null
}

export function itemPosition(
	item: ChangeSetItem,
): { x: number; y: number } | null {
	const position = changesRecord(item).position
	return position &&
		typeof position === "object" &&
		!Array.isArray(position) &&
		"x" in position &&
		"y" in position &&
		typeof position.x === "number" &&
		typeof position.y === "number"
		? { x: position.x, y: position.y }
		: null
}

export function itemPhase<TOp extends OperationStatusBearer>(
	item: ChangeSetItem,
	operation: TOp | null,
): ChangeSetItemRuntimePhase {
	if (!operation) return "staged"
	if (operation.status === "failed") return "failed"
	if (operation.status === "canceled") return "canceled"
	if (operation.status === "succeeded") return "done"
	if (operation.status !== "running") return "pending"
	if (item.kind === "delete_resource") return "deleting"
	if (item.kind === "import_resource") return "importing"
	if (item.kind === "update_resource") return "updating"
	return "creating"
}
