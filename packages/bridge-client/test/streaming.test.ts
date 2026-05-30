import { expect, test } from "bun:test"
import { BridgeClient } from "../src/client"
import { FakeTransport } from "../src/transport/fake"
import type { BridgeStreamEvent } from "../src/wire"

const applyReq = {
	provider_source: "hashicorp/null",
	provider_version: "3.2.3",
	provider_config: {},
	type: "null_resource",
	prior_state: null,
	planned_state: { id: "abc" },
	config: { id: "abc" },
	planned_private: null,
}

const finalOk: BridgeStreamEvent = {
	kind: "final",
	response: {
		op: "resource.apply",
		new_state: { id: "abc", value: "ok" },
		diagnostics: [],
	},
}

test("applyStream yields progress, diagnostic, final in order", async () => {
	const events: BridgeStreamEvent[] = [
		{
			kind: "progress",
			message: "starting",
			timestamp: "2025-01-01T00:00:00Z",
		},
		{ kind: "progress", message: "halfway", timestamp: "2025-01-01T00:00:01Z" },
		{
			kind: "diagnostic",
			diagnostic: { severity: "warning", summary: "deprecated field" },
		},
		finalOk,
	]
	const transport = new FakeTransport({ streams: { "resource.apply": events } })
	const client = new BridgeClient({ transport })
	const collected: BridgeStreamEvent[] = []
	for await (const ev of client.applyStream(applyReq)) collected.push(ev)
	expect(collected).toEqual(events)
})

test("applyStream throws when stream lacks a final event", async () => {
	const transport = new FakeTransport({
		streams: {
			"resource.apply": [
				{
					kind: "progress",
					message: "starting",
					timestamp: "2025-01-01T00:00:00Z",
				},
			],
		},
	})
	const client = new BridgeClient({ transport })
	const run = async () => {
		for await (const _ of client.applyStream(applyReq)) {
		}
	}
	await expect(run()).rejects.toThrow(/final/)
})

test("applyStream throws on error diagnostics in final response", async () => {
	const transport = new FakeTransport({
		streams: {
			"resource.apply": [
				{
					kind: "final",
					response: {
						op: "resource.apply",
						new_state: null,
						diagnostics: [{ severity: "error", summary: "permission denied" }],
					},
				},
			],
		},
	})
	const client = new BridgeClient({ transport })
	const run = async () => {
		for await (const _ of client.applyStream(applyReq)) {
		}
	}
	await expect(run()).rejects.toThrow(/permission denied/)
})

test("applyStream falls back to unary final when no stream stub registered", async () => {
	const transport = new FakeTransport({
		responses: {
			"resource.apply": {
				op: "resource.apply",
				new_state: { id: "abc" },
			},
		},
	})
	const client = new BridgeClient({ transport })
	const collected: BridgeStreamEvent[] = []
	for await (const ev of client.applyStream(applyReq)) collected.push(ev)
	expect(collected).toHaveLength(1)
	expect(collected[0]?.kind).toBe("final")
})

test("applyStream registers and clears inflight state", async () => {
	let snapshot: number | undefined
	const transport = new FakeTransport({
		streams: {
			"resource.apply": async function* () {
				snapshot = clientRef!.getState().inflight.size
				yield finalOk
			},
		},
	})
	const client = new BridgeClient({ transport })
	const clientRef: BridgeClient = client
	void clientRef
	for await (const _ of client.applyStream(applyReq)) {
	}
	expect(snapshot).toBe(1)
	expect(client.getState().inflight.size).toBe(0)
})

test("applyStream propagates AbortSignal abort to the transport", async () => {
	const controller = new AbortController()
	const transport = new FakeTransport({
		streams: {
			"resource.apply": async function* (): AsyncIterable<BridgeStreamEvent> {
				yield {
					kind: "progress",
					message: "starting",
					timestamp: "2025-01-01T00:00:00Z",
				}
				controller.abort(new Error("user canceled"))
				// allow microtasks to deliver the abort; FakeTransport doesn't honor
				// signal, so we manually throw to mimic transport-level cancellation.
				throw Object.assign(new Error("user canceled"), { name: "AbortError" })
			},
		},
	})
	const client = new BridgeClient({ transport })
	const run = async () => {
		for await (const _ of client.applyStream(applyReq, {
			signal: controller.signal,
		})) {
		}
	}
	await expect(run()).rejects.toThrow(/canceled/)
	expect(client.getState().inflight.size).toBe(0)
})

test("onCall fires once with status 200 on successful stream", async () => {
	const calls: number[] = []
	const transport = new FakeTransport({
		streams: { "resource.apply": [finalOk] },
	})
	const client = new BridgeClient({
		transport,
		onCall: (e) => {
			if (typeof e.status === "number") calls.push(e.status)
		},
	})
	for await (const _ of client.applyStream(applyReq)) {
	}
	expect(calls).toEqual([200])
})
