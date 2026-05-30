import { BridgeTransportError } from "../errors"

type Jitter = "none" | "equal" | "full"

export interface RetryPolicy {
	/** Total attempts including the first. `1` disables retry. */
	maxAttempts: number
	baseDelayMs: number
	maxDelayMs: number
	jitter: Jitter
	retryable: (err: Error) => boolean
	/** Injectable RNG so backoff is deterministic in tests. */
	rng: () => number
}

/**
 * Exponential backoff with configurable jitter. `attempt` is 1-indexed
 * (the delay before the *next* attempt; i.e. after a failed attempt 1,
 * computeBackoff(policy, 1) yields the delay before attempt 2).
 */
export function computeBackoff(policy: RetryPolicy, attempt: number): number {
	const base = Math.min(
		policy.maxDelayMs,
		policy.baseDelayMs * 2 ** Math.max(0, attempt - 1),
	)
	switch (policy.jitter) {
		case "none":
			return base
		case "equal":
			return base / 2 + policy.rng() * (base / 2)
		case "full":
			return policy.rng() * base
	}
}

export function defaultRetryPolicy(
	overrides: Partial<RetryPolicy> = {},
): RetryPolicy {
	return {
		maxAttempts: 1,
		baseDelayMs: 100,
		maxDelayMs: 30_000,
		jitter: "equal",
		retryable: defaultRetryable,
		rng: Math.random,
		...overrides,
	}
}

function defaultRetryable(err: Error): boolean {
	// Retry transport-level 5xx; do not retry 4xx (caller bugs, diagnostic
	// responses, auth failures). Network-level failures also bubble here as
	// plain `Error`s — retry them by default.
	if (err instanceof BridgeTransportError) return err.status >= 500
	if (err.name === "AbortError") return false
	return true
}
