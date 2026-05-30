import type { InferResponseType } from "hono/client"
import type { client } from "../../client"

// The operation-detail response is the API contract — `{ operation, resource }`.
// Not re-declared here: derived from the Hono client so it can never drift.
export type OperationResultResponse = InferResponseType<
	(typeof client.operations)[":id"]["$get"],
	200
>

export type OperationSettlement =
	| { status: "succeeded"; data: OperationResultResponse }
	| { status: "failed"; data: OperationResultResponse }
	| { status: "canceled"; data: OperationResultResponse }
	| { status: "awaiting_approval"; operationId: string }

export function toOperationSettlement(
	data: OperationResultResponse,
): OperationSettlement {
	const status = data.operation.status
	if (status === "awaiting_approval") {
		return { status: "awaiting_approval", operationId: data.operation.id }
	}
	if (status === "succeeded" || status === "failed" || status === "canceled") {
		return { status, data }
	}
	throw new Error(
		`unexpected terminal operation status "${status}" for operation ${data.operation.id}`,
	)
}
