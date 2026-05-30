import type { Node } from "@xyflow/react"
import { describe, expect, it } from "vitest"
import type { CanvasChangeSetItem } from "@/components/project-canvas/changeSetRuntime"
import { classifyDraggedNode } from "./-classifyDraggedNode"

function liveNode(id: string): Node {
	return {
		id,
		type: "resource",
		position: { x: 10, y: 20 },
		data: {},
	}
}

function stagedNode(
	id: string,
	stageItemId: string,
	stageKind: string,
	position = { x: 30, y: 40 },
): Node {
	return {
		id,
		type: "resource",
		position,
		data: { stageItemId, stageKind },
	}
}

function fakeItem(id: string, changes: Record<string, unknown>) {
	return { id, changes } as unknown as CanvasChangeSetItem
}

describe("classifyDraggedNode", () => {
	it("returns liveLayout for nodes without a staged marker", () => {
		const action = classifyDraggedNode(liveNode("vpc"), new Set(), [])
		expect(action).toEqual({
			kind: "liveLayout",
			slug: "vpc",
			position: { x: 10, y: 20 },
		})
	})

	it("returns stagedPosition for draft-owned create_resource nodes and merges existing changes", () => {
		const item = fakeItem("draft-1", { inputs: { cidr: "10.0.0.0/16" } })
		const action = classifyDraggedNode(
			stagedNode("staged-1", "draft-1", "create_resource", { x: 42, y: 84 }),
			new Set(["draft-1"]),
			[item],
		)
		expect(action).toEqual({
			kind: "stagedPosition",
			itemId: "draft-1",
			itemKind: "create_resource",
			position: { x: 42, y: 84 },
			changes: {
				inputs: { cidr: "10.0.0.0/16" },
				position: { x: 42, y: 84 },
			},
		})
	})

	it("skips staged create-like nodes not in the current draft change-set", () => {
		const item = fakeItem("applied-1", {})
		const action = classifyDraggedNode(
			stagedNode("staged-1", "applied-1", "create_resource"),
			new Set(),
			[item],
		)
		expect(action).toBeNull()
	})

	it("skips when the matching change-set item is missing", () => {
		const action = classifyDraggedNode(
			stagedNode("staged-1", "draft-1", "import_resource"),
			new Set(["draft-1"]),
			[],
		)
		expect(action).toBeNull()
	})

	it("treats non-create-like staged kinds as live layout edits", () => {
		const action = classifyDraggedNode(
			stagedNode("staged-1", "draft-1", "update_resource"),
			new Set(["draft-1"]),
			[fakeItem("draft-1", {})],
		)
		expect(action).toEqual({
			kind: "liveLayout",
			slug: "staged-1",
			position: { x: 30, y: 40 },
		})
	})
})
