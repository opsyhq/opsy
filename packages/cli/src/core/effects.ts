// Effects-as-data surface for the CLI. The only genuinely non-deterministic
// side effect we treat as data is `process.exit` — it's how the CLI signals
// awaiting-approval (exit 2), not-found (exit 3), and generic error (exit 1).
// Centralizing it lets pure code (approval gate decisions, future status
// computations) return an Effect list which the shell dispatches via `commit`.
//
// Mirrors `apps/api/src/lib/effects.ts` in shape. Discriminated by `kind`.

export type Effect = { kind: "Exit"; code: number }

export const exitEffect = (code: number): Effect => ({ kind: "Exit", code })
