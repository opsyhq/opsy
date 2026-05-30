import { describe, expect, test } from "bun:test"
import type { ChangeSetItem } from "@/lib/db/schema"
import { getChangeSetApplyGraph, planChangesetApply } from "../plan"

function item(
	id: string,
	kind: ChangeSetItem["kind"],
	changes: unknown,
	targetResourceSlug: string | null = null,
	index = Number(id.replace(/\D/g, "")) || 0,
): ChangeSetItem {
	const createdAt = new Date(1_700_000_000_000 + index)
	return {
		id,
		changeSetId: "change-set",
		kind,
		targetResourceId: null,
		targetResourceSlug,
		integrationId: null,
		resourceType: null,
		changes,
		validationStatus: "valid",
		validationResult: null,
		source: "user",
		createdAt,
		updatedAt: createdAt,
	} as ChangeSetItem
}

describe("changeset apply planning", () => {
	test("orders staged create refs before dependents", () => {
		const child = item(
			"2",
			"create_resource",
			{
				slug: "child",
				type: "test_child",
				inputs: { parentId: { $ref: "parent.id" } },
			},
			null,
			1,
		)
		const parent = item(
			"1",
			"create_resource",
			{
				slug: "parent",
				type: "test_parent",
				inputs: {},
			},
			null,
			2,
		)

		const plan = planChangesetApply([child, parent], [])

		expect(plan.blockers).toEqual([])
		expect(plan.orderedItems.map((entry) => entry.id)).toEqual(["1", "2"])
	})

	test("orders staged imports before ref dependents", () => {
		const dependent = item(
			"2",
			"create_resource",
			{
				slug: "image",
				type: "test_image",
				inputs: { ownerId: { $ref: "imported-owner.id" } },
			},
			null,
			1,
		)
		const imported = item(
			"1",
			"import_resource",
			{
				slug: "imported-owner",
				type: "test_owner",
				providerId: "owner-1",
			},
			null,
			2,
		)

		const plan = planChangesetApply([dependent, imported], [])

		expect(plan.blockers).toEqual([])
		expect(plan.orderedItems.map((entry) => entry.id)).toEqual(["1", "2"])
	})

	test("detects staged ref cycles", () => {
		const a = item("1", "create_resource", {
			slug: "a",
			type: "test_a",
			inputs: { b: { $ref: "b.id" } },
		})
		const b = item("2", "create_resource", {
			slug: "b",
			type: "test_b",
			inputs: { a: { $ref: "a.id" } },
		})

		const plan = planChangesetApply([a, b], [])

		expect(plan.orderedItems).toEqual([])
		expect(plan.blockers.map((blocker) => blocker.reason)).toEqual([
			"cycle",
			"cycle",
		])
	})

	test("blocks refs to missing targets", () => {
		const create = item("1", "create_resource", {
			slug: "child",
			type: "test_child",
			inputs: { parentId: { $ref: "missing-parent.id" } },
		})

		const plan = planChangesetApply([create], [])

		expect(plan.orderedItems).toEqual([])
		expect(plan.blockers).toMatchObject([
			{ itemId: "1", reason: "missing_target", slug: "missing-parent" },
		])
	})

	test("blocks staged refs to staged deletes", () => {
		const create = item("1", "create_resource", {
			slug: "child",
			type: "test_child",
			inputs: { parentId: { $ref: "parent.id" } },
		})
		const deleteParent = item(
			"2",
			"delete_resource",
			{ mode: "delete" },
			"parent",
		)

		const plan = planChangesetApply(
			[create, deleteParent],
			[{ slug: "parent", dependsOn: null, deletedAt: null }],
		)

		expect(plan.orderedItems.map((entry) => entry.id)).toEqual(["2"])
		expect(plan.blockers).toMatchObject([
			{
				itemId: "1",
				reason: "delete_blocked",
				slug: "parent",
				blockedByItemId: "2",
			},
		])
	})

	test("blocks deleting live resources that still have live dependents", () => {
		const deleteParent = item(
			"1",
			"delete_resource",
			{ mode: "delete" },
			"parent",
		)

		const plan = planChangesetApply(
			[deleteParent],
			[
				{ slug: "parent", dependsOn: null, deletedAt: null },
				{ slug: "child", dependsOn: ["parent"], deletedAt: null },
			],
		)

		expect(plan.orderedItems).toEqual([])
		expect(plan.blockers).toMatchObject([
			{
				itemId: "1",
				reason: "delete_blocked",
				slug: "parent",
				blockedBySlug: "child",
			},
		])
	})

	test("orders staged updates that remove live dependencies before delete", () => {
		const updateChild = item(
			"1",
			"update_resource",
			{ inputs: { name: "child-without-parent" } },
			"child",
		)
		const deleteParent = item(
			"2",
			"delete_resource",
			{ mode: "delete" },
			"parent",
		)

		const plan = planChangesetApply(
			[deleteParent, updateChild],
			[
				{ slug: "parent", dependsOn: null, deletedAt: null },
				{ slug: "child", dependsOn: ["parent"], deletedAt: null },
			],
		)

		expect(plan.blockers).toEqual([])
		expect(plan.orderedItems.map((entry) => entry.id)).toEqual(["1", "2"])
		expect(plan.dependenciesByItemId.get("2")).toEqual(new Set(["1"]))
	})

	test("groups independent items in the same apply level", () => {
		const first = item("1", "create_resource", {
			slug: "first",
			type: "test_first",
			inputs: {},
		})
		const second = item("2", "create_resource", {
			slug: "second",
			type: "test_second",
			inputs: {},
		})

		const graph = getChangeSetApplyGraph(planChangesetApply([first, second], []))

		expect(graph.levels.map((level) => level.map((entry) => entry.id))).toEqual(
			[["1", "2"]],
		)
		expect(graph.levels[0]?.map((entry) => entry.kind)).toEqual([
			"create_resource",
			"create_resource",
		])
	})

	test("places dependent items in later apply levels", () => {
		const child = item(
			"2",
			"create_resource",
			{
				slug: "child",
				type: "test_child",
				inputs: { parentId: { $ref: "parent.id" } },
			},
			null,
			1,
		)
		const parent = item(
			"1",
			"create_resource",
			{
				slug: "parent",
				type: "test_parent",
				inputs: {},
			},
			null,
			2,
		)

		const graph = getChangeSetApplyGraph(planChangesetApply([child, parent], []))

		expect(graph.levels.map((level) => level.map((entry) => entry.id))).toEqual(
			[["1"], ["2"]],
		)
	})
})
