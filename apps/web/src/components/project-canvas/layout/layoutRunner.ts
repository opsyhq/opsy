import { NODE_GAP, ROOT_PADDING, ROW_GAP } from "../canvasConstants"
import type { LayoutNodeSpec, LayoutResult } from "./layoutTypes"

type PositionedLayoutNode = LayoutNodeSpec & {
	x: number
	y: number
}

type LayoutBounds = {
	minX: number
	minY: number
	maxX: number
	maxY: number
}

const MAX_ROW_WIDTH = 2400
const MAX_COLUMN_HEIGHT = 1400

function nodeOrder(left: LayoutNodeSpec, right: LayoutNodeSpec): number {
	return left.order - right.order || left.id.localeCompare(right.id)
}

function groupOrder(
	left: { key: string; nodes: LayoutNodeSpec[] },
	right: { key: string; nodes: LayoutNodeSpec[] },
): number {
	return (
		left.key.localeCompare(right.key) ||
		(left.nodes[0]?.order ?? 0) - (right.nodes[0]?.order ?? 0)
	)
}

function nodeCenter(node: LayoutNodeSpec): { x: number; y: number } | null {
	if (!node.position) return null
	return {
		x: node.position.x + node.width / 2,
		y: node.position.y + node.height / 2,
	}
}

function componentBounds(nodes: PositionedLayoutNode[]): LayoutBounds {
	return nodes.reduce<LayoutBounds>(
		(bounds, node) => ({
			minX: Math.min(bounds.minX, node.x - node.width / 2),
			minY: Math.min(bounds.minY, node.y - node.height / 2),
			maxX: Math.max(bounds.maxX, node.x + node.width / 2),
			maxY: Math.max(bounds.maxY, node.y + node.height / 2),
		}),
		{
			minX: Number.POSITIVE_INFINITY,
			minY: Number.POSITIVE_INFINITY,
			maxX: Number.NEGATIVE_INFINITY,
			maxY: Number.NEGATIVE_INFINITY,
		},
	)
}

function layoutTypeColumns(nodes: LayoutNodeSpec[]): LayoutNodeSpec[][] {
	const columns: LayoutNodeSpec[][] = []
	let current: LayoutNodeSpec[] = []
	let height = 0
	for (const node of [...nodes].sort(nodeOrder)) {
		const nextHeight = height + (current.length > 0 ? ROW_GAP : 0) + node.height
		if (current.length > 0 && nextHeight > MAX_COLUMN_HEIGHT) {
			columns.push(current)
			current = []
			height = 0
		}
		current.push(node)
		height += (current.length > 1 ? ROW_GAP : 0) + node.height
	}
	if (current.length > 0) columns.push(current)
	return columns
}

function layoutGroup(nodes: LayoutNodeSpec[]): PositionedLayoutNode[] {
	const positioned: PositionedLayoutNode[] = []
	let columnX = 0
	for (const column of layoutTypeColumns(nodes)) {
		const width = Math.max(...column.map((node) => node.width))
		let itemY = 0
		for (const item of column) {
			positioned.push({
				...item,
				x: columnX + item.width / 2,
				y: itemY + item.height / 2,
			})
			itemY += item.height + ROW_GAP
		}
		columnX += width + NODE_GAP
	}
	return positioned
}

export async function runCanvasLayout(
	nodes: LayoutNodeSpec[],
): Promise<LayoutResult> {
	const hasUnpositioned = nodes.some((node) => !node.position)
	if (!hasUnpositioned) return { positions: {}, sizes: {} }

	const groupedByType = new Map<string, LayoutNodeSpec[]>()
	for (const node of nodes) {
		const key = node.layoutType ?? "resource"
		const items = groupedByType.get(key) ?? []
		items.push(node)
		groupedByType.set(key, items)
	}

	const groups = [...groupedByType].map(([key, groupNodes]) => ({
		key,
		nodes: groupNodes,
	}))
	groups.sort(groupOrder)

	const positions: LayoutResult["positions"] = {}
	let cursorX = ROOT_PADDING
	let cursorY = ROOT_PADDING
	let rowHeight = 0

	for (const group of groups) {
		const laidOut = layoutGroup(group.nodes)
		const bounds = componentBounds(laidOut)
		const groupWidth = bounds.maxX - bounds.minX
		const groupHeight = bounds.maxY - bounds.minY
		const hasSavedPosition = group.nodes.some((item) => item.position)
		const shouldPack =
			!hasSavedPosition &&
			cursorX > ROOT_PADDING &&
			cursorX + groupWidth > ROOT_PADDING + MAX_ROW_WIDTH
		if (shouldPack) {
			cursorX = ROOT_PADDING
			cursorY += rowHeight + ROW_GAP * 2
			rowHeight = 0
		}
		const anchor = [...group.nodes]
			.sort(nodeOrder)
			.find((item) => item.position)
		const anchorLayout = anchor
			? laidOut.find((item) => item.id === anchor.id)
			: undefined
		const anchorCenter = anchor ? nodeCenter(anchor) : null
		const offsetX =
			anchorCenter && anchorLayout
				? anchorCenter.x - anchorLayout.x
				: cursorX - bounds.minX
		const offsetY =
			anchorCenter && anchorLayout
				? anchorCenter.y - anchorLayout.y
				: cursorY - bounds.minY
		for (const item of laidOut) {
			if (item.position) continue
			positions[item.id] = {
				x: item.x - item.width / 2 + offsetX,
				y: item.y - item.height / 2 + offsetY,
			}
		}
		if (!hasSavedPosition) {
			cursorX += groupWidth + NODE_GAP * 2
			rowHeight = Math.max(rowHeight, groupHeight)
		}
	}

	return { positions, sizes: {} }
}
