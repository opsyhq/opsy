import { expect, test } from "bun:test"
import { BridgeTransportError } from "../errors"
import { computeBackoff, defaultRetryPolicy, type RetryPolicy } from "./retry"

const deterministic = (rng: number): RetryPolicy =>
	defaultRetryPolicy({
		maxAttempts: 5,
		baseDelayMs: 100,
		maxDelayMs: 30_000,
		jitter: "none",
		rng: () => rng,
	})

test("no-jitter backoff doubles each attempt and caps at maxDelayMs", () => {
	const p = deterministic(0)
	expect(computeBackoff(p, 1)).toBe(100)
	expect(computeBackoff(p, 2)).toBe(200)
	expect(computeBackoff(p, 3)).toBe(400)
	expect(computeBackoff(p, 10)).toBe(30_000) // capped
})

test("equal jitter stays within [base/2, base] (rng=0.5 → midpoint)", () => {
	const p = defaultRetryPolicy({
		baseDelayMs: 100,
		maxDelayMs: 10_000,
		jitter: "equal",
		rng: () => 0.5,
	})
	expect(computeBackoff(p, 1)).toBe(75) // 50 + 0.5 * 50
	expect(computeBackoff(p, 2)).toBe(150)
})

test("full jitter scales base by rng()", () => {
	const p = defaultRetryPolicy({
		baseDelayMs: 100,
		jitter: "full",
		rng: () => 0.25,
	})
	expect(computeBackoff(p, 1)).toBe(25)
	expect(computeBackoff(p, 3)).toBe(100)
})

test("defaultRetryable retries 5xx and network errors, not 4xx or Abort", () => {
	const { retryable } = defaultRetryPolicy({})
	expect(retryable(new BridgeTransportError("/x", 503, ""))).toBe(true)
	expect(retryable(new BridgeTransportError("/x", 400, ""))).toBe(false)
	expect(retryable(new BridgeTransportError("/x", 404, ""))).toBe(false)
	const abort = new Error("aborted")
	abort.name = "AbortError"
	expect(retryable(abort)).toBe(false)
	expect(retryable(new Error("ECONNRESET"))).toBe(true)
})

test("defaults to a single attempt (no retries) unless overridden", () => {
	const p = defaultRetryPolicy({})
	expect(p.maxAttempts).toBe(1)
})
