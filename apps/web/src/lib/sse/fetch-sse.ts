import type {
	ProjectOperationUpdate,
	ProjectResource,
} from "@/lib/projectReactQuery"
import { type EventSourceMessage, parseSseStream } from "./parser"

// Reconnect backoff: 1s base, doubled per attempt with up to 30% jitter,
// capped at 30s. SSE deltas are not replay-safe, so we resync on every
// reconnect (see ProjectEventHandlerDeps.resyncOnReconnect) — backoff just
// avoids hammering an unhealthy server.
const RECONNECT_BASE_MS = 1_000
const RECONNECT_MAX_MS = 30_000

interface FetchEventStreamOptions {
	url: string
	signal?: AbortSignal
	reconnect?: boolean
	// Fired whenever the underlying transport reconnects (after the first
	// connection has produced events but the stream then closed or errored).
	// Consumers use this to resync state since SSE deltas are not replay-safe.
	onReconnect?: () => void
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
	return new Promise((resolve) => {
		const onAbort = () => {
			clearTimeout(timer)
			resolve()
		}
		const timer = setTimeout(() => {
			signal?.removeEventListener("abort", onAbort)
			resolve()
		}, ms)
		signal?.addEventListener("abort", onAbort, { once: true })
	})
}

function reconnectDelayMs(attempt: number): number {
	const exp = RECONNECT_BASE_MS * 2 ** attempt
	return Math.min(exp * (1 + Math.random() * 0.3), RECONNECT_MAX_MS)
}

async function* fetchSse(
	opts: FetchEventStreamOptions,
): AsyncGenerator<EventSourceMessage> {
	const reconnect = opts.reconnect ?? true
	let connected = false
	let attempt = 0

	while (!opts.signal?.aborted) {
		try {
			const headers = new Headers({ Accept: "text/event-stream" })

			if (connected) opts.onReconnect?.()

			const response = await fetch(opts.url, {
				headers,
				credentials: "include",
				signal: opts.signal,
			})

			if (!response.ok) {
				if (response.status >= 400 && response.status < 500) {
					throw new Error(`SSE response ${response.status}`)
				}
				throw Object.assign(new Error(`SSE response ${response.status}`), {
					retriable: true,
				})
			}
			if (!response.body) throw new Error("SSE response has no body.")

			connected = true
			attempt = 0
			for await (const event of parseSseStream(response.body, opts.signal)) {
				yield event
			}

			if (!reconnect || opts.signal?.aborted) return
			await delay(reconnectDelayMs(attempt++), opts.signal)
		} catch (error) {
			if (opts.signal?.aborted) return
			const isRetriable =
				error instanceof TypeError ||
				(error as { retriable?: boolean })?.retriable === true
			if (!reconnect || !isRetriable) throw error
			await delay(reconnectDelayMs(attempt++), opts.signal)
		}
	}
}

export type ProjectEvent =
	| { event: "operation.updated"; data: ProjectOperationUpdate }
	| { event: "resource.created"; data: ProjectResource }
	| { event: "resource.updated"; data: ProjectResource }
	| {
			event: "resource.deleted"
			data: { id: string; projectId: string; slug: string }
	  }
	| { event: "changeset.updated"; data: { id: string; projectId: string } }

const PROJECT_EVENT_NAMES = new Set<ProjectEvent["event"]>([
	"operation.updated",
	"resource.created",
	"resource.updated",
	"resource.deleted",
	"changeset.updated",
])

// Discriminate by the SSE `event:` field; payloads are trusted from the
// backend contract — runtime narrowing is just the event-name check, the
// payload shape is the API row type.
export async function* fetchProjectEvents(
	opts: FetchEventStreamOptions,
): AsyncGenerator<ProjectEvent> {
	for await (const msg of fetchSse(opts)) {
		if (!msg.event || !msg.data) continue
		if (!PROJECT_EVENT_NAMES.has(msg.event as ProjectEvent["event"])) continue
		try {
			const data = JSON.parse(msg.data) as unknown
			yield { event: msg.event, data } as ProjectEvent
		} catch {
			// Skip malformed SSE data; the stream keeps flowing.
		}
	}
}
