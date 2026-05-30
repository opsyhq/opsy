import type { ProviderOp, ProviderResultByKind } from "./ops"

// ─── Diagnostics ──────────────────────────────────────────────────────────
//
// Non-fatal provider messages. Warnings and info only — fatal errors still
// throw so the orchestrator maps them to execution `error` rows.

export interface Diagnostic {
	severity: "warning" | "info"
	summary: string
	detail?: string
	attributePath?: string[]
}

// ─── Envelope returned by dispatch ────────────────────────────────────────

export interface ProviderResult<
	K extends ProviderOp["kind"] = ProviderOp["kind"],
> {
	/** Discriminant for easy narrowing at call sites. */
	kind: K
	/** The per-op payload (typed by kind). */
	payload: ProviderResultByKind[K]
	/** Non-fatal provider-surfaced messages. */
	diagnostics: Diagnostic[]
}
