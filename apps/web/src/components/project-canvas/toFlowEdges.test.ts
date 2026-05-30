import type { Edge } from "@xyflow/react"
import { describe, expect, it } from "vitest"
import type { CanvasEdge } from "@/components/project-canvas/resourceRelationships"
import type { ProjectedRelationship } from "./relationshipProjection"
import {
	filterCanvasEdgesByVisibility,
	flowRelationshipSelection,
	toFlowEdges,
} from "./toFlowEdges"

function edge(
	id: string,
	source: string,
	target: string,
	role: CanvasEdge["role"] = "ATTACHMENT",
	targetPath = "id",
	sourcePath = "id",
	referrerSlug: string = target,
): CanvasEdge {
	return {
		id,
		source,
		target,
		role,
		origin: "rule",
		sourcePath,
		targetPath,
		ruleKey: `rule-${id}`,
		referrerSlug,
	}
}

describe("toFlowEdges", () => {
	it("hides edges by default, reveals incident edges, and supports global show-all", () => {
		const edges: Edge[] = [
			{ id: "a-b", source: "a", target: "b" },
			{ id: "c-d", source: "c", target: "d" },
		]

		expect(
			filterCanvasEdgesByVisibility(edges, { showAllEdges: false }),
		).toEqual([])
		expect(
			filterCanvasEdgesByVisibility(edges, {
				showAllEdges: false,
				activeNodeSlug: "a",
			}).map((item) => item.id),
		).toEqual(["a-b"])
		expect(
			filterCanvasEdgesByVisibility(edges, { showAllEdges: true }),
		).toEqual(edges)
	})

	it("keeps selected edges visible", () => {
		const edges: Edge[] = [
			{ id: "a-b", source: "a", target: "b" },
			{ id: "c-d", source: "c", target: "d" },
		]

		expect(
			filterCanvasEdgesByVisibility(edges, {
				showAllEdges: false,
				selectedEdgeId: "c-d",
			}).map((item) => item.id),
		).toEqual(["c-d"])
	})

	it("renders scope edges as quiet inspectable relationships", () => {
		const edges = toFlowEdges({
			resourceEdges: [
				edge("workload-boundary", "workload", "boundary", "SCOPE"),
			],
			hiddenRelationshipSlugs: new Set(),
			consumedDisplayEdgeIds: new Set(),
			collapsedRelationships: [],
		})

		expect(edges).toHaveLength(1)
		expect(edges[0]).toMatchObject({
			id: "resource-edge:workload-boundary",
			source: "workload",
			target: "boundary",
			style: {
				strokeDasharray: "2 6",
			},
		})
		expect(flowRelationshipSelection(edges[0])?.edge.role).toBe("SCOPE")
	})

	it("converts graph edges without synthesizing resource input refs", () => {
		const edges = toFlowEdges({
			resourceEdges: [edge("a-b", "a", "b", "REFERENCE", "input")],
			hiddenRelationshipSlugs: new Set(),
			consumedDisplayEdgeIds: new Set(),
			collapsedRelationships: [],
		})

		expect(edges.map((item) => item.id)).toEqual(["resource-edge:a-b"])
		expect(edges[0]?.targetHandle).toBeUndefined()
	})

	it("keeps config edge direction without field handles", () => {
		const edges = toFlowEdges({
			resourceEdges: [
				{
					...edge(
						"instance-security-group",
						"instance",
						"security-group",
						"REFERENCE",
						"id",
						"security_group_id",
						"instance",
					),
					origin: "config",
					ruleKey: null,
				},
			],
			hiddenRelationshipSlugs: new Set(),
			consumedDisplayEdgeIds: new Set(),
			collapsedRelationships: [],
		})

		expect(edges[0]).toMatchObject({
			source: "instance",
			target: "security-group",
		})
		expect(edges[0]?.sourceHandle).toBeUndefined()
		expect(edges[0]?.targetHandle).toBeUndefined()
	})

	it("uses rule edge direction instead of referrer metadata", () => {
		const edges = toFlowEdges({
			resourceEdges: [
				edge(
					"vpc-subnet",
					"vpc",
					"subnet",
					"ATTACHMENT",
					"vpc_id",
					"id",
					"subnet",
				),
			],
			hiddenRelationshipSlugs: new Set(),
			consumedDisplayEdgeIds: new Set(),
			collapsedRelationships: [],
		})

		expect(edges[0]).toMatchObject({
			source: "vpc",
			target: "subnet",
		})
		expect(edges[0]?.sourceHandle).toBeUndefined()
		expect(edges[0]?.targetHandle).toBeUndefined()
	})

	it("keeps collapsed associations inspectable after Flow conversion", () => {
		const representative = edge(
			"association-route",
			"association",
			"route-table",
			"ASSOCIATION",
		)
		const collapsed: ProjectedRelationship = {
			id: "association:association:route-table:subnet",
			sourceSlug: "route-table",
			targetSlug: "subnet",
			edge: representative,
			underlyingEdgeIds: ["association-route", "association-subnet"],
			hiddenResourceSlugs: ["association"],
			display: "collapsed",
		}
		const [flowEdge] = toFlowEdges({
			resourceEdges: [],
			hiddenRelationshipSlugs: new Set(),
			consumedDisplayEdgeIds: new Set(),
			collapsedRelationships: [collapsed],
		})

		expect(flowRelationshipSelection(flowEdge)).toEqual({
			edge: representative,
			underlyingEdgeIds: ["association-route", "association-subnet"],
			hiddenResourceSlugs: ["association"],
		})
	})

	it("dedupes equivalent role edges", () => {
		const edges = toFlowEdges({
			resourceEdges: [
				edge("sg-instance", "instance", "sg", "REFERENCE"),
				edge("sg-instance-secondary", "instance", "sg", "REFERENCE"),
			],
			hiddenRelationshipSlugs: new Set(),
			consumedDisplayEdgeIds: new Set(),
			collapsedRelationships: [],
		})

		expect(edges).toHaveLength(1)
		expect(edges[0]).toMatchObject({
			source: "instance",
			target: "sg",
			data: {
				underlyingEdgeIds: ["sg-instance", "sg-instance-secondary"],
			},
		})
	})
})
