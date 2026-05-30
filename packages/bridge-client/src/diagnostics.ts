import type { Diagnostic } from "./types"

// Nitro builds the API into separate bundles (main + workflow steps) and
// re-imports `@opsy/bridge-client` into each, so the class identity differs
// across realms. Use a brand + Symbol.hasInstance so `instanceof` survives
// the boundary.
const BRIDGE_DIAGNOSTIC_ERROR_BRAND = Symbol.for("opsy.BridgeDiagnosticError")

export class BridgeDiagnosticError extends Error {
	readonly [BRIDGE_DIAGNOSTIC_ERROR_BRAND] = true
	readonly diagnostics: Diagnostic[]
	readonly errors: Diagnostic[]
	readonly warnings: Diagnostic[]

	constructor(diagnostics: Diagnostic[]) {
		const errors = diagnostics.filter((d) => d.severity === "error")
		const summary =
			errors.map((d) => d.summary).join("; ") ||
			"bridge returned error diagnostics"
		super(summary)
		this.name = "BridgeDiagnosticError"
		this.diagnostics = diagnostics
		this.errors = errors
		this.warnings = diagnostics.filter((d) => d.severity === "warning")
	}

	static [Symbol.hasInstance](value: unknown): boolean {
		return (
			typeof value === "object" &&
			value !== null &&
			(value as { [BRIDGE_DIAGNOSTIC_ERROR_BRAND]?: unknown })[
				BRIDGE_DIAGNOSTIC_ERROR_BRAND
			] === true
		)
	}
}

export function throwIfErrors(diagnostics: Diagnostic[] | undefined): void {
	if (!diagnostics?.length) return
	if (diagnostics.some((d) => d.severity === "error")) {
		throw new BridgeDiagnosticError(diagnostics)
	}
	// warnings pass through silently — callers can read response.diagnostics if needed
}
