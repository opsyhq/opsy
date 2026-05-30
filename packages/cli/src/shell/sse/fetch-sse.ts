// fetch-based SSE client: Last-Event-ID resume, per-stream dedup (last
// colon splits stream-id from sequence), retry on transport / 5xx,
// AbortSignal. We don't use browser EventSource because it can't set
// custom headers (no bearer auth) and doesn't support AbortController.

import { type EventSourceMessage, parseSseStream } from "@core/sse/parser"

export type SseMessage = EventSourceMessage

type FetchSseOptions = {
	url: string
	init?: RequestInit
	/** Called on every connection attempt (including reconnects). Merged with `init`; takes precedence. */
	getInit?: () => RequestInit | Promise<RequestInit>
	fetch?: typeof globalThis.fetch
	signal?: AbortSignal
	lastEventId?: string | null
	reconnect?: boolean
	reconnectDelayMs?: number
	maxSeenEventIds?: number
}

type HeadersLike = ConstructorParameters<typeof Headers>[0]

function mergeHeaders(...sources: Array<HeadersLike | undefined>): Headers {
	const headers = new Headers()
	for (const source of sources) {
		if (!source) {
			continue
		}
		const next = new Headers(source)
		next.forEach((value, key) => {
			headers.set(key, value)
		})
	}
	return headers
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
	return new Promise((resolve) => {
		const timer = setTimeout(resolve, ms)
		signal?.addEventListener(
			"abort",
			() => {
				clearTimeout(timer)
				resolve()
			},
			{ once: true },
		)
	})
}

export async function* fetchSse(
	options: FetchSseOptions,
): AsyncGenerator<SseMessage> {
	const fetchImpl = options.fetch ?? globalThis.fetch
	if (!fetchImpl) {
		throw new Error("fetch is not available.")
	}

	const maxSeenEventIds = options.maxSeenEventIds ?? 512
	const seenEventIds = new Set<string>()
	const seenEventIdQueue: string[] = []
	const highestSequenceByStream = new Map<string, number>()
	let lastEventId = options.lastEventId ?? null
	const reconnect = options.reconnect ?? true
	const reconnectDelayMs = options.reconnectDelayMs ?? 1_000

	while (!options.signal?.aborted) {
		try {
			const dynamicInit = options.getInit ? await options.getInit() : undefined
			const headers = mergeHeaders(
				options.init?.headers,
				dynamicInit?.headers,
				{
					Accept: "text/event-stream",
				},
			)
			if (lastEventId) {
				headers.set("Last-Event-ID", lastEventId)
			}

			const response = await fetchImpl(options.url, {
				...options.init,
				...dynamicInit,
				headers,
				signal: options.signal,
			})

			if (!response.ok) {
				if (response.status >= 400 && response.status < 500) {
					throw Object.assign(new Error(`SSE response ${response.status}`), {
						status: response.status,
					})
				}
				// 5xx — retriable
				throw Object.assign(new Error(`SSE response ${response.status}`), {
					status: response.status,
					retriable: true,
				})
			}
			if (!response.body) {
				throw new Error("SSE response has no body.")
			}

			for await (const event of parseSseStream(response.body, options.signal)) {
				if (event.id) {
					lastEventId = event.id
					const separator = event.id.lastIndexOf(":")
					const streamId = separator > 0 ? event.id.slice(0, separator) : null
					const sequenceText =
						separator > 0 ? event.id.slice(separator + 1) : null
					if (streamId && sequenceText && /^\d+$/.test(sequenceText)) {
						const sequence = Number.parseInt(sequenceText, 10)
						if (sequence <= (highestSequenceByStream.get(streamId) ?? 0)) {
							continue
						}
						highestSequenceByStream.set(streamId, sequence)
					} else {
						if (seenEventIds.has(event.id)) {
							continue
						}
						seenEventIds.add(event.id)
						seenEventIdQueue.push(event.id)
						if (seenEventIdQueue.length > maxSeenEventIds) {
							const evictedId = seenEventIdQueue.shift()
							if (evictedId) {
								seenEventIds.delete(evictedId)
							}
						}
					}
				}
				yield event
			}

			// Stream ended normally — reconnect if enabled
			if (!reconnect || options.signal?.aborted) {
				return
			}
			await delay(reconnectDelayMs, options.signal)
		} catch (error) {
			if (options.signal?.aborted) {
				return
			}
			// Network errors (TypeError) and 5xx responses are retriable
			const isRetriable =
				error instanceof TypeError ||
				(error as { retriable?: boolean })?.retriable === true
			if (!reconnect || !isRetriable) {
				throw error
			}
			await delay(reconnectDelayMs, options.signal)
		}
	}
}
