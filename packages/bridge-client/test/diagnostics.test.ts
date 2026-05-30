import { expect, test } from "bun:test"
import { BridgeDiagnosticError, throwIfErrors } from "../src/diagnostics"

test("throwIfErrors no-ops on undefined", () => {
	expect(() => throwIfErrors(undefined)).not.toThrow()
})

test("throwIfErrors no-ops on empty array", () => {
	expect(() => throwIfErrors([])).not.toThrow()
})

test("throwIfErrors no-ops on warnings only", () => {
	expect(() =>
		throwIfErrors([{ severity: "warning", summary: "heads up" }]),
	).not.toThrow()
})

test("throwIfErrors throws on any error", () => {
	expect(() =>
		throwIfErrors([
			{ severity: "warning", summary: "heads up" },
			{ severity: "error", summary: "bad", detail: "very bad" },
		]),
	).toThrow(BridgeDiagnosticError)
})

test("instanceof BridgeDiagnosticError matches cross-realm instances by brand", () => {
	// Nitro bundles this package into both main and workflow-step outputs, so
	// a thrown instance from one realm reaches a catch in the other. Simulate
	// the foreign instance with a plain object that carries the shared brand.
	const brand = Symbol.for("opsy.BridgeDiagnosticError")
	const foreign = Object.assign(new Error("from another realm"), {
		[brand]: true,
	})
	expect(foreign instanceof BridgeDiagnosticError).toBe(true)
	expect(new Error("plain") instanceof BridgeDiagnosticError).toBe(false)
})

test("BridgeDiagnosticError exposes errors and warnings separately", () => {
	try {
		throwIfErrors([
			{ severity: "warning", summary: "w1" },
			{ severity: "error", summary: "e1" },
			{ severity: "error", summary: "e2" },
		])
	} catch (err) {
		if (!(err instanceof BridgeDiagnosticError)) throw err
		expect(err.errors).toHaveLength(2)
		expect(err.warnings).toHaveLength(1)
		expect(err.message).toContain("e1")
		expect(err.message).toContain("e2")
		return
	}
	throw new Error("expected throw")
})
