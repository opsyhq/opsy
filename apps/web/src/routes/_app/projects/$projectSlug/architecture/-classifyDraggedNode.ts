import type { Node } from "@xyflow/react"
import type { CanvasChangeSetItem } from "@/components/project-canvas/changeSetRuntime"
import { type ChangeSetItem, changesRecord } from "@/lib/changeSetReactQuery"

export type DraggedNodeAction =
	| {
			kind: "stagedPosition"
			itemId: string
			itemKind: ChangeSetItem["kind"]
			position: { x: number; y: number }
			changes: Record<string, unknown>
	  }
	| {
			kind: "liveLayout"
			slug: string
			position: { x: number; y: number }
	  }

// React Flow passes every dragged node to onNodeDragStop. Each one is either:
//   - a staged create-like draft (push position into the change-set item, but
//     only if it belongs to the current draft change-set — applied/virtual
//     items are immutable),
//   - a live resource (persist position via the layout endpoint), or
//   - null when we can't act on it.
// Returning a discriminated union keeps the component branching declarative
// and testable in isolation from the React Flow context.
export function classifyDraggedNode(
	node: Node,
	draftItemIds: ReadonlySet<string> | null | undefined,
	activeItems: readonly CanvasChangeSetItem[],
): DraggedNodeAction | null {
	const data = node.data ?? {}
	const stagedId =
		typeof data.stageItemId === "string" ? data.stageItemId : null
	const stagedKind =
		typeof data.stageKind === "string"
			? (data.stageKind as ChangeSetItem["kind"])
			: null
	if (
		stagedId &&
		(stagedKind === "create_resource" || stagedKind === "import_resource")
	) {
		if (!draftItemIds?.has(stagedId)) return null
		const item = activeItems.find((candidate) => candidate.id === stagedId)
		if (!item) return null
		return {
			kind: "stagedPosition",
			itemId: stagedId,
			itemKind: stagedKind,
			position: node.position,
			changes: { ...changesRecord(item), position: node.position },
		}
	}
	return {
		kind: "liveLayout",
		slug: node.id,
		position: node.position,
	}
}
