import {
	type ApprovalFlagOpts,
	decideApprovalGate,
	pollOperationStatus,
} from "@core/approval"

export {
	type ApprovalFlagOpts,
	decideApprovalGate,
} from "@core/approval"

import { exitEffect } from "@core/effects"
import type { HandlerDeps } from "@core/types/deps"
import type { OperationSettlement } from "@core/types/operation-settlement"
import { commit } from "./commit"
import { EXIT_AWAITING_APPROVAL } from "./exit"

async function waitForApproval(
	deps: HandlerDeps,
	operationId: string,
	intervalSeconds: number,
): Promise<OperationSettlement> {
	const controller = new AbortController()
	const unregister = deps.signals.onInterrupt(() => controller.abort())
	deps.output.warn(
		`Operation ${operationId} is awaiting approval — polling every ${intervalSeconds}s. Approve in the web UI, or Ctrl-C to stop.`,
	)
	try {
		for await (const event of pollOperationStatus(
			deps,
			operationId,
			intervalSeconds * 1000,
			controller.signal,
		)) {
			if (event.kind === "waiting") {
				deps.output.writeErrRaw(".")
				continue
			}
			deps.output.writeErrRaw("\n")
			return event.settlement
		}
		deps.output.writeErrRaw("\n")
		return { status: "awaiting_approval", operationId }
	} finally {
		unregister()
	}
}

export async function handleApprovalGate(
	deps: HandlerDeps,
	settlement: OperationSettlement,
	opts: ApprovalFlagOpts,
): Promise<Exclude<OperationSettlement, { status: "awaiting_approval" }>> {
	const decision = decideApprovalGate(settlement, opts)
	switch (decision.action) {
		case "pass":
			return decision.settlement
		case "notify": {
			deps.output.warn(
				`Operation ${decision.operationId} requires approval — approve in the web UI or pass --wait-for-approval.`,
			)
			commit(decision.effects)
			throw new Error("unreachable: commit(Exit) did not terminate")
		}
		case "poll": {
			const final = await waitForApproval(
				deps,
				decision.operationId,
				decision.intervalSeconds,
			)
			if (final.status === "awaiting_approval") {
				deps.output.warn(
					"Polling canceled — operation still awaiting approval.",
				)
				commit([exitEffect(EXIT_AWAITING_APPROVAL)])
				throw new Error("unreachable: commit(Exit) did not terminate")
			}
			return final
		}
	}
}
