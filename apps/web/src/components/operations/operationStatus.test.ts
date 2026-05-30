import { describe, expect, it } from "vitest"
import { isOpen, OPEN_OPERATION_STATUSES } from "./operationStatus"

describe("isOpen", () => {
	it("matches every status in OPEN_OPERATION_STATUSES", () => {
		for (const status of OPEN_OPERATION_STATUSES) {
			expect(isOpen(status)).toBe(true)
		}
	})

	it("rejects terminal statuses", () => {
		for (const status of ["succeeded", "failed", "canceled"] as const) {
			expect(isOpen(status)).toBe(false)
		}
	})
})
