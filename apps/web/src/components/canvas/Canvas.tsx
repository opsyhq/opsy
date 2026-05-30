import type { Edge, Node, Viewport } from "@xyflow/react"
import {
	Background,
	BackgroundVariant,
	ConnectionLineType,
	Controls,
	type EdgeChange,
	type NodeChange,
	type NodeTypes,
	type OnNodeDrag,
	ReactFlow,
	SelectionMode,
} from "@xyflow/react"
import type { MouseEvent as ReactMouseEvent, ReactNode } from "react"
import {
	CANVAS_CONTROLS_CLASS,
	CANVAS_EDGE_TYPE,
	CANVAS_GRID,
	CANVAS_PAN_MOUSE_BUTTONS,
} from "@/components/project-canvas/canvasConstants"

export type CanvasProps = {
	nodes: Node[]
	edges: Edge[]
	nodeTypes: NodeTypes
	onNodesChange: (changes: NodeChange[]) => void
	onEdgesChange: (changes: EdgeChange[]) => void
	onNodeDragStop: OnNodeDrag
	onNodeClick: (event: ReactMouseEvent, node: Node) => void
	onNodeMouseEnter?: (event: ReactMouseEvent, node: Node) => void
	onNodeMouseLeave?: (event: ReactMouseEvent, node: Node) => void
	onEdgeClick?: (event: ReactMouseEvent, edge: Edge) => void
	onPaneClick?: () => void
	onViewportChange?: (viewport: Viewport) => void
	defaultViewport?: Viewport
	controls?: ReactNode
	children?: ReactNode
}

const DEFAULT_EDGE_OPTIONS = {
	type: CANVAS_EDGE_TYPE,
	style: { stroke: "var(--canvas-border-hover)", strokeWidth: 1.5 },
}

export function Canvas({
	nodes,
	edges,
	nodeTypes,
	onNodesChange,
	onEdgesChange,
	onNodeDragStop,
	onNodeClick,
	onNodeMouseEnter,
	onNodeMouseLeave,
	onEdgeClick,
	onPaneClick,
	onViewportChange,
	defaultViewport,
	controls,
	children,
}: CanvasProps) {
	return (
		<div className="relative h-full w-full overflow-hidden bg-canvas-bg">
			<ReactFlow
				nodes={nodes}
				edges={edges}
				nodeTypes={nodeTypes}
				onNodesChange={onNodesChange}
				onEdgesChange={onEdgesChange}
				onNodeDragStop={onNodeDragStop}
				onNodeClick={onNodeClick}
				onNodeMouseEnter={onNodeMouseEnter}
				onNodeMouseLeave={onNodeMouseLeave}
				onEdgeClick={onEdgeClick}
				onPaneClick={onPaneClick}
				onViewportChange={onViewportChange}
				defaultViewport={defaultViewport}
				elevateNodesOnSelect={false}
				panOnScroll
				selectionOnDrag
				selectionMode={SelectionMode.Partial}
				panOnDrag={CANVAS_PAN_MOUSE_BUTTONS}
				snapToGrid
				snapGrid={CANVAS_GRID}
				zIndexMode="manual"
				nodesFocusable={false}
				edgesFocusable={false}
				disableKeyboardA11y
				proOptions={{ hideAttribution: true }}
				defaultEdgeOptions={DEFAULT_EDGE_OPTIONS}
				connectionLineType={ConnectionLineType.SmoothStep}
			>
				<Background
					variant={BackgroundVariant.Dots}
					gap={16}
					size={1}
					offset={0.5}
					color="var(--canvas-dots)"
				/>
				<Controls className={CANVAS_CONTROLS_CLASS}>{controls}</Controls>
			</ReactFlow>
			{children}
		</div>
	)
}
