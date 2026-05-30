export const CANVAS_GRID: [number, number] = [16, 16]
export const CANVAS_EDGE_TYPE = "smoothstep"

// Left-drag draws a marquee selection; pan with middle (1) or right (2) mouse
// button. Trackpad/wheel panning still works via panOnScroll.
export const CANVAS_PAN_MOUSE_BUTTONS = [1, 2]

export const CANVAS_CONTROLS_CLASS =
	"overflow-hidden !rounded-lg !border !border-gray-200 !bg-white shadow-lg shadow-black/40 !left-[calc(var(--app-rail-width,52px)+8px)] !bottom-3 [transition:left_200ms_ease-out] [&_button]:!rounded-none [&_button]:!border-0 [&_button]:!border-t [&_button]:!border-gray-200 [&_button]:!bg-white [&_button]:!fill-gray-900 [&_button]:!text-gray-900 [&_button:first-child]:!border-t-0 hover:[&_button]:!bg-gray-100 [&_.rf-edge-toggle-on]:!bg-[var(--canvas-bg)] [&_.rf-edge-toggle-on]:!fill-white [&_.rf-edge-toggle-on]:!text-white hover:[&_.rf-edge-toggle-on]:!bg-[var(--canvas-bg)]"

export const RESOURCE_NODE_SIZE = {
	w: 192,
	h: 80,
}

export const DEFAULT_GROUP_SIZE = {
	w: 224,
	h: 112,
}

export const CONTAINER_PADDING = {
	top: 48,
	left: 16,
	right: 16,
	bottom: 16,
}

export const ROOT_PADDING = CANVAS_GRID[0]
export const NODE_GAP = 16
export const ROW_GAP = 16
export const ROOT_MAX_COLUMNS = 5
