import type { Operation } from "../lib/db/schema"
import { subscribeJson } from "../lib/notify"
import type { JsonSseEvent } from "../lib/sse"
import type { Actor } from "../types"
import {
	OPERATION_CHANNEL,
	OPERATION_EVENT,
	type OperationUpdateNotification,
	operationUpdateNotification,
} from "./operations"

export async function* operationEvents(
	_actor: Actor,
	initial: Operation,
	signal: AbortSignal,
): AsyncGenerator<JsonSseEvent, void, void> {
	yield {
		event: OPERATION_EVENT,
		data: operationUpdateNotification(initial),
	}
	if (initial.closedAt) return

	for await (const operation of subscribeJson<OperationUpdateNotification>(
		OPERATION_CHANNEL,
		signal,
		(operation) => operation.id === initial.id,
	)) {
		yield {
			event: OPERATION_EVENT,
			data: operation,
		}
		if (operation.closedAt) return
	}
}
