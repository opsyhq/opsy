export type LayoutNodeSpec = {
	id: string
	width: number
	height: number
	isContainer?: boolean
	position?: { x: number; y: number }
	order: number
	layoutType?: string
}

export type LayoutResult = {
	positions: Record<string, { x: number; y: number }>
	sizes: Record<string, { w: number; h: number }>
}
