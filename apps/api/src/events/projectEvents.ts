import type { Project } from "../lib/db/schema"
import { subscribeJson } from "../lib/notify"
import type { JsonSseEvent } from "../lib/sse"
import {
	CHANGESET_NOTIFY_CHANNEL,
	CHANGESET_UPDATED_EVENT,
	type ChangeSetUpdatedNotification,
} from "../changesets/changesets"
import {
	OPERATION_CHANNEL,
	OPERATION_EVENT,
	RESOURCE_NOTIFY_CHANNEL,
	type OperationUpdateNotification,
	type ResourceNotification,
} from "../operations/operations"
import {
	buildResourceView,
	getResourceBySlug,
} from "../resources/resources"
import type { Actor } from "../types"

// One per-project SSE stream that multiplexes the three pg_notify channels
// (operations, resources, changesets) filtered by projectId. The wire shape
// uses the SSE `event:` line as the discriminator — the consumer keys on that
// name rather than parsing a `type` field out of `data`. Data is the raw
// notification payload from the publisher.
export async function* projectEvents(
	_actor: Actor,
	project: Project,
	signal: AbortSignal,
): AsyncGenerator<JsonSseEvent, void, void> {
	const opQueue: JsonSseEvent[] = []
	const resQueue: JsonSseEvent[] = []
	const csQueue: JsonSseEvent[] = []
	let resolve: (() => void) | null = null

	const wake = () => {
		const r = resolve
		resolve = null
		r?.()
	}

	const runChannel = async <T>(
		iter: AsyncGenerator<T, void, void>,
		queue: JsonSseEvent[],
		toEvent: (payload: T) => JsonSseEvent | null | Promise<JsonSseEvent | null>,
	) => {
		for await (const payload of iter) {
			const event = await toEvent(payload)
			if (event) {
				queue.push(event)
				wake()
			}
		}
		wake()
	}

	const opIter = subscribeJson<OperationUpdateNotification>(
		OPERATION_CHANNEL,
		signal,
		(operation) => operation.projectId === project.id,
	)
	const resIter = subscribeJson<ResourceNotification>(
		RESOURCE_NOTIFY_CHANNEL,
		signal,
		(notification) => notification.projectId === project.id,
	)
	const csIter = subscribeJson<ChangeSetUpdatedNotification>(
		CHANGESET_NOTIFY_CHANNEL,
		signal,
		(notification) => notification.projectId === project.id,
	)

	const runners = Promise.all([
		runChannel(opIter, opQueue, (operation) => ({
			event: OPERATION_EVENT,
			data: operation,
		})),
		runChannel(resIter, resQueue, async (notification) => {
			if (notification.type === "resource.deleted") {
				return {
					event: notification.type,
					data: {
						id: notification.id,
						projectId: notification.projectId,
						slug: notification.slug,
					},
				}
			}
			// Resource may have been concurrently soft-deleted between notify and
			// load — a subsequent `resource.deleted` event will reach the client,
			// so dropping this update is safe.
			const fresh = await getResourceBySlug(notification.projectId, notification.slug)
			if (!fresh) return null
			return {
				event: notification.type,
				data: await buildResourceView(fresh),
			}
		}),
		runChannel(csIter, csQueue, (notification) => ({
			event: CHANGESET_UPDATED_EVENT,
			data: notification,
		})),
	])

	try {
		while (!signal.aborted) {
			const next = opQueue.shift() ?? resQueue.shift() ?? csQueue.shift()
			if (next) {
				yield next
				continue
			}
			await new Promise<void>((r) => {
				resolve = r
				if (signal.aborted) wake()
			})
		}
	} finally {
		await runners.catch(() => {})
	}
}
