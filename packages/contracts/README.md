# @opsy/contracts

Shared runtime contracts for Opsy control-plane and worker-plane code.

## What this package contains

- Zod schemas and TypeScript types for core entities (`workspace`, `stack`, `stack_revision`, `env`, `run`, `approval`, `job`, snapshots, `stack_state`).
- Shared status enums and transition guards.
- Spec validation and canonical hashing helpers.
- Cross-stack and local output ref parsing (`extractRefsFromValue`, `extractLocalResourceDependencies`).
- MCP input/output schemas and REST payload schemas.
- Stable API error-code schema.
- Shared JSON primitive types (`JsonValue`, `JsonObject`, `JsonPrimitive`).

## Recent updates

- `WorkspaceSchema` now requires `ownerWorkosOrgId`.
- `WorkspaceStateBackend` removed — Pulumi state is now stored in Postgres via `stack_states` (see `@opsy/db`).
- `StackStateSchema` and `StackState` type added.
- `JsonObject` exported from `common.ts` as `Record<string, JsonValue>`.
- Error codes include `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_IMPLEMENTED`.

## Install and build

From repo root:

```bash
bun install
bun run --cwd packages/contracts typecheck
bun run --cwd packages/contracts build
```

## Import examples

```ts
import {
  WorkspaceSchema,
  ManageStackInputSchema,
  RequestApplyInputSchema,
  ErrorCodeEnum,
  StackStateSchema,
  type JsonObject,
  type JsonValue,
  extractRefsFromValue,
  extractLocalResourceDependencies,
} from "@opsy/contracts";
```

## Source layout

- `packages/contracts/src/common.ts` — `JsonValue`, `JsonObject`, `JsonPrimitive`, `SlugSchema`, canonical JSON helpers
- `packages/contracts/src/entities.ts` — entity schemas and types
- `packages/contracts/src/errors.ts` — `ErrorCodeEnum`
- `packages/contracts/src/mcp.ts` — MCP tool input/output schemas
- `packages/contracts/src/rest.ts` — REST payload schemas
- `packages/contracts/src/status.ts` — status enums and transition guards
- `packages/contracts/src/spec.ts` — `StackSpec`, `StackResourceDef`, spec validation
- `packages/contracts/src/refs.ts` — ref parsing, `extractRefsFromValue`, `extractLocalResourceDependencies`
