import type { Edge } from "@xyflow/react"
import { MarkerType } from "@xyflow/react"
import type { CanvasEdge } from "@/components/project-canvas/resourceRelationships"
import { CANVAS_EDGE_TYPE } from "./canvasConstants"
import type { ProjectedRelationship } from "./relationshipProjection"

export type RelationshipFlowSelection = {
	edge: CanvasEdge
	underlyingEdgeIds: string[]
	hiddenResourceSlugs: string[]
}

export type CanvasEdgeVisibility = {
	showAllEdges: boolean
	activeNodeSlug?: string | null
	selectedEdgeId?: string | null
}

function relationshipEdgeVisuals(
	edge: CanvasEdge,
): Pick<Edge, "style" | "markerEnd"> {
	if (edge.role === "REFERENCE") {
		return {
			markerEnd: {
				type: MarkerType.ArrowClosed,
				color: "var(--canvas-border-hover)",
			},
			style: {
				stroke: "var(--canvas-border-hover)",
				strokeWidth: 1.4,
				strokeDasharray: "5 5",
			},
		}
	}
	if (edge.role === "ASSOCIATION") {
		return {
			style: {
				stroke: "var(--canvas-border-hover)",
				strokeWidth: 1.4,
				strokeDasharray: "3 5",
			},
		}
	}
	if (edge.role === "SCOPE") {
		return {
			style: {
				stroke: "var(--canvas-border-hover)",
				strokeWidth: 1.3,
				strokeDasharray: "2 6",
			},
		}
	}
	return {
		style: { stroke: "var(--canvas-border-hover)", strokeWidth: 1.4 },
	}
}

function resourceEdgeToFlow(
	edge: CanvasEdge,
	consumedDisplayEdgeIds: Set<string>,
): Edge | null {
	if (
		edge.role !== "ATTACHMENT" &&
		edge.role !== "ASSOCIATION" &&
		edge.role !== "REFERENCE" &&
		edge.role !== "SCOPE"
	) {
		return null
	}
	if (consumedDisplayEdgeIds.has(edge.id)) return null

	return {
		id: `resource-edge:${edge.id}`,
		source: edge.source,
		target: edge.target,
		type: CANVAS_EDGE_TYPE,
		...relationshipEdgeVisuals(edge),
		data: {
			resourceEdge: edge,
		},
	}
}

function collapsedRelationshipToFlow(
	relationship: ProjectedRelationship,
): Edge {
	return {
		id: relationship.id,
		source: relationship.sourceSlug,
		target: relationship.targetSlug,
		type: CANVAS_EDGE_TYPE,
		...relationshipEdgeVisuals(relationship.edge),
		data: {
			resourceEdge: relationship.edge,
			underlyingEdgeIds: relationship.underlyingEdgeIds,
			hiddenResourceSlugs: relationship.hiddenResourceSlugs,
		},
	}
}

export function toFlowEdges(input: {
	resourceEdges: CanvasEdge[]
	hiddenRelationshipSlugs: Set<string>
	consumedDisplayEdgeIds: Set<string>
	collapsedRelationships: ProjectedRelationship[]
}): Edge[] {
	const relationshipEdges: Edge[] = []
	const relationshipIndexByKey = new Map<string, number>()
	const addRelationshipEdge = (edge: Edge) => {
		const resourceEdge = edge.data?.resourceEdge
		const role =
			resourceEdge &&
			typeof resourceEdge === "object" &&
			"role" in resourceEdge &&
			typeof resourceEdge.role === "string"
				? resourceEdge.role
				: ""
		const key = `${edge.source}->${edge.target}:${role}`
		const existingIndex = relationshipIndexByKey.get(key)
		if (existingIndex !== undefined) {
			const existing = relationshipEdges[existingIndex]
			if (!existing) return
			const existingSelection = flowRelationshipSelection(existing)
			const edgeSelection = flowRelationshipSelection(edge)
			relationshipEdges[existingIndex] = {
				...existing,
				data: {
					...(existing.data ?? {}),
					underlyingEdgeIds: [
						...new Set([
							...(existingSelection?.underlyingEdgeIds ?? []),
							...(edgeSelection?.underlyingEdgeIds ?? []),
						]),
					],
					hiddenResourceSlugs: [
						...new Set([
							...(existingSelection?.hiddenResourceSlugs ?? []),
							...(edgeSelection?.hiddenResourceSlugs ?? []),
						]),
					],
				},
			}
			return
		}
		relationshipIndexByKey.set(key, relationshipEdges.length)
		relationshipEdges.push(edge)
	}

	for (const edge of input.resourceEdges) {
		if (
			input.hiddenRelationshipSlugs.has(edge.source) ||
			input.hiddenRelationshipSlugs.has(edge.target)
		) {
			continue
		}
		const flowEdge = resourceEdgeToFlow(edge, input.consumedDisplayEdgeIds)
		if (flowEdge) addRelationshipEdge(flowEdge)
	}
	for (const relationship of input.collapsedRelationships) {
		addRelationshipEdge(collapsedRelationshipToFlow(relationship))
	}

	return relationshipEdges
}

export function filterCanvasEdgesByVisibility(
	edges: Edge[],
	visibility: CanvasEdgeVisibility,
): Edge[] {
	if (visibility.showAllEdges) return edges
	return edges.filter((edge) => {
		if (visibility.selectedEdgeId && edge.id === visibility.selectedEdgeId) {
			return true
		}
		if (!visibility.activeNodeSlug) return false
		return (
			edge.source === visibility.activeNodeSlug ||
			edge.target === visibility.activeNodeSlug
		)
	})
}

export function flowRelationshipSelection(
	edge: Edge | undefined,
): RelationshipFlowSelection | null {
	const resourceEdge = edge?.data?.resourceEdge
	if (
		!resourceEdge ||
		typeof resourceEdge !== "object" ||
		!("id" in resourceEdge)
	) {
		return null
	}
	const underlyingEdgeIds = Array.isArray(edge?.data?.underlyingEdgeIds)
		? edge.data.underlyingEdgeIds.filter(
				(id): id is string => typeof id === "string",
			)
		: [(resourceEdge as CanvasEdge).id]
	const hiddenResourceSlugs = Array.isArray(edge?.data?.hiddenResourceSlugs)
		? edge.data.hiddenResourceSlugs.filter(
				(slug): slug is string => typeof slug === "string",
			)
		: []
	return {
		edge: resourceEdge as CanvasEdge,
		underlyingEdgeIds,
		hiddenResourceSlugs,
	}
}
