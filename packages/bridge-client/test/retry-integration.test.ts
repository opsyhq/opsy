import { expect, test } from "bun:test"
import { BridgeClient } from "../src/client"
import { defaultRetryPolicy } from "../src/core/retry"
import { BridgeTransportError } from "../src/errors"
import type { Transport, TransportCallOptions } from "../src/transport/types"
import type {
	BridgeRequest,
	BridgeResponse,
	BridgeStreamEvent,
} from "../src/wire"

class FlakyTransport implements Transport {
	calls = 0
	constructor(
		private readonly failures: number,
		private readonly response: BridgeResponse,
		private readonly errorFactory: () => Error = () =>
			new BridgeTransportError("/x", 503, "busy"),
	) {}
	async unary(
		_req: BridgeRequest,
		_opts: TransportCallOptions = {},
	): Promise<BridgeResponse> {
		this.calls++
		if (this.calls <= this.failures) throw this.errorFactory()
		return this.response
	}
	async *stream(): AsyncIterable<BridgeStreamEvent> {
		yield { kind: "final", response: this.response }
	}
	async close(): Promise<void> {}
}

const okResp: BridgeResponse = {
	op: "provider.metadata",
	server_capabilities: {
		plan_destroy: true,
		get_provider_schema_optional: true,
		move_resource_state: false,
	},
}

const metadataReq = {
	provider_source: "hashicorp/null",
	provider_version: "3.2.3",
	provider_config: {},
}

test("client retries retryable transport errors and resolves on success", async () => {
	const transport = new FlakyTransport(2, okResp)
	const client = new BridgeClient({
		transport,
		retry: defaultRetryPolicy({
			maxAttempts: 5,
			baseDelayMs: 1,
			jitter: "none",
			rng: () => 0,
		}),
	})
	const res = await client.getMetadata(metadataReq)
	expect(res).toEqual(okResp)
	expect(transport.calls).toBe(3)
})

test("client rejects after exhausting maxAttempts", async () => {
	const transport = new FlakyTransport(5, okResp)
	const client = new BridgeClient({
		transport,
		retry: defaultRetryPolicy({
			maxAttempts: 3,
			baseDelayMs: 1,
			jitter: "none",
			rng: () => 0,
		}),
	})
	await expect(client.getMetadata(metadataReq)).rejects.toThrow(
		BridgeTransportError,
	)
	expect(transport.calls).toBe(3)
})

test("client does not retry non-retryable errors (4xx)", async () => {
	const transport = new FlakyTransport(
		5,
		okResp,
		() => new BridgeTransportError("/x", 400, "bad"),
	)
	const client = new BridgeClient({
		transport,
		retry: defaultRetryPolicy({
			maxAttempts: 5,
			baseDelayMs: 1,
			jitter: "none",
			rng: () => 0,
		}),
	})
	await expect(client.getMetadata(metadataReq)).rejects.toThrow(
		BridgeTransportError,
	)
	expect(transport.calls).toBe(1)
})

test("inflight state clears once the call settles", async () => {
	const transport = new FlakyTransport(0, okResp)
	const client = new BridgeClient({ transport })
	await client.getMetadata(metadataReq)
	expect(client.getState().inflight.size).toBe(0)
})

test("onCall fires once per settled call", async () => {
	const events: number[] = []
	const transport = new FlakyTransport(1, okResp)
	const client = new BridgeClient({
		transport,
		onCall: (e) => events.push(e.status === 200 ? 1 : 0),
		retry: defaultRetryPolicy({
			maxAttempts: 3,
			baseDelayMs: 1,
			jitter: "none",
			rng: () => 0,
		}),
	})
	await client.getMetadata(metadataReq)
	expect(events).toEqual([1])
})
