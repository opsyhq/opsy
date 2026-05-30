import type { BridgeRequest, BridgeResponse, BridgeStreamEvent } from "../wire"

export interface TransportCallOptions {
	signal?: AbortSignal
	timeoutMs?: number
}

/**
 * Transport is the wire-level seam. The client funnels every RPC through it,
 * and tests inject a `FakeTransport`. `HttpTransport` is the default HTTP/1.1
 * implementation; future `WsTransport` / `InProcessTransport` will plug in
 * here without the client noticing.
 *
 * The `op` tag on `BridgeRequest`/`BridgeResponse` is a client-side
 * discriminator; how (or whether) it appears on the wire is the transport's
 * concern. `HttpTransport` strips it and path-maps to the 9 existing HTTP
 * endpoints.
 */
export interface Transport {
	unary(
		req: BridgeRequest,
		opts?: TransportCallOptions,
	): Promise<BridgeResponse>
	stream(
		req: BridgeRequest,
		opts?: TransportCallOptions,
	): AsyncIterable<BridgeStreamEvent>
	close(): Promise<void>
}
