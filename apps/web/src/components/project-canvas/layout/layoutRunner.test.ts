import { describe, expect, it } from "vitest"
import { runCanvasLayout } from "./layoutRunner"
import type { LayoutNodeSpec } from "./layoutTypes"

function node(
	id: string,
	order: number,
	layoutType = "resource",
): LayoutNodeSpec {
	return {
		id,
		width: 180,
		height: 90,
		order,
		layoutType,
	}
}

function rect(node: LayoutNodeSpec, position: { x: number; y: number }) {
	return {
		left: position.x,
		right: position.x + node.width,
		top: position.y,
		bottom: position.y + node.height,
	}
}

function overlaps(
	leftNode: LayoutNodeSpec,
	leftPosition: { x: number; y: number },
	rightNode: LayoutNodeSpec,
	rightPosition: { x: number; y: number },
): boolean {
	const left = rect(leftNode, leftPosition)
	const right = rect(rightNode, rightPosition)
	return (
		left.left < right.right &&
		left.right > right.left &&
		left.top < right.bottom &&
		left.bottom > right.top
	)
}

describe("runCanvasLayout", () => {
	it("groups resources by layout type instead of relationships", async () => {
		const result = await runCanvasLayout([
			node("service-a", 0, "service"),
			node("database", 1, "database"),
			node("service-b", 2, "service"),
		])

		expect(result.positions["service-b"]?.x).toBe(
			result.positions["service-a"]?.x,
		)
		expect(result.positions["service-b"]?.y).toBeGreaterThan(
			result.positions["service-a"]?.y ?? 0,
		)
		expect(result.positions.database?.x).not.toBe(
			result.positions["service-a"]?.x,
		)
	})

	it("does not create hierarchy between related network resources", async () => {
		const result = await runCanvasLayout([
			node("vpc", 0, "network"),
			node("subnet", 1, "network"),
		])

		expect(result.positions.vpc?.x).toBe(result.positions.subnet?.x)
		expect(result.positions.subnet?.y).toBeGreaterThan(
			result.positions.vpc?.y ?? 0,
		)
	})

	it("pins saved nodes while placing unpositioned nodes in the same type group", async () => {
		const result = await runCanvasLayout([
			{
				...node("placed", 0, "service"),
				position: { x: 480, y: 320 },
			},
			node("new", 1, "service"),
		])

		expect(result.positions.placed).toBeUndefined()
		expect(result.positions.new).toBeDefined()
		expect(result.positions.new?.x).toBe(480)
		expect(result.positions.new?.y).toBeGreaterThan(320)
	})

	it("places groups deterministically without overlaps", async () => {
		const nodes = [
			node("service", 0, "service"),
			node("database", 1, "database"),
			node("cache", 2, "cache"),
		]

		const first = await runCanvasLayout(nodes)
		const second = await runCanvasLayout(nodes)

		expect(second.positions).toEqual(first.positions)
		expect(
			overlaps(
				nodes[0] as LayoutNodeSpec,
				first.positions.service as { x: number; y: number },
				nodes[1] as LayoutNodeSpec,
				first.positions.database as { x: number; y: number },
			),
		).toBe(false)
	})
})
