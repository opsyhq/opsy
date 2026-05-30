import { expect, test } from "bun:test"
import { BridgeTransportError } from "../errors"
import type { BridgeRequest, BridgeResponse } from "../wire"
import { defaultRetryPolicy, type RetryPolicy } from "./retry"
import { createBridgeClientState, step } from "./state"

const req: BridgeRequest = {
	op: "provider.metadata",
	provider_source: "hashicorp/null",
	provider_version: "3.2.3",
	provider_config: {},
}
const ok: BridgeResponse = {
	op: "provider.metadata",
	server_capabilities: {
		plan_destroy: true,
		get_provider_schema_optional: true,
		move_resource_state: false,
	},
}

const noRetry = defaultRetryPolicy({ maxAttempts: 1, rng: () => 0.5 })
const withRetry: RetryPolicy = defaultRetryPolicy({
	maxAttempts: 3,
	baseDelayMs: 100,
	jitter: "none",
	rng: () => 0.5,
})

test("Send inserts inflight and emits SendOnWire (+ ArmTimeout when budgeted)", () => {
	const s0 = createBridgeClientState()
	const { next, effects } = step(
		s0,
		{ type: "Send", id: "r1", req, now: 0, timeoutMs: 5000 },
		noRetry,
	)
	expect(next.inflight.size).toBe(1)
	expect(next.inflight.get("r1")?.attempt).toBe(1)
	expect(effects).toEqual([
		{ kind: "SendOnWire", id: "r1", req, timeoutMs: 5000 },
		{ kind: "ArmTimeout", id: "r1", delayMs: 5000 },
	])
})

test("Send with null timeout emits only SendOnWire", () => {
	const s0 = createBridgeClientState()
	const { effects } = step(
		s0,
		{ type: "Send", id: "r1", req, now: 0, timeoutMs: null },
		noRetry,
	)
	expect(effects).toHaveLength(1)
	expect(effects[0]?.kind).toBe("SendOnWire")
})

test("duplicate Send for same id is a no-op", () => {
	const s0 = createBridgeClientState()
	const { next: s1 } = step(
		s0,
		{ type: "Send", id: "r1", req, now: 0, timeoutMs: null },
		noRetry,
	)
	const { next: s2, effects } = step(
		s1,
		{ type: "Send", id: "r1", req, now: 1, timeoutMs: null },
		noRetry,
	)
	expect(s2).toBe(s1)
	expect(effects).toEqual([])
})

test("Delivered removes inflight and resolves caller", () => {
	const s0 = createBridgeClientState()
	const { next: s1 } = step(
		s0,
		{ type: "Send", id: "r1", req, now: 0, timeoutMs: null },
		noRetry,
	)
	const { next: s2, effects } = step(
		s1,
		{ type: "Delivered", id: "r1", response: ok },
		noRetry,
	)
	expect(s2.inflight.has("r1")).toBe(false)
	expect(effects).toEqual([
		{ kind: "ClearTimer", id: "r1" },
		{ kind: "ResolveCaller", id: "r1", response: ok },
	])
})

test("Delivered for unknown id is a no-op", () => {
	const s0 = createBridgeClientState()
	const { next, effects } = step(
		s0,
		{ type: "Delivered", id: "ghost", response: ok },
		noRetry,
	)
	expect(next).toBe(s0)
	expect(effects).toEqual([])
})

test("Errored with non-retryable error rejects the caller", () => {
	const s0 = createBridgeClientState()
	const { next: s1 } = step(
		s0,
		{ type: "Send", id: "r1", req, now: 0, timeoutMs: null },
		noRetry,
	)
	const err = new BridgeTransportError("/x", 400, "bad request")
	const { next: s2, effects } = step(
		s1,
		{ type: "Errored", id: "r1", error: err, now: 1 },
		withRetry,
	)
	expect(s2.inflight.has("r1")).toBe(false)
	expect(effects).toEqual([
		{ kind: "ClearTimer", id: "r1" },
		{ kind: "RejectCaller", id: "r1", error: err },
	])
})

