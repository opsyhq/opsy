import { describe, expect, it } from "vitest"
import type { ChangeSetItem } from "@/lib/changeSetReactQuery"
import type { ProjectOpenOperation } from "@/lib/projectReactQuery"
import { formatElapsed, tallyItems } from "./-DeployingBar"

function item(
	overrides: Partial<ChangeSetItem> & Pick<ChangeSetItem, "id" | "kind">,
): ChangeSetItem {
	return {
		targetResourceSlug: null,
		resourceType: null,
		changes: null,
		source: "user",
		createdAt: "2026-01-01T00:00:00.000Z",
		dryRun: null,
		validationStatus: "valid",
		validationResult: null,
		applyStatus: "pending",
		applyError: null,
		...overrides,
	}
}

function op(
	overrides: Partial<ProjectOpenOperation> &
		Pick<ProjectOpenOperation, "id" | "changeSetItemId" | "kind" | "status">,
): ProjectOpenOperation {
	return {
		projectId: "p1",
		resourceId: "r1",
		retryOfOperationId: null,
		workflowRunId: null,
		lockKey: null,
		actorType: "user",
		actorId: "u1",
		closedAt: null,
		createdAt: "2026-01-01T00:00:00.000Z",
		updatedAt: "2026-01-01T00:00:00.000Z",
		result: null,
		error: null,
		request: {},
		approval: null,
		...overrides,
	}
}

function opsMap(
	ops: ProjectOpenOperation[],
): Map<string, ProjectOpenOperation> {
	const m = new Map<string, ProjectOpenOperation>()
	for (const o of ops) if (o.changeSetItemId) m.set(o.changeSetItemId, o)
	return m
}

describe("DeployingBar tallyItems", () => {
	it("counts phases by mapping items through their open operations", () => {
		const items = [
			item({ id: "i-create", kind: "create_resource" }),
			item({ id: "i-update", kind: "update_resource" }),
			item({ id: "i-delete", kind: "delete_resource" }),
			item({ id: "i-import", kind: "import_resource" }),
			item({ id: "i-pending", kind: "create_resource" }),
			item({ id: "i-done", kind: "create_resource" }),
			item({ id: "i-failed", kind: "create_resource" }),
			item({ id: "i-no-op", kind: "create_resource" }),
		]
		const ops = opsMap([
			op({
				id: "o1",
				changeSetItemId: "i-create",
				kind: "create",
				status: "running",
			}),
			op({
				id: "o2",
				changeSetItemId: "i-update",
				kind: "update",
				status: "running",
			}),
			op({
				id: "o3",
				changeSetItemId: "i-delete",
				kind: "delete",
				status: "running",
			}),
			op({
				id: "o4",
				changeSetItemId: "i-import",
				kind: "import",
				status: "running",
			}),
			op({
				id: "o5",
				changeSetItemId: "i-pending",
				kind: "create",
				status: "pending",
			}),
			op({
				id: "o6",
				changeSetItemId: "i-done",
				kind: "create",
				status: "succeeded",
			}),
			op({
				id: "o7",
				changeSetItemId: "i-failed",
				kind: "create",
				status: "failed",
			}),
		])

		const tally = tallyItems(items, ops)

		expect(tally.running).toBe(4)
		expect(tally.pending).toBe(2) // i-pending (op pending) + i-no-op (no op → staged)
		expect(tally.done).toBe(1)
		expect(tally.failed).toBe(1)
		expect(
			tally.runningRows.map((r) => ({ id: r.item.id, verb: r.verb })),
		).toEqual([
			{ id: "i-create", verb: "creating" },
			{ id: "i-update", verb: "updating" },
			{ id: "i-delete", verb: "deleting" },
			{ id: "i-import", verb: "importing" },
		])
	})

	it("treats canceled ops as failed in the tally", () => {
		const tally = tallyItems(
			[item({ id: "i", kind: "create_resource" })],
			opsMap([
				op({
					id: "o",
					changeSetItemId: "i",
					kind: "create",
					status: "canceled",
				}),
			]),
		)
		expect(tally.failed).toBe(1)
		expect(tally.running).toBe(0)
	})

	it("treats awaiting_approval and canceling as pending", () => {
		const tally = tallyItems(
			[
				item({ id: "a", kind: "create_resource" }),
				item({ id: "b", kind: "create_resource" }),
			],
			opsMap([
				op({
					id: "oa",
					changeSetItemId: "a",
					kind: "create",
					status: "awaiting_approval",
				}),
				op({
					id: "ob",
					changeSetItemId: "b",
					kind: "create",
					status: "canceling",
				}),
			]),
		)
		expect(tally.pending).toBe(2)
		expect(tally.running).toBe(0)
	})
})

describe("DeployingBar formatElapsed", () => {
	it("renders sub-minute as seconds", () => {
		expect(formatElapsed(0)).toBe("0s")
		expect(formatElapsed(999)).toBe("0s")
		expect(formatElapsed(1_000)).toBe("1s")
		expect(formatElapsed(59_999)).toBe("59s")
	})

	it("renders minute+second with zero-padded seconds", () => {
		expect(formatElapsed(60_000)).toBe("1m 00s")
		expect(formatElapsed(64_000)).toBe("1m 04s")
		expect(formatElapsed(125_000)).toBe("2m 05s")
	})

	it("floors negative durations to 0s", () => {
		expect(formatElapsed(-5_000)).toBe("0s")
	})

	it("handles non-finite input", () => {
		expect(formatElapsed(Number.NaN)).toBe("0s")
		expect(formatElapsed(Number.POSITIVE_INFINITY)).toBe("0s")
		expect(formatElapsed(Number.NEGATIVE_INFINITY)).toBe("0s")
	})
})
