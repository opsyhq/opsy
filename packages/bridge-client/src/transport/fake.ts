import type {
	BridgeOp,
	BridgeRequest,
	BridgeResponse,
	BridgeStreamEvent,
	RequestFor,
	ResponseFor,
} from "../wire"
import type { Transport, TransportCallOptions } from "./types"

type ResponseHandler<Op extends BridgeOp> =
	| ResponseFor<Op>
	| ((req: RequestFor<Op>) => ResponseFor<Op> | Promise<ResponseFor<Op>>)

type StreamHandler<Op extends BridgeOp> =
	| BridgeStreamEvent[]
	| ((
			req: RequestFor<Op>,
	  ) => Iterable<BridgeStreamEvent> | AsyncIterable<BridgeStreamEvent>)

type FakeTransportResponses = {
	[Op in BridgeOp]?: ResponseHandler<Op>
}
type FakeTransportStreams = {
	[Op in BridgeOp]?: StreamHandler<Op>
}

interface FakeTransportHandlers {
	responses?: FakeTransportResponses
	streams?: FakeTransportStreams
	onSend?: (req: BridgeRequest) => void
}

/**
 * In-memory transport for tests. Call sites stub canned responses keyed by op
 * and assert against `sent[]`. `stream()` falls back to a single `{kind:"final"}`
 * event built from the `responses` map when no dedicated stream handler is
 * registered.
 */
export class FakeTransport implements Transport {
	readonly sent: BridgeRequest[] = []
	closed = false

	constructor(private readonly handlers: FakeTransportHandlers = {}) {}

	async unary(
		req: BridgeRequest,
		_opts: TransportCallOptions = {},
	): Promise<BridgeResponse> {
		this.record(req)
		return this.resolveUnary(req)
	}

	async *stream(
		req: BridgeRequest,
		_opts: TransportCallOptions = {},
	): AsyncIterable<BridgeStreamEvent> {
		this.record(req)
		const handler = this.handlers.streams?.[req.op]
		if (handler === undefined) {
			const response = await this.resolveUnary(req)
			yield { kind: "final", response }
			return
		}
		const events =
			typeof handler === "function"
				? (
						handler as (
							r: BridgeRequest,
						) => Iterable<BridgeStreamEvent> | AsyncIterable<BridgeStreamEvent>
					)(req)
				: handler
		if (Array.isArray(events)) {
			for (const e of events) yield e
		} else if (isAsyncIterable(events)) {
			for await (const e of events) yield e
		} else if (isIterable(events)) {
			for (const e of events) yield e
		}
	}

	async close(): Promise<void> {
		this.closed = true
	}

	private record(req: BridgeRequest): void {
		this.sent.push(req)
		this.handlers.onSend?.(req)
	}

	private async resolveUnary(req: BridgeRequest): Promise<BridgeResponse> {
		const handler = this.handlers.responses?.[req.op]
		if (handler === undefined)
			throw new Error(`FakeTransport: no response stubbed for op "${req.op}"`)
		const result =
			typeof handler === "function"
				? await (
						handler as (
							r: BridgeRequest,
						) => BridgeResponse | Promise<BridgeResponse>
					)(req)
				: handler
		return result as BridgeResponse
	}
}

function isAsyncIterable(v: unknown): v is AsyncIterable<BridgeStreamEvent> {
	return typeof v === "object" && v !== null && Symbol.asyncIterator in v
}
function isIterable(v: unknown): v is Iterable<BridgeStreamEvent> {
	return typeof v === "object" && v !== null && Symbol.iterator in v
}