test("Errored with retryable error schedules a retry", () => {
	const s0 = createBridgeClientState()
	const { next: s1 } = step(
		s0,
		{ type: "Send", id: "r1", req, now: 0, timeoutMs: null },
		withRetry,
	)
	const err = new BridgeTransportError("/x", 503, "busy")
	const { next: s2, effects } = step(
		s1,
		{ type: "Errored", id: "r1", error: err, now: 1 },
		withRetry,
	)
	expect(s2.inflight.get("r1")?.attempt).toBe(2)
	expect(effects).toEqual([
		{ kind: "ClearTimer", id: "r1" },
		{ kind: "ScheduleRetry", id: "r1", delayMs: 100 },
	])
})

test("Errored past maxAttempts rejects instead of retrying", () => {
	const policy = defaultRetryPolicy({
		maxAttempts: 2,
		baseDelayMs: 10,
		jitter: "none",
		rng: () => 0,
	})
	const s0 = createBridgeClientState()
	const { next: s1 } = step(
		s0,
		{ type: "Send", id: "r1", req, now: 0, timeoutMs: null },
		policy,
	)
	const err = new BridgeTransportError("/x", 503, "busy")
	const { next: s2 } = step(
		s1,
		{ type: "Errored", id: "r1", error: err, now: 1 },
		policy,
	)
	// attempt === 2, now at cap
	const { next: s3 } = step(s2, { type: "RetryDue", id: "r1", now: 2 }, policy)
	expect(s3.inflight.get("r1")?.attempt).toBe(2)
	const { effects: final } = step(
		s3,
		{ type: "Errored", id: "r1", error: err, now: 3 },
		policy,
	)
	expect(final.find((e) => e.kind === "RejectCaller")).toBeDefined()
})

test("TimedOut retries even if error predicate would say no", () => {
	const pickyPolicy = defaultRetryPolicy({
		maxAttempts: 2,
		baseDelayMs: 50,
		jitter: "none",
		rng: () => 0,
		retryable: () => false, // refuse all non-timeout errors
	})
	const s0 = createBridgeClientState()
	const { next: s1 } = step(
		s0,
		{ type: "Send", id: "r1", req, now: 0, timeoutMs: 100 },
		pickyPolicy,
	)
	const { next: s2, effects } = step(
		s1,
		{ type: "TimedOut", id: "r1", now: 101 },
		pickyPolicy,
	)
	expect(s2.inflight.get("r1")?.attempt).toBe(2)
	expect(effects.find((e) => e.kind === "ScheduleRetry")).toBeDefined()
})

test("RetryDue re-sends with same request", () => {
	const s0 = createBridgeClientState()
	const { next: s1 } = step(
		s0,
		{ type: "Send", id: "r1", req, now: 0, timeoutMs: null },
		withRetry,
	)
	const err = new BridgeTransportError("/x", 503, "busy")
	const { next: s2 } = step(
		s1,
		{ type: "Errored", id: "r1", error: err, now: 1 },
		withRetry,
	)
	const { next: s3, effects } = step(
		s2,
		{ type: "RetryDue", id: "r1", now: 10 },
		withRetry,
	)
	expect(effects).toEqual([
		{ kind: "SendOnWire", id: "r1", req, timeoutMs: null },
	])
	expect(s3.inflight.get("r1")?.attempt).toBe(2)
})

test("Canceled rejects caller with provided reason", () => {
	const s0 = createBridgeClientState()
	const { next: s1 } = step(
		s0,
		{ type: "Send", id: "r1", req, now: 0, timeoutMs: null },
		noRetry,
	)
	const reason = Object.assign(new Error("user cancel"), { name: "AbortError" })
	const { next: s2, effects } = step(
		s1,
		{ type: "Canceled", id: "r1", reason },
		noRetry,
	)
	expect(s2.inflight.has("r1")).toBe(false)
	expect(effects.find((e) => e.kind === "RejectCaller")).toMatchObject({
		error: reason,
	})
})

test("Canceled for unknown id is a no-op", () => {
	const s0 = createBridgeClientState()
	const { next, effects } = step(s0, { type: "Canceled", id: "ghost" }, noRetry)
	expect(next).toBe(s0)
	expect(effects).toEqual([])
})
