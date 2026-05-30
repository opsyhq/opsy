import type { Edge, Node } from "@xyflow/react"
import {
	type MouseEvent as ReactMouseEvent,
	useCallback,
	useEffect,
	useMemo,
	useState,
} from "react"
import { focusViewportFor } from "@/components/canvas/focusViewport"
import {
	ACTIVITY_RAIL_WIDTH_COLLAPSED,
	APP_RAIL_WIDTH_COLLAPSED,
} from "@/components/layout/railWidths"
import {
	filterCanvasEdgesByVisibility,
	flowRelationshipSelection,
} from "@/components/project-canvas/toFlowEdges"

type ReactFlowViewport = { x: number; y: number; zoom: number }

type Viewport = {
	setViewport: (
		viewport: ReactFlowViewport,
		options?: { duration?: number },
	) => Promise<boolean>
	getViewport: () => ReactFlowViewport
	fitView: (options?: {
		nodes?: { id: string }[]
		padding?: number
		maxZoom?: number
		duration?: number
	}) => Promise<boolean>
}

export function useCanvasSelection(input: {
	edges: Edge[]
	nodes: Node[]
	nodesInitialized: boolean
	viewport: Viewport
	pendingFocusSlug?: string | null
	pendingFocusMode?: "fit" | "panel"
	onFocusConsumed?: () => void
	onSelectResource?: (slug: string) => void
	onSelectStagedItem?: (itemId: string) => void
}) {
	const {
		edges,
		nodes,
		nodesInitialized,
		viewport,
		pendingFocusSlug,
		pendingFocusMode,
		onFocusConsumed,
		onSelectResource,
		onSelectStagedItem,
	} = input
	const { setViewport, getViewport, fitView } = viewport
	const [showAllEdges, setShowAllEdges] = useState(false)
	const [activeNodeSlug, setActiveNodeSlug] = useState<string | null>(null)
	const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)

	const visibleEdges = useMemo(
		() =>
			filterCanvasEdgesByVisibility(edges, {
				showAllEdges,
				activeNodeSlug,
				selectedEdgeId,
			}),
		[activeNodeSlug, edges, selectedEdgeId, showAllEdges],
	)
	const selectedEdge = useMemo(
		() => edges.find((edge) => edge.id === selectedEdgeId),
		[edges, selectedEdgeId],
	)
	const selectedRelationship = flowRelationshipSelection(selectedEdge)
	const selectedResourceEdge = selectedRelationship?.edge
	const renderedEdges = useMemo(
		() =>
			visibleEdges.map((edge) =>
				edge.id === selectedEdgeId
					? {
							...edge,
							style: {
								...(edge.style ?? {}),
								stroke: "var(--canvas-accent)",
								strokeWidth: 2.5,
							},
						}
					: edge,
			),
		[visibleEdges, selectedEdgeId],
	)

	useEffect(() => {
		if (selectedEdgeId && !selectedResourceEdge) {
			setSelectedEdgeId(null)
			setActiveNodeSlug(null)
		}
	}, [selectedEdgeId, selectedResourceEdge])

	// Centers a node inside the canvas area not covered by the app rail,
	// activity rail, or right-side detail panel. Reads layout from the DOM at
	// call time so it stays correct across viewport resizes.
	const focusNode = useCallback(
		(nodeId: string) => {
			if (typeof window === "undefined") return
			const flow = document.querySelector<HTMLElement>(".react-flow")
			const nodeElement = Array.from(
				flow?.querySelectorAll<HTMLElement>(".react-flow__node") ?? [],
			).find((element) => element.dataset.id === nodeId)
			if (!flow || !nodeElement) return

			setViewport(
				focusViewportFor({
					flowRect: flow.getBoundingClientRect(),
					nodeRect: nodeElement.getBoundingClientRect(),
					viewport: getViewport(),
					windowInnerWidth: window.innerWidth,
					appRailWidth: APP_RAIL_WIDTH_COLLAPSED,
					activityRailWidth: ACTIVITY_RAIL_WIDTH_COLLAPSED,
					detailPanelWidth: 800,
				}),
				{ duration: 400 },
			).catch(() => {})
		},
		[getViewport, setViewport],
	)

	// Parent sets `pendingFocusSlug` after an import; we retry until the slug's
	// node has actually mounted (import is async — the resource arrives later
	// via a query refetch), then fitView onto just that node so it lands at the
	// true viewport center (no detail-panel offset, since import never opens
	// one). `onFocusConsumed` clears the slug synchronously, so the effect's
	// next run returns early and won't double-schedule — we deliberately omit a
	// cleanup, because cancelAnimationFrame would fire on the same state-change
	// tick and cancel the rAF before it ran.
	useEffect(() => {
		if (!pendingFocusSlug || !nodesInitialized) return
		const exists = nodes.some((node) => node.id === pendingFocusSlug)
		if (!exists) return
		const slug = pendingFocusSlug
		const mode = pendingFocusMode ?? "fit"
		onFocusConsumed?.()
		window.requestAnimationFrame(() => {
			// "panel": a detail panel opens alongside (create-save), so frame the
			// node in the visible area the same way a click does. "fit": no panel
			// (import), so center on the true viewport.
			if (mode === "panel") {
				focusNode(slug)
				return
			}
			void fitView({
				nodes: [{ id: slug }],
				maxZoom: 2,
				padding: 0.3,
				duration: 400,
			})
		})
	}, [
		pendingFocusSlug,
		pendingFocusMode,
		nodesInitialized,
		nodes,
		fitView,
		focusNode,
		onFocusConsumed,
	])

	const handleSelectResource = useCallback(
		(slug: string) => {
			onSelectResource?.(slug)
			focusNode(slug)
		},
		[focusNode, onSelectResource],
	)

	const onNodeClick = useCallback(
		(_event: ReactMouseEvent, node: Node) => {
			setSelectedEdgeId(null)
			const stageItemId =
				typeof node.data?.stageItemId === "string"
					? node.data.stageItemId
					: null
			if (stageItemId) {
				onSelectStagedItem?.(stageItemId)
				focusNode(node.id)
				return
			}
			handleSelectResource(node.id)
		},
		[focusNode, handleSelectResource, onSelectStagedItem],
	)

	const onEdgeClick = useCallback((_event: ReactMouseEvent, edge: Edge) => {
		if (!flowRelationshipSelection(edge)) return
		setSelectedEdgeId(edge.id)
	}, [])

	const onPaneClick = useCallback(() => {
		setSelectedEdgeId(null)
		setActiveNodeSlug(null)
	}, [])

	const onNodeMouseEnter = useCallback(
		(_event: ReactMouseEvent, node: Node) => setActiveNodeSlug(node.id),
		[],
	)
	const onNodeMouseLeave = useCallback(() => {
		if (!selectedEdgeId) setActiveNodeSlug(null)
	}, [selectedEdgeId])

	const clearEdgeSelection = useCallback(() => setSelectedEdgeId(null), [])

	return {
		showAllEdges,
		setShowAllEdges,
		activeNodeSlug,
		renderedEdges,
		selectedRelationship,
		handleSelectResource,
		onNodeClick,
		onEdgeClick,
		onPaneClick,
		onNodeMouseEnter,
		onNodeMouseLeave,
		clearEdgeSelection,
	}
}
