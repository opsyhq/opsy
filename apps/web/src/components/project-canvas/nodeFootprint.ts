import { getResourceTypeKey } from "@/components/project-canvas/resourceRelationships"
import {
	CANVAS_GRID,
	DEFAULT_GROUP_SIZE,
	RESOURCE_NODE_SIZE,
} from "./canvasConstants"
import type { ResourceNodeNestedItem } from "./nodes/ResourceNode"
import type { ResourceLike } from "./resourceProjection"

export type ResourceDisplayMode = "card" | "compact" | "chip"
type CanvasSize = NonNullable<ResourceLike["size"]>
export type DisplayByTypeKey = Map<string, ResourceDisplayMode>

export const MAX_VISIBLE_TOP_EDGE_ITEMS = 3
export const TOP_EDGE_ITEM_HEIGHT = CANVAS_GRID[1]
export const BOTTOM_TUCKED_CHIP_HEIGHT = CANVAS_GRID[1] * 2
export const BOTTOM_TUCK_OVERLAP = CANVAS_GRID[1] / 4
export const BOTTOM_TUCKED_CHIP_STRIDE =
	BOTTOM_TUCKED_CHIP_HEIGHT - BOTTOM_TUCK_OVERLAP

export const RESOURCE_NODE_SIZES: Record<ResourceDisplayMode, CanvasSize> = {
	card: RESOURCE_NODE_SIZE,
	compact: { w: CANVAS_GRID[0] * 10, h: CANVAS_GRID[1] * 4 },
	chip: { w: RESOURCE_NODE_SIZE.w, h: CANVAS_GRID[1] * 2 },
}

export type NodeFootprint = {
	bodySize: CanvasSize
	layoutSize: CanvasSize
	render: {
		bodyHeight: number
		topEdgeHeight: number
		bottomTuckedOverlap: number
	}
}

export function resourceDisplay(
	resource: ResourceLike,
	displayByTypeKey: DisplayByTypeKey,
): ResourceDisplayMode {
	if (resource.componentHostSlug) return "chip"
	const key = getResourceTypeKey(resource)
	const display = key ? displayByTypeKey.get(key) : undefined
	if (display === "compact" || display === "chip") return display
	return "card"
}

// Single owner of the canvas status-dot tone. `staged` is green (a clean
// preview), in-flight verbs + pending are warn, missing is its own orange,
// failed/deleted are err, everything else (live) is ok.
export function statusToneClass(status: string): string {
	if (status === "staged") return "bg-green-500"
	if (status === "failed" || status === "deleted") return "bg-canvas-err"
	if (status === "missing") return "bg-orange-500"
	if (
		status === "creating" ||
		status === "updating" ||
		status === "deleting" ||
		status === "importing" ||
		status === "pending"
	) {
		return "bg-canvas-warn"
	}
	return "bg-canvas-ok"
}

export function flattenBottomTuckedItems(
	items: ResourceNodeNestedItem[] = [],
): ResourceNodeNestedItem[] {
	return items.flatMap((item) => [
		item,
		...flattenBottomTuckedItems(item.bottomTuckedItems),
	])
}

export function computeNodeFootprint(
	resource: ResourceLike,
	options: { isContainer: boolean; displayByTypeKey: DisplayByTypeKey },
): NodeFootprint {
	const display = resourceDisplay(resource, options.displayByTypeKey)
	const baseSize = options.isContainer
		? DEFAULT_GROUP_SIZE
		: RESOURCE_NODE_SIZES[display]
	const topEdgeHeight =
		display === "chip" || options.isContainer
			? 0
			: (resource.topEdgeItems?.length ?? 0) > 0
				? TOP_EDGE_ITEM_HEIGHT
				: 0
	const bottomRows =
		display === "chip"
			? 0
			: flattenBottomTuckedItems(resource.bottomTuckedItems).length
	const bottomTuckedHeight =
		bottomRows > 0
			? BOTTOM_TUCKED_CHIP_HEIGHT +
				(bottomRows - 1) * BOTTOM_TUCKED_CHIP_STRIDE -
				BOTTOM_TUCK_OVERLAP
			: 0
	const bodySize = {
		w: baseSize.w,
		h: baseSize.h,
	}

	return {
		bodySize,
		layoutSize: {
			w: bodySize.w,
			h: bodySize.h + topEdgeHeight + bottomTuckedHeight,
		},
		render: {
			bodyHeight: bodySize.h,
			topEdgeHeight,
			bottomTuckedOverlap: BOTTOM_TUCK_OVERLAP,
		},
	}
}

export function maxSize(left: CanvasSize, right: CanvasSize): CanvasSize {
	return {
		w: Math.max(left.w, right.w),
		h: Math.max(left.h, right.h),
	}
}
