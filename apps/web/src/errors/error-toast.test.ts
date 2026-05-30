import {
	OperationLockAlreadyInflight,
	ResourceNotFound,
} from "@opsy/contracts/errors"
import { describe, expect, it, vi } from "vitest"
import { renderTaggedError, type Toast } from "./error-toast"

function fakeToast(): Toast & {
	calls: Array<{ message: string; opts?: { description?: string } }>
} {
	const calls: Array<{ message: string; opts?: { description?: string } }> = []
	const error = vi.fn((message: string, opts?: { description?: string }) => {
		calls.push({ message, opts })
	})
	return {
		success: vi.fn(),
		error,
		info: vi.fn(),
		calls,
	}
}

describe("renderTaggedError", () => {
	it("emits the tag-specific description for known tags", () => {
		const t = fakeToast()
		renderTaggedError(
			t,
			new OperationLockAlreadyInflight({ lockKey: "resource:1" }),
		)
		expect(t.calls).toHaveLength(1)
		expect(t.calls[0]!.opts?.description).toMatch(/already running/i)
	})

	it("falls back to bare message for unknown / non-tagged errors", () => {
		const t = fakeToast()
		renderTaggedError(t, new Error("plain failure"))
		expect(t.calls[0]!.message).toBe("plain failure")
		expect(t.calls[0]!.opts).toBeUndefined()
	})

	it("uses the tagged error's own message as the toast title", () => {
		const t = fakeToast()
		const err = new ResourceNotFound({ slug: "web", projectSlug: "demo" })
		renderTaggedError(t, err)
		expect(t.calls[0]!.message).toBe(err.message)
	})
})
