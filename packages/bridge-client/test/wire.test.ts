import { expect, test } from "bun:test"
import {
	BRIDGE_OPS,
	BridgeRequestSchema,
	BridgeResponseSchema,
	BridgeStreamEventSchema,
	OP_TO_PATH,
	REQUEST_PAYLOAD_SCHEMAS,
	RESPONSE_PAYLOAD_SCHEMAS,
} from "../src/wire"

const baseRef = {
	provider_source: "hashicorp/null",
	provider_version: "3.2.3",
	provider_config: {},
}

test("BRIDGE_OPS covers every request & response schema", () => {
	for (const op of BRIDGE_OPS) {
		expect(REQUEST_PAYLOAD_SCHEMAS[op]).toBeDefined()
		expect(RESPONSE_PAYLOAD_SCHEMAS[op]).toBeDefined()
		expect(OP_TO_PATH[op]).toMatch(/^\//)
	}
})

test("BridgeRequestSchema accepts tagged provider.metadata", () => {
	const parsed = BridgeRequestSchema.parse({
		op: "provider.metadata",
		...baseRef,
	})
	expect(parsed.op).toBe("provider.metadata")
})

test("BridgeRequestSchema rejects unknown op", () => {
	expect(() => BridgeRequestSchema.parse({ op: "bogus", ...baseRef })).toThrow()
})

test("BridgeRequestSchema rejects missing required field", () => {
	expect(() =>
		BridgeRequestSchema.parse({
			op: "resource.read",
			...baseRef,
			type: "aws_s3_bucket",
			// current_state + private missing
		}),
	).toThrow()
})

test("resource.apply request accepts null planned_state (destroy)", () => {
	const req = BridgeRequestSchema.parse({
		op: "resource.apply",
		...baseRef,
		type: "aws_s3_bucket",
		prior_state: { id: "b1" },
		planned_state: null,
		config: null,
		planned_private: null,
	})
	expect(req.op).toBe("resource.apply")
	if (req.op === "resource.apply") expect(req.planned_state).toBeNull()
})

test("resource.apply response accepts null new_state (destroy result)", () => {
	const res = BridgeResponseSchema.parse({
		op: "resource.apply",
		new_state: null,
	})
	expect(res.op).toBe("resource.apply")
})

test("provider.types.schema response carries one selected schema", () => {
	const res = BridgeResponseSchema.parse({
		op: "provider.types.schema",
		type: "aws_s3_bucket",
		kind: "resource",
		schema: {
			version: 0,
			block: { attributes: { id: { type: "string" } } },
		},
	})
	expect(res.op).toBe("provider.types.schema")
	if (res.op === "provider.types.schema") expect(res.schema?.version).toBe(0)
})

test("provider.types.schema response carries block deprecation metadata", () => {
	const res = BridgeResponseSchema.parse({
		op: "provider.types.schema",
		type: "aws_old_resource",
		kind: "resource",
		schema: {
			version: 0,
			block: {
				deprecated: true,
				deprecation_message: "Use aws_new_resource instead.",
				attributes: {},
			},
		},
	})
	expect(res.op).toBe("provider.types.schema")
	if (res.op === "provider.types.schema") {
		const block = res.schema?.block
		expect(block?.deprecated).toBe(true)
		expect(block?.deprecation_message).toBe("Use aws_new_resource instead.")
	}
})

test("ValidateResponse diagnostics round-trip", () => {
	const parsed = BridgeResponseSchema.parse({
		op: "provider.validate",
		diagnostics: [
			{ severity: "warning", summary: "deprecated" },
			{ severity: "error", summary: "bad config" },
		],
	})
	expect(parsed.op).toBe("provider.validate")
	if (parsed.op === "provider.validate")
		expect(parsed.diagnostics).toHaveLength(2)
})

test("BridgeStreamEvent supports progress, diagnostic, final", () => {
	expect(
		BridgeStreamEventSchema.parse({
			kind: "progress",
			message: "applying",
			timestamp: "2026-01-01T00:00:00Z",
		}),
	).toMatchObject({ kind: "progress" })
	expect(
		BridgeStreamEventSchema.parse({
			kind: "diagnostic",
			diagnostic: { severity: "warning", summary: "slow" },
		}),
	).toMatchObject({ kind: "diagnostic" })
	expect(
		BridgeStreamEventSchema.parse({
			kind: "final",
			response: { op: "resource.apply", new_state: { id: "b1" } },
		}),
	).toMatchObject({ kind: "final" })
})

test("payload schemas strip the op tag (bodies have no op field)", () => {
	const payload = REQUEST_PAYLOAD_SCHEMAS["provider.metadata"].parse(baseRef)
	expect("op" in payload).toBe(false)
})

test("all request ops round-trip", () => {
	const samples: Record<string, unknown> = {
		"provider.metadata": { op: "provider.metadata", ...baseRef },
		"provider.summary": {
			op: "provider.summary",
			provider_source: baseRef.provider_source,
			provider_version: baseRef.provider_version,
		},
		"provider.types.search": {
			op: "provider.types.search",
			provider_source: baseRef.provider_source,
			provider_version: baseRef.provider_version,
			q: "bucket",
			kind: "resource",
			limit: 10,
		},
		"provider.types.resolve": {
			op: "provider.types.resolve",
			provider_source: baseRef.provider_source,
			provider_version: baseRef.provider_version,
			type: "aws_s3_bucket",
		},
		"provider.types.schema": {
			op: "provider.types.schema",
			provider_source: baseRef.provider_source,
			provider_version: baseRef.provider_version,
			type: "aws_s3_bucket",
			kind: "resource",
		},
		"provider.types.identity": {
			op: "provider.types.identity",
			provider_source: baseRef.provider_source,
			provider_version: baseRef.provider_version,
			type: "aws_s3_bucket",
		},
		"provider.config-schema": {
			op: "provider.config-schema",
			provider_source: baseRef.provider_source,
			provider_version: baseRef.provider_version,
		},
		"provider.validate": { op: "provider.validate", ...baseRef },
		"resource.validate": {
			op: "resource.validate",
			...baseRef,
			type: "aws_s3_bucket",
			config: {},
		},
		"resource.read": {
			op: "resource.read",
			...baseRef,
			type: "aws_s3_bucket",
			current_state: { id: "b1" },
			private: null,
		},
		"resource.plan": {
			op: "resource.plan",
			...baseRef,
			type: "aws_s3_bucket",
			prior_state: null,
			proposed_new_state: { bucket: "b1" },
			config: { bucket: "b1" },
			prior_private: null,
		},
		"resource.apply": {
			op: "resource.apply",
			...baseRef,
			type: "aws_s3_bucket",
			prior_state: null,
			planned_state: { bucket: "b1" },
			config: { bucket: "b1" },
			planned_private: null,
		},
		"resource.import": {
			op: "resource.import",
			...baseRef,
			type: "aws_s3_bucket",
			provider_id: "b1",
		},
		"datasource.read": {
			op: "datasource.read",
			...baseRef,
			type: "aws_caller_identity",
			config: {},
		},
	}
	for (const op of BRIDGE_OPS) {
		expect(BridgeRequestSchema.parse(samples[op]).op).toBe(op)
	}
})
