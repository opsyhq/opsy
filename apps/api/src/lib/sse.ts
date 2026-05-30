import type { Context } from "hono"
import { streamSSE } from "hono/streaming"

const HEARTBEAT_MS = 5_000

export interface JsonSseEvent {
	event: string
	data: unknown
}

export function streamJsonSse(
	c: Context,
	events: (signal: AbortSignal) => AsyncIterable<JsonSseEvent>,
): Response {
	return streamSSE(c, async (stream) => {
		const ac = new AbortController()
		let closed = false

		const close = () => {
			if (closed) return
			closed = true
			ac.abort()
		}

		const reqSignal = c.req.raw.signal
		if (reqSignal.aborted) close()
		else reqSignal.addEventListener("abort", close)
		stream.onAbort(close)

		const heartbeat = setInterval(() => {
			if (closed) return
			void stream.write(": heartbeat\n\n").catch(close)
		}, HEARTBEAT_MS)

		try {
			await stream.write(": connected\n\n")
			for await (const message of events(ac.signal)) {
				if (closed) break
				await stream.writeSSE({
					event: message.event,
					data: JSON.stringify(message.data),
				})
			}
		} catch {
			close()
		} finally {
			clearInterval(heartbeat)
			reqSignal.removeEventListener("abort", close)
			close()
		}
	})
}
