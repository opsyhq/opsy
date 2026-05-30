import { BridgeTransportError } from "../errors"
import {
	type BridgeRequest,
	type BridgeResponse,
	type BridgeStreamEvent,
	OP_TO_PATH,
	RESPONSE_PAYLOAD_SCHEMAS,
} from "../wire"
import type { Transport, TransportCallOptions } from "./types"

export interface HttpTransportOptions {
	/** Override the global `fetch` (useful for tests / custom agents). */
	fetch?: typeof fetch
}

/**
 * HTTP/1.1 transport. Strips the client-side `op` tag, POSTs the payload to
 * the mapped endpoint, validates the response body through the per-op Zod
 * schema, and reattaches the tag.
 *
 * `stream()` is a shim that yields exactly one `{ kind: "final", response }`
 * event. When the bridge grows Server-Sent-Events or chunked JSONL, replace
 * the body here without touching the client.
 */
export class HttpTransport implements Transport {
	private readonly fetchImpl: typeof fetch

	constructor(
		readonly baseUrl: string,
		opts: HttpTransportOptions = {},
	) {
		this.fetchImpl = opts.fetch ?? fetch
	}

	async unary(
		req: BridgeRequest,
		opts: TransportCallOptions = {},
	): Promise<BridgeResponse> {
		const path = OP_TO_PATH[req.op]
		const { op, ...payload } = req
		const signal = combineSignals(opts.signal, opts.timeoutMs)
		let res: Response
		try {
			res = await this.fetchImpl(`${this.baseUrl}${path}`, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(payload),
				signal: signal.signal,
			})
		} finally {
			signal.cleanup()
		}
		if (res.status >= 400) {
			const body = await res.text()
			throw new BridgeTransportError(path, res.status, body)
		}
		const raw = await res.json()
		const schema = RESPONSE_PAYLOAD_SCHEMAS[op]
		const parsed = schema.parse(raw)
		return { op, ...parsed } as BridgeResponse
	}

	async *stream(
		req: BridgeRequest,
		opts: TransportCallOptions = {},
	): AsyncIterable<BridgeStreamEvent> {
		const response = await this.unary(req, opts)
		yield { kind: "final", response }
	}

	async close(): Promise<void> {
		// HTTP/1.1 fetch is connectionless from our perspective; nothing to close.
	}
}

function combineSignals(
	userSignal: AbortSignal | undefined,
	timeoutMs: number | undefined,
): { signal: AbortSignal | undefined; cleanup: () => void } {
	if (!userSignal && !timeoutMs) return { signal: undefined, cleanup: () => {} }
	if (!timeoutMs) return { signal: userSignal, cleanup: () => {} }
	const controller = new AbortController()
	const timer = setTimeout(
		() =>
			controller.abort(new Error(`bridge call timed out after ${timeoutMs}ms`)),
		timeoutMs,
	)
	const onUserAbort = () => controller.abort(userSignal?.reason)
	if (userSignal) {
		if (userSignal.aborted) controller.abort(userSignal.reason)
		else userSignal.addEventListener("abort", onUserAbort, { once: true })
	}
	return {
		signal: controller.signal,
		cleanup: () => {
			clearTimeout(timer)
			userSignal?.removeEventListener("abort", onUserAbort)
		},
	}
}
