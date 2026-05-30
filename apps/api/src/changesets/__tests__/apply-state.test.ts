import { describe, expect, test } from "bun:test"
import { hasCurrentSuccess } from "../changesets"

// Resumable-retry skip rule: an item is "already applied" only when it has a
// succeeded operation that ran against its *current* content. Editing an item
// bumps updatedAt; validation bookkeeping deliberately does NOT (see
// validate()), so this stays an honest "last edited" signal.

const t = (ms: number) => new Date(1_700_000_000_000 + ms)

describe("hasCurrentSuccess", () => {
	test("no operations → not applied (runs)", () => {
		expect(hasCurrentSuccess(t(0), [])).toBe(false)
	})

	test("succeeded operation after the last edit → applied (skipped)", () => {
		expect(
			hasCurrentSuccess(t(10), [{ status: "succeeded", createdAt: t(20) }]),
		).toBe(true)
	})

	test("succeeded at the exact edit instant → applied", () => {
		expect(
			hasCurrentSuccess(t(10), [{ status: "succeeded", createdAt: t(10) }]),
		).toBe(true)
	})

	test("edited after it succeeded → stale success, re-runs", () => {
		// Item succeeded at t20, then the user edited it (updatedAt bumped to
		// t30). The old success no longer reflects the item, so it must run.
		expect(
			hasCurrentSuccess(t(30), [{ status: "succeeded", createdAt: t(20) }]),
		).toBe(false)
	})

	test("only a failed operation → not applied (re-runs)", () => {
		expect(
			hasCurrentSuccess(t(10), [{ status: "failed", createdAt: t(20) }]),
		).toBe(false)
	})

	test("failed then succeeded for current content → applied", () => {
		expect(
			hasCurrentSuccess(t(10), [
				{ status: "failed", createdAt: t(20) },
				{ status: "succeeded", createdAt: t(30) },
			]),
		).toBe(true)
	})
})
