import { toAbortError } from "../errors"
import type { BridgeOp, BridgeRequest, BridgeResponse } from "../wire"
import { computeBackoff, type RetryPolicy } from "./retry"

export type RequestId = string

interface InflightEntry {
	id: RequestId
	op: BridgeOp
	req: BridgeRequest
	startedAt: number
	/** 1-indexed. `attempt = 3` means we've tried twice already, this is the third. */
	attempt: number
	/** Absolute time (ms) when the per-attempt timeout fires, or null. */
	deadlineAt: number | null
	/** Unary call vs. open AsyncIterable stream. Streams skip retry/timeout effects. */
	mode: "unary" | "stream"
}

export interface BridgeClientState {
	inflight: Map<RequestId, InflightEntry>
}

export function createBridgeClientState(): BridgeClientState {
	return { inflight: new Map() }
}

export type BridgeEvent =
	| {
			type: "Send"
			id: RequestId
			req: BridgeRequest
			now: number
			timeoutMs: number | null
	  }
	| { type: "Delivered"; id: RequestId; response: BridgeResponse }
	| {
			type: "Errored"
			id: RequestId
			error: Error
			now: number
	  }
	| { type: "TimedOut"; id: RequestId; now: number }
	| { type: "Canceled"; id: RequestId; reason?: Error }
	| { type: "RetryDue"; id: RequestId; now: number }
	| {
			type: "StreamStart"
			id: RequestId
			req: BridgeRequest
			now: number
	  }
	| { type: "StreamEnd"; id: RequestId }
	| { type: "StreamFailed"; id: RequestId; error: Error }

export type BridgeEffect =
	| {
			kind: "SendOnWire"
			id: RequestId
			req: BridgeRequest
			/** Per-attempt timeout in ms, or null for none. */
			timeoutMs: number | null
	  }
	| { kind: "ResolveCaller"; id: RequestId; response: BridgeResponse }
	| { kind: "RejectCaller"; id: RequestId; error: Error }
	| { kind: "ScheduleRetry"; id: RequestId; delayMs: number }
	| { kind: "ArmTimeout"; id: RequestId; delayMs: number }
	| { kind: "ClearTimer"; id: RequestId }

interface StepResult {
	next: BridgeClientState
	effects: BridgeEffect[]
}

/**
 * Pure reducer. Given current state + event + retry policy, returns the next
 * state and an effect list. The client runs effects against the transport
 * and timer system. Tests can drive this function directly — no I/O.
 */
export function step(
	state: BridgeClientState,
	event: BridgeEvent,
	policy: RetryPolicy,
): StepResult {
	switch (event.type) {
		case "Send": {
			if (state.inflight.has(event.id)) return { next: state, effects: [] }
			const entry: InflightEntry = {
				id: event.id,
				op: event.req.op,
				req: event.req,
				startedAt: event.now,
				attempt: 1,
				deadlineAt:
					event.timeoutMs !== null ? event.now + event.timeoutMs : null,
				mode: "unary",
			}
			const next: BridgeClientState = {
				inflight: new Map(state.inflight).set(event.id, entry),
			}
			const effects: BridgeEffect[] = [
				{
					kind: "SendOnWire",
					id: event.id,
					req: event.req,
					timeoutMs: event.timeoutMs,
				},
			]
			if (event.timeoutMs !== null)
				effects.push({
					kind: "ArmTimeout",
					id: event.id,
					delayMs: event.timeoutMs,
				})
			return { next, effects }
		}

		case "Delivered": {
			const entry = state.inflight.get(event.id)
			if (!entry) return { next: state, effects: [] }
			const nextMap = new Map(state.inflight)
			nextMap.delete(event.id)
			return {
				next: { inflight: nextMap },
				effects: [
					{ kind: "ClearTimer", id: event.id },
					{ kind: "ResolveCaller", id: event.id, response: event.response },
				],
			}
		}

		case "Errored":
		case "TimedOut": {
			const entry = state.inflight.get(event.id)
			if (!entry) return { next: state, effects: [] }
			const error =
				event.type === "TimedOut"
					? Object.assign(new Error(`bridge call timed out`), {
							name: "BridgeTimeoutError",
						})
					: event.error
			const shouldRetry =
				entry.attempt < policy.maxAttempts &&
				(event.type === "TimedOut" || policy.retryable(error))
			if (shouldRetry) {
				const delay = computeBackoff(policy, entry.attempt)
				const bumped: InflightEntry = {
					...entry,
					attempt: entry.attempt + 1,
					// deadline rearms when we retry — cleared here, rearmed on RetryDue.
					deadlineAt: null,
				}
				return {
					next: { inflight: new Map(state.inflight).set(event.id, bumped) },
					effects: [
						{ kind: "ClearTimer", id: event.id },
						{ kind: "ScheduleRetry", id: event.id, delayMs: delay },
					],
				}
			}
			const nextMap = new Map(state.inflight)
			nextMap.delete(event.id)
			return {
				next: { inflight: nextMap },
				effects: [
					{ kind: "ClearTimer", id: event.id },
					{ kind: "RejectCaller", id: event.id, error },
				],
			}
		}

		case "RetryDue": {
			const entry = state.inflight.get(event.id)
			if (!entry) return { next: state, effects: [] }
			// Original timeoutMs isn't tracked across retries; the runner re-arms
			// any per-attempt budget from its own policy.
			const bumped: InflightEntry = {
				...entry,
				startedAt: event.now,
				deadlineAt: null,
			}
			return {
				next: { inflight: new Map(state.inflight).set(event.id, bumped) },
				effects: [
					{ kind: "SendOnWire", id: event.id, req: entry.req, timeoutMs: null },
				],
			}
		}

		case "Canceled": {
			const entry = state.inflight.get(event.id)
			if (!entry) return { next: state, effects: [] }
			const err = toAbortError(event.reason ?? "canceled")
			const nextMap = new Map(state.inflight)
			nextMap.delete(event.id)
			if (entry.mode === "stream")
				return { next: { inflight: nextMap }, effects: [] }
			return {
				next: { inflight: nextMap },
				effects: [
					{ kind: "ClearTimer", id: event.id },
					{ kind: "RejectCaller", id: event.id, error: err },
				],
			}
		}

		case "StreamStart": {
			if (state.inflight.has(event.id)) return { next: state, effects: [] }
			const entry: InflightEntry = {
				id: event.id,
				op: event.req.op,
				req: event.req,
				startedAt: event.now,
				attempt: 1,
				deadlineAt: null,
				mode: "stream",
			}
			return {
				next: { inflight: new Map(state.inflight).set(event.id, entry) },
				effects: [],
			}
		}

		case "StreamEnd":
		case "StreamFailed": {
			if (!state.inflight.has(event.id)) return { next: state, effects: [] }
			const nextMap = new Map(state.inflight)
			nextMap.delete(event.id)
			return { next: { inflight: nextMap }, effects: [] }
		}
	}
}
