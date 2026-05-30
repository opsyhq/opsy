import type { Viewport } from "@xyflow/react"

type FocusViewportInput = {
	flowRect: { left: number; right: number; top: number; bottom: number }
	nodeRect: {
		left: number
		top: number
		width: number
		height: number
	}
	viewport: Viewport
	windowInnerWidth: number
	appRailWidth: number
	activityRailWidth: number
	detailPanelWidth: number
	inset?: number
	topInset?: number
	targetZoom?: number
}

// Centers a node inside the canvas area that's not covered by the app rail,
// the activity rail, or the detail panel on the right. Pure math; the DOM
// reads happen at the call site.
export function focusViewportFor({
	flowRect,
	nodeRect,
	viewport,
	windowInnerWidth,
	appRailWidth,
	activityRailWidth,
	detailPanelWidth,
	inset = 12,
	topInset = 64,
	targetZoom = 2,
}: FocusViewportInput): Viewport {
	const visibleLeft = Math.max(flowRect.left + inset, appRailWidth + inset)
	const visibleRight = Math.min(
		flowRect.right - inset,
		windowInnerWidth - activityRailWidth - inset - detailPanelWidth - inset,
	)
	const visibleTop = flowRect.top + topInset
	const visibleBottom = flowRect.bottom - inset
	const nodeCenterX =
		(nodeRect.left + nodeRect.width / 2 - flowRect.left - viewport.x) /
		viewport.zoom
	const nodeCenterY =
		(nodeRect.top + nodeRect.height / 2 - flowRect.top - viewport.y) /
		viewport.zoom

	return {
		x:
			(visibleLeft + visibleRight) / 2 -
			flowRect.left -
			nodeCenterX * targetZoom,
		y:
			(visibleTop + visibleBottom) / 2 -
			flowRect.top -
			nodeCenterY * targetZoom,
		zoom: targetZoom,
	}
}
