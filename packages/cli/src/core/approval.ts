import type { HandlerDeps } from "@core/types/deps"
import { type Effect, exitEffect } from "./effects"
import { apiError } from "./errors"
import {
	type OperationSettlement,
	toOperationSettlement,
} from "./types/operation-settlement"

const EXIT_AWAITING_APPROVAL = 2

type PollEvent =
	| { kind: "waiting" }
	| { kind: "settled"; settlement: OperationSettlement }

export async function* pollOperationStatus(
	deps: HandlerDeps,
	operationId: string,
	intervalMs: number,
	signal?: AbortSignal,
): AsyncGenerator<PollEvent> {
	while (true) {
		if (signal?.aborted) return
		const res = await deps.client.operations[":id"].$get({
			param: { id: operationId },
		})
		if (!res.ok) throw apiError(res.status, await res.text())
		const data = await res.json()
		const status = data.operation.status
		if (
			status === "succeeded" ||
			status === "failed" ||
			status === "canceled"
		) {
			yield { kind: "settled", settlement: toOperationSettlement(data) }
			return
		}
		yield { kind: "waiting" }
		await deps.sleep(intervalMs, signal)
	}
}

export interface ApprovalFlagOpts {
	waitForApproval?: boolean
	approvalPollInterval?: string
}

export function parseIntervalSeconds(
	raw: string | undefined,
	fallback: number,
): number {
	if (!raw) return fallback
	const n = Number(raw)
	if (!Number.isFinite(n) || n <= 0) return fallback
	return n
}

type ApprovalDecision =
	| {
			action: "pass"
			settlement: Exclude<OperationSettlement, { status: "awaiting_approval" }>
	  }
	| { action: "poll"; operationId: string; intervalSeconds: number }
	| { action: "notify"; operationId: string; effects: Effect[] }

export function decideApprovalGate(
	settlement: OperationSettlement,
	opts: ApprovalFlagOpts,
): ApprovalDecision {
	if (settlement.status !== "awaiting_approval") {
		return { action: "pass", settlement }
	}
	if (!opts.waitForApproval) {
		return {
			action: "notify",
			operationId: settlement.operationId,
			effects: [exitEffect(EXIT_AWAITING_APPROVAL)],
		}
	}
	return {
		action: "poll",
		operationId: settlement.operationId,
		intervalSeconds: parseIntervalSeconds(opts.approvalPollInterval, 5),
	}
}
