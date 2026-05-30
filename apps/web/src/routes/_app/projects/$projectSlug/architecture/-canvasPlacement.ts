import {
	NODE_GAP,
	RESOURCE_NODE_SIZE,
	ROOT_MAX_COLUMNS,
	ROOT_PADDING,
	ROW_GAP,
} from "@/components/project-canvas/canvasConstants"

type PositionedResource = {
	position: { x: number; y: number } | null
}

export function nextStagedResourcePosition(input: {
	resources: PositionedResource[]
	previewIndex: number
}): { x: number; y: number } {
	const occupied = input.resources
		.map((resource) => resource.position)
		.filter(
			(position): position is { x: number; y: number } => position !== null,
		)
	const maxY =
		occupied.length > 0
			? Math.max(...occupied.map((position) => position.y))
			: ROOT_PADDING
	const startY = maxY + 128
	return {
		x:
			ROOT_PADDING +
			(input.previewIndex % ROOT_MAX_COLUMNS) *
				(RESOURCE_NODE_SIZE.w + NODE_GAP),
		y:
			startY +
			Math.floor(input.previewIndex / ROOT_MAX_COLUMNS) *
				(RESOURCE_NODE_SIZE.h + ROW_GAP),
	}
}
