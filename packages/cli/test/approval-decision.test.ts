import { describe, expect, test } from "bun:test"
import type {
	OperationResultResponse,
	OperationSettlement,
} from "@core/types/operation-settlement"
import { decideApprovalGate } from "@shell/approval"
import { EXIT_AWAITING_APPROVAL } from "@shell/exit"

const awaiting: OperationSettlement = {
	status: "awaiting_approval",
	operationId: "op-42",
}

// decideApprovalGate only inspects settlement.status — this fixture stands in
// for the full operation-detail contract, which the gate logic doesn't touch.
const successData = {
	operation: {
		id: "op-1",
		kind: "create",
		status: "succeeded",
		resourceId: null,
		request: {},
		result: null,
		error: null,
		approval: null,
		createdAt: "now",
		closedAt: "now",
	},
	resource: null,
} as unknown as OperationResultResponse
const success: OperationSettlement = { status: "succeeded", data: successData }

describe("decideApprovalGate", () => {
	test("terminal settlement → pass", () => {
		const decision = decideApprovalGate(success, {})
		expect(decision.action).toBe("pass")
		if (decision.action !== "pass") throw new Error()
		expect(decision.settlement.status).toBe("succeeded")
	})

	test("awaiting_approval without --wait → notify with Exit effect", () => {
		const decision = decideApprovalGate(awaiting, {})
		expect(decision.action).toBe("notify")
		if (decision.action !== "notify") throw new Error()
		expect(decision.operationId).toBe("op-42")
		expect(decision.effects).toEqual([
			{ kind: "Exit", code: EXIT_AWAITING_APPROVAL },
		])
	})

	test("awaiting_approval with --wait → poll with parsed interval", () => {
		const decision = decideApprovalGate(awaiting, {
			waitForApproval: true,
			approvalPollInterval: "3",
		})
		expect(decision.action).toBe("poll")
		if (decision.action !== "poll") throw new Error()
		expect(decision.operationId).toBe("op-42")
		expect(decision.intervalSeconds).toBe(3)
	})

	test("awaiting_approval with --wait, no interval → default 5s", () => {
		const decision = decideApprovalGate(awaiting, { waitForApproval: true })
		expect(decision.action).toBe("poll")
		if (decision.action !== "poll") throw new Error()
		expect(decision.intervalSeconds).toBe(5)
	})

	test("awaiting_approval with --wait, invalid interval → default 5s", () => {
		const decision = decideApprovalGate(awaiting, {
			waitForApproval: true,
			approvalPollInterval: "bad",
		})
		expect(decision.action).toBe("poll")
		if (decision.action !== "poll") throw new Error()
		expect(decision.intervalSeconds).toBe(5)
	})
})
