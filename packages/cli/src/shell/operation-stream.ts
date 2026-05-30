import type { OperationUpdateNotification } from "@opsy/api"
import { apiJsonStream } from "./sse/api-stream"

type OperationEvent = OperationUpdateNotification

export async function* watchOperationStatus(
	operationId: string,
	signal?: AbortSignal,
): AsyncGenerator<OperationEvent> {
	for await (const event of apiJsonStream<OperationEvent>(
		`/events/operation/${encodeURIComponent(operationId)}`,
		{
			signal,
			reconnect: true,
		},
	)) {
		yield event
		if (event.closedAt) return
	}
}
