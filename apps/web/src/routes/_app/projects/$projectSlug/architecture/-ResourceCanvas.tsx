import {
	ControlButton,
	type NodeTypes,
	useEdgesState,
	useNodesInitialized,
	useNodesState,
	useReactFlow,
	type Viewport,
} from "@xyflow/react"
import { LayoutGrid, Network } from "lucide-react"
import { memo, useEffect, useMemo } from "react"
import { Canvas } from "@/components/canvas/Canvas"
import type { CanvasModel } from "@/components/canvas/canvasModel"
import {
	CanvasContext,
	type CanvasContextValue,
} from "@/components/project-canvas/canvasContext"
import { ResourceNode } from "@/components/project-canvas/nodes/ResourceNode"
import { customNodes } from "@/components/project-canvas/nodes/registry.generated"
import { RelationshipEdgeInspector } from "@/components/project-canvas/RelationshipEdgeInspector"
import { toFlowEdges } from "@/components/project-canvas/toFlowEdges"
import { toFlowNodes } from "@/components/project-canvas/toFlowNodes"
import { useCanvasLayout } from "./-hooks/useCanvasLayout"
import { useCanvasSelection } from "./-hooks/useCanvasSelection"

function ResourceCanvasImpl({
	projectSlug,
	model,
	onSelectStagedItem,
	onSelectResource,
	onStagedPositionChange,
	onStagedPositionClear,
	defaultViewport,
	onViewportChange,
	pendingFocusSlug,
	pendingFocusMode,
	onFocusConsumed,
}: {
	projectSlug: string
	model: CanvasModel
	onSelectStagedItem?: (itemId: string) => void
	onSelectResource?: (slug: string) => void
	onStagedPositionChange?: (
		itemId: string,
		position: { x: number; y: number },
	) => void
	onStagedPositionClear?: (itemId: string) => void
	defaultViewport?: Viewport
	onViewportChange?: (viewport: Viewport) => void
	pendingFocusSlug?: string | null
	pendingFocusMode?: "fit" | "panel"
	onFocusConsumed?: () => void
}) {
	const { fitView, setViewport, getViewport } = useReactFlow()
	const nodesInitialized = useNodesInitialized()

	const resources = model.resources
	const stagedUpdatesBySlug = model.stagedUpdatesBySlug
	const displayByTypeKey = model.displayByTypeKey

	const [nodes, setNodes, onNodesChange] = useNodesState(
		toFlowNodes({ resources, stagedUpdatesBySlug, displayByTypeKey }),
	)
	useEffect(() => {
		setNodes((prev) =>
			toFlowNodes({
				resources,
				stagedUpdatesBySlug,
				displayByTypeKey,
				previousNodes: prev,
			}),
		)
	}, [resources, stagedUpdatesBySlug, displayByTypeKey, setNodes])

	const flowEdges = useMemo(
		() =>
			toFlowEdges({
				resourceEdges: model.resourceEdges,
				hiddenRelationshipSlugs: model.hiddenRelationshipSlugs,
				consumedDisplayEdgeIds: model.consumedDisplayEdgeIds,
				collapsedRelationships: model.collapsedRelationships,
			}),
		[
			model.collapsedRelationships,
			model.consumedDisplayEdgeIds,
			model.hiddenRelationshipSlugs,
			model.resourceEdges,
		],
	)
	const [edges, setEdges, onEdgesChange] = useEdgesState(flowEdges)
	useEffect(() => {
		setEdges(flowEdges)
	}, [flowEdges, setEdges])

	const { runAutoLayout, onNodeDragStop } = useCanvasLayout({
		projectSlug,
		model,
		resources,
		displayByTypeKey,
		nodes,
		setNodes,
		fitView,
		nodesInitialized,
		onStagedPositionChange,
		onStagedPositionClear,
	})

	const {
		showAllEdges,
		setShowAllEdges,
		renderedEdges,
		selectedRelationship,
		handleSelectResource,
		onNodeClick,
		onEdgeClick,
		onPaneClick,
		onNodeMouseEnter,
		onNodeMouseLeave,
		clearEdgeSelection,
	} = useCanvasSelection({
		edges,
		nodes,
		nodesInitialized,
		viewport: { setViewport, getViewport, fitView },
		pendingFocusSlug,
		pendingFocusMode,
		onFocusConsumed,
		onSelectResource,
		onSelectStagedItem,
	})

	const nodeTypes = useMemo<NodeTypes>(
		() => ({
			...customNodes,
			resource: (props) => (
				<ResourceNode {...props} onOpenResource={handleSelectResource} />
			),
		}),
		[handleSelectResource],
	)

	const canvasContextValue = useMemo<CanvasContextValue>(
		() => ({ projectSlug, changeSetId: model.draftChangeSet?.id ?? null }),
		[projectSlug, model.draftChangeSet?.id],
	)

	return (
		<CanvasContext.Provider value={canvasContextValue}>
			<Canvas
				nodes={nodes}
				edges={renderedEdges}
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
				controls={
					<>
						<ControlButton
							onClick={() => runAutoLayout({ force: true })}
							title="Auto layout"
						>
							<LayoutGrid className="!fill-none size-3" />
						</ControlButton>
						<ControlButton
							onClick={() => setShowAllEdges((value) => !value)}
							title="Show edges"
							aria-label="Show edges"
							aria-pressed={showAllEdges}
							className={showAllEdges ? "rf-edge-toggle-on" : undefined}
						>
							<Network className="!fill-none size-3" />
						</ControlButton>
					</>
				}
			>
				<RelationshipEdgeInspector
					relationship={selectedRelationship}
					onOpenResource={handleSelectResource}
					onClose={clearEdgeSelection}
				/>
			</Canvas>
		</CanvasContext.Provider>
	)
}

export const ResourceCanvas = memo(ResourceCanvasImpl)
