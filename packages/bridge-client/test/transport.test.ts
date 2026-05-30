import { expect, test } from "bun:test"
import { BridgeClient } from "../src/client"
import { BridgeTransportError } from "../src/errors"
import { FakeTransport } from "../src/transport/fake"
import { HttpTransport } from "../src/transport/http"
import type { BridgeRequest } from "../src/wire"

const baseRef = {
	provider_source: "hashicorp/null",
	provider_version: "3.2.3",
	provider_config: {},
}

test("FakeTransport resolves canned unary responses", async () => {
	const fake = new FakeTransport({
		responses: {
			"provider.metadata": {
				op: "provider.metadata",
				server_capabilities: {
					plan_destroy: true,
					get_provider_schema_optional: true,
					move_resource_state: false,
				},
			},
		},
	})
	const client = new BridgeClient({ transport: fake })
	const res = await client.getMetadata(baseRef)
	expect(res.server_capabilities.plan_destroy).toBe(true)
	expect(fake.sent).toHaveLength(1)
	expect(fake.sent[0]?.op).toBe("provider.metadata")
})

test("FakeTransport supports response functions", async () => {
	const fake = new FakeTransport({
		responses: {
			"resource.import": (req) => ({
				op: "resource.import",
				imported_resources: [
					{ type_name: req.type, state: { id: req.provider_id } },
				],
			}),
		},
	})
	const client = new BridgeClient({ transport: fake })
	const res = await client.importResource({
		...baseRef,
		type: "aws_s3_bucket",
		provider_id: "b1",
	})
	expect(res.imported_resources).toEqual([
		{ type_name: "aws_s3_bucket", state: { id: "b1" } },
	])
})

test("FakeTransport throws when op is not stubbed", async () => {
	const fake = new FakeTransport({})
	const client = new BridgeClient({ transport: fake })
	await expect(client.getMetadata(baseRef)).rejects.toThrow(
		/no response stubbed/,
	)
})

test("FakeTransport.stream falls back to unary response wrapped as final", async () => {
	const fake = new FakeTransport({
		responses: {
			"resource.apply": {
				op: "resource.apply",
				new_state: { id: "b1" },
			},
		},
	})
	const events: unknown[] = []
	for await (const ev of fake.stream({
		op: "resource.apply",
		...baseRef,
		type: "aws_s3_bucket",
		prior_state: null,
		planned_state: { id: "b1" },
		config: { id: "b1" },
		planned_private: null,
	})) {
		events.push(ev)
	}
	expect(events).toHaveLength(1)
	expect(events[0]).toMatchObject({ kind: "final" })
})

test("FakeTransport records sent requests for assertions", async () => {
	const fake = new FakeTransport({
		responses: { "provider.validate": { op: "provider.validate" } },
	})
	const client = new BridgeClient({ transport: fake })
	await client.validateProvider(baseRef)
	await client.validateProvider(baseRef)
	expect(fake.sent).toHaveLength(2)
	for (const r of fake.sent) expect(r.op).toBe("provider.validate")
})

test("HttpTransport maps op to correct path and POSTs stripped payload", async () => {
	let capturedUrl = ""
	let capturedBody: unknown = null
	const fakeFetch = (async (input: string, init: RequestInit) => {
		capturedUrl = input
		capturedBody = JSON.parse(init.body as string)
		return new Response(
			JSON.stringify({
				server_capabilities: {
					plan_destroy: true,
					get_provider_schema_optional: true,
					move_resource_state: false,
				},
			}),
			{ status: 200, headers: { "content-type": "application/json" } },
		)
	}) as unknown as typeof fetch
	const transport = new HttpTransport("http://localhost:9999", {
		fetch: fakeFetch,
	})
	const req: BridgeRequest = { op: "provider.metadata", ...baseRef }
	const res = await transport.unary(req)
	expect(capturedUrl).toBe("http://localhost:9999/providers/metadata")
	expect(capturedBody).toEqual(baseRef)
	expect((res as { op: string }).op).toBe("provider.metadata")
})

test("instanceof BridgeTransportError matches cross-realm instances by brand", () => {
	// Same Nitro multi-bundle scenario as BridgeDiagnosticError (see diagnostics.test.ts).
	const brand = Symbol.for("opsy.BridgeTransportError")
	const foreign = Object.assign(new Error("from another realm"), { [brand]: true })
	expect(foreign instanceof BridgeTransportError).toBe(true)
	expect(new Error("plain") instanceof BridgeTransportError).toBe(false)
})

test("HttpTransport raises BridgeTransportError on 5xx", async () => {
	const fakeFetch = (async () =>
		new Response("boom", { status: 500 })) as unknown as typeof fetch
	const transport = new HttpTransport("http://localhost:9999", {
		fetch: fakeFetch,
	})
	await expect(
		transport.unary({ op: "provider.metadata", ...baseRef }),
	).rejects.toBeInstanceOf(BridgeTransportError)
})

test("HttpTransport.stream yields a single final event", async () => {
	const fakeFetch = (async () =>
		new Response(JSON.stringify({ new_state: { id: "b1" } }), {
			status: 200,
			headers: { "content-type": "application/json" },
		})) as unknown as typeof fetch
	const transport = new HttpTransport("http://localhost:9999", {
		fetch: fakeFetch,
	})
	const events: unknown[] = []
	for await (const ev of transport.stream({
		op: "resource.apply",
		...baseRef,
		type: "aws_s3_bucket",
		prior_state: null,
		planned_state: { id: "b1" },
		config: { id: "b1" },
		planned_private: null,
	})) {
		events.push(ev)
	}
	expect(events).toHaveLength(1)
	expect(events[0]).toMatchObject({ kind: "final" })
})

test("BridgeClient.fromUrl wires an HttpTransport", () => {
	const client = BridgeClient.fromUrl("http://127.0.0.1:1234")
	expect(client).toBeInstanceOf(BridgeClient)
})
