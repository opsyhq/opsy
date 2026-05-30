import { expect, test } from "bun:test"
import { BridgeClient } from "../src/client"
import { FakeTransport } from "../src/transport/fake"
import type { Transport, TransportCallOptions } from "../src/transport/types"
import type { BridgeRequest, BridgeResponse } from "../src/wire"

const metadataReq = {
	provider_source: "hashicorp/null",
	provider_version: "3.2.3",
	provider_config: {},
}

const okResp: BridgeResponse = {
	op: "provider.metadata",
	server_capabilities: {
		plan_destroy: true,
		get_provider_schema_optional: true,
		move_resource_state: false,
	},
}

test("fresh client exposes empty state", () => {
	const client = new BridgeClient({ transport: new FakeTransport({}) })
	const s = client.getState()
	expect(s.inflight.size).toBe(0)
})

test("inflight contains the entry while a unary call is in progress", async () => {
	let snapshotSize = -1
	let snapshotEntry: { op?: string; attempt?: number; mode?: string } = {}
	class CapturingTransport implements Transport {
		constructor(private readonly client: () => BridgeClient) {}
		async unary(
			_req: BridgeRequest,
			_opts?: TransportCallOptions,
		): Promise<BridgeResponse> {
			const c = this.client()
			snapshotSize = c.getState().inflight.size
			const entry = [...c.getState().inflight.values()][0]
			snapshotEntry = {
				op: entry?.op,
				attempt: entry?.attempt,
				mode: entry?.mode,
			}
			return okResp
		}
		async *stream(): AsyncIterable<never> {}
		async close(): Promise<void> {}
	}
	let client!: BridgeClient
	const transport = new CapturingTransport(() => client)
	client = new BridgeClient({ transport })
	await client.getMetadata(metadataReq)
	expect(snapshotSize).toBe(1)
	expect(snapshotEntry).toEqual({
		op: "provider.metadata",
		attempt: 1,
		mode: "unary",
	})
	expect(client.getState().inflight.size).toBe(0)
})

test("inflight clears even when a call rejects", async () => {
	const transport = new FakeTransport({
		responses: {
			"provider.metadata": () => {
				throw new Error("boom")
			},
		},
	})
	const client = new BridgeClient({ transport })
	await expect(client.getMetadata(metadataReq)).rejects.toThrow(/boom/)
	expect(client.getState().inflight.size).toBe(0)
})

test("getState returns the live state map (read-only contract)", () => {
	const client = new BridgeClient({ transport: new FakeTransport({}) })
	const s1 = client.getState()
	const s2 = client.getState()
	expect(s1).toBe(s2) // identity stable until next dispatch
})
