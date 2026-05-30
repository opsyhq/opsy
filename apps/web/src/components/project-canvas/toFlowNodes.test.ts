import type { Node } from "@xyflow/react"
import { describe, expect, it } from "vitest"
import { runCanvasLayout } from "./layout/layoutRunner"
import type { ResourceLike } from "./resourceProjection"
import { persistableLayouts, toFlowNodes, toLayoutSpecs } from "./toFlowNodes"

const baseResource: ResourceLike = {
	id: "resource-1",
	slug: "target",
	type: "aws_instance",
	status: "live",
	provider: "aws",
	inputs: { name: "target" },
	position: { x: 0, y: 0 },
	size: null,
	references: [],
}

function resource(slug: string): ResourceLike {
	return { ...baseResource, id: slug, slug }
}

describe("toFlowNodes", () => {
	it("maps resources to flat React Flow resource nodes", () => {
		const [node] = toFlowNodes({
			resources: [resource("compute")],
			stagedUpdatesBySlug: new Map(),
			displayByTypeKey: new Map(),
		})

		expect(node).toMatchObject({
			id: "compute",
			type: "resource",
			position: { x: 0, y: 0 },
			data: expect.objectContaining({ slug: "compute", type: "aws_instance" }),
		})
		expect(node).not.toHaveProperty("parentId")
		expect(node).not.toHaveProperty("extent")
	})

	it("renders docked attachment chips as actual child nodes", () => {
		const nodes = toFlowNodes({
			resources: [
				{
					...resource("alb"),
					bottomTuckedItems: [
						{
							slug: "listener",
							type: "aws_lb_listener",
							label: "Listener · listener",
						},
					],
				},
				{
					...resource("listener"),
					type: "aws_lb_listener",
					componentHostSlug: "alb",
				},
			],
			stagedUpdatesBySlug: new Map(),
			displayByTypeKey: new Map([["aws:resource:aws_lb_listener", "chip"]]),
		})
		const host = nodes.find((node) => node.id === "alb")
		const listener = nodes.find((node) => node.id === "listener")

		expect(host?.style).toEqual({
			width: 192,
			height: 108,
			pointerEvents: "none",
			zIndex: 1,
		})
		expect(host?.data).toEqual(
			expect.objectContaining({
				layout: expect.objectContaining({
					bodyHeight: 80,
					bottomTuckedOverlap: 4,
				}),
			}),
		)
		expect(listener).toMatchObject({
			parentId: "alb",
			draggable: false,
			position: { x: 0, y: 76 },
			style: expect.objectContaining({
				pointerEvents: "none",
			}),
			data: expect.objectContaining({
				display: "chip",
				slug: "listener",
			}),
		})
		expect(listener).not.toHaveProperty("extent")
	})

	it("renders staged resources and excludes virtual layouts from persistence", () => {
		const stagedItem = {
			id: "item-1",
			kind: "create_resource" as const,
			resourceType: "aws_instance",
			targetResourceSlug: null,
			changes: { slug: "draft" },
			source: "user" as const,
			createdAt: "2026-01-01T00:00:00.000Z",
			dryRun: null,
			validationStatus: "valid" as const,
			validationResult: null,
			applyStatus: "pending" as const,
			applyError: null,
		}
		const draft = { ...resource("draft"), stagedItem }
		const [node] = toFlowNodes({
			resources: [draft],
			stagedUpdatesBySlug: new Map(),
			displayByTypeKey: new Map(),
		})
		const persistence = persistableLayouts({
			result: {
				positions: { draft: { x: 44, y: 44 } },
				sizes: { draft: { w: 240, h: 120 } },
			},
			resources: [draft],
		})

		expect(node?.data).toEqual(
			expect.objectContaining({
				staged: true,
				stageItemId: "item-1",
				stageAction: "Create staged",
			}),
		)
		expect(persistence.layouts).toEqual([])
	})
})

describe("toLayoutSpecs", () => {
	it("builds flat layout specs from measured React Flow nodes", async () => {
		const resources = [
			resource("vpc"),
			resource("subnet"),
			{ ...resource("listener"), componentHostSlug: "vpc" },
		]
		const nodes: Node[] = toFlowNodes({
			resources,
			stagedUpdatesBySlug: new Map(),
			displayByTypeKey: new Map(),
		}).map((node) =>
			node.id === "subnet"
				? { ...node, measured: { width: 320, height: 144 } }
				: node,
		)
		const specs = toLayoutSpecs({
			resources,
			nodes,
			force: true,
			displayByTypeKey: new Map(),
		})
		const result = await runCanvasLayout(specs)

		expect(specs.find((spec) => spec.id === "subnet")).toMatchObject({
			width: 320,
			height: 144,
			isContainer: false,
		})
		expect(specs.find((spec) => spec.id === "subnet")).not.toHaveProperty(
			"parentId",
		)
		expect(specs.find((spec) => spec.id === "listener")).toBeUndefined()
		expect(result.positions.subnet).toBeDefined()
	})

	it("preserves saved positions by only placing unpositioned nodes", async () => {
		const result = await runCanvasLayout([
			{
				id: "placed",
				width: 192,
				height: 80,
				order: 0,
				position: { x: 10, y: 20 },
			},
			{ id: "new", width: 192, height: 80, order: 1 },
		])

		expect(result.positions.placed).toBeUndefined()
		expect(result.positions.new).toBeDefined()
	})
})
