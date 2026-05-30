# @opsy/bridge-client

TypeScript client and subprocess lifecycle helper for the Go [Opsy Terraform Bridge](../../bridge/README.md). This is the only place in the TypeScript codebase that knows the bridge's HTTP wire format.

The bridge is a Go process that wraps Terraform providers over `tfprotov6` and exposes a small HTTP API for declarative CRUD. The API composes allowed Terraform providers through `@opsy/provider` and uses this package to spawn and talk to the bridge subprocess.

Zero opsy-monorepo runtime dependencies. Pure `node:child_process` + `node:readline` + global `fetch`.

## How it works

```
Orchestrator (apps/api)
  → spawnBridge({ binPath, providerDir })
    → spawn Go subprocess
    → read first stdout line → port number
    → return BridgeClient(`http://127.0.0.1:${port}`)

Dynamic provider runtime (@opsy/provider via tf-backed operations)
  → BridgeClient.readResource(req)  → POST /resources/read
  → BridgeClient.applyResource(req) → POST /resources/apply
  → ...
```

The spawn helper enforces a startup contract that mirrors `bridge/main.go`:

1. Bridge prints the port number to stdout as the **first line**
2. Subsequent stdout lines pipe to caller's logger (default: `process.stdout` with `bridge: ` prefix)
3. All stderr pipes to caller's logger (default: `process.stderr` with `bridge: ` prefix)
4. If the bridge exits before announcing a port, or doesn't announce within `startupTimeoutMs` (default 5s), `spawnBridge` throws `BridgeStartupError`
5. `shutdown()` sends `SIGTERM`, waits up to `shutdownGraceMs` (default 5s), then sends `SIGKILL`. Idempotent.
6. Best-effort: the bridge is killed if the parent process exits via `process.once('exit', ...)`, `'SIGINT'`, `'SIGTERM'`

## What it exports

```typescript
import {
  BridgeClient,
  BridgeTransportError,
  BridgeDiagnosticError,
  throwIfErrors,
  spawnBridge,
  BridgeStartupError,
  type SpawnBridgeOptions,
  type SpawnedBridge,
  type BridgeClientOptions,
  type BridgeCallEvent,
  type BridgeCallOptions,
  // wire-format types: ProviderRef, Diagnostic, ResourceReadRequest, etc.
} from "@opsy/bridge-client"
```

The wire-format types in `src/types.ts` mirror `bridge/types/request.go` and `bridge/types/response.go` exactly. Field names use `snake_case` to match the Go side — translation to camelCase happens in `@opsy/provider`'s `tf-backed.ts` helpers, not here.

## Diagnostics

The bridge returns Terraform provider diagnostics as part of its response body, not as HTTP errors. There are two failure modes:

| Error class | When it's thrown | What it carries |
|---|---|---|
| `BridgeTransportError` | HTTP status ≥ 400 (binary not found, gRPC failure, encoding error) | `status`, `body` |
| `BridgeDiagnosticError` | Response body contains a diagnostic with `severity: "error"` | `diagnostics`, `errors`, `warnings` |

Hybrid policy: **`validate*` methods do not throw on diagnostics** — diagnostics ARE the payload. Everything else throws automatically. Warnings always pass through silently in the response — callers that care can read `response.diagnostics`.

```typescript
const client = BridgeClient.fromUrl("http://127.0.0.1:54321")

// Throws BridgeDiagnosticError if any diagnostic has severity: "error"
const result = await client.applyResource({ ... })

// Returns diagnostics as the payload, never throws on them
const validation = await client.validateResource({ ... })
if (validation.diagnostics?.some(d => d.severity === "error")) { ... }
```

Use `throwIfErrors(diagnostics)` for the rare case where you want the auto-throw behavior on a custom code path.

## Project structure

```
packages/bridge-client/
  src/
    index.ts         # public exports
    client.ts        # BridgeClient class — fetch wrappers, one method per route
    diagnostics.ts   # BridgeDiagnosticError + throwIfErrors helper
    subprocess.ts    # spawnBridge() — child_process lifecycle
    types.ts         # wire-format types (mirrors bridge/types/*.go)
  test/
    diagnostics.test.ts  # unit tests for diagnostics handling
    smoke.ts             # standalone sanity script (see Smoke test below)
```

### BridgeClient methods

One method per bridge HTTP route. All methods return `Promise<TResponse>` and throw on transport errors. Non-`validate*` methods additionally throw `BridgeDiagnosticError` on diagnostic-error responses.

| Method | Bridge route | Notes |
|---|---|---|
| `getMetadata(req)` | `POST /providers/metadata` | Provider capabilities |
| `getSummary(req)` | `POST /providers/summary` | Counts and provider-level capabilities from the schema manifest. |
| `searchTypes(req)` | `POST /providers/types/search` | Manifest/index-only bounded type search. |
| `resolveType(req)` | `POST /providers/types/resolve` | Resolves one Terraform type to resource/data availability. |
| `getTypeSchema(req)` | `POST /providers/types/schema` | Loads and projects one selected resource or data-source schema. |
| `getProviderConfigSchema(req)` | `POST /providers/config-schema` | Loads and projects only the provider configuration schema. |
| `validateProvider(req)` | `POST /providers/validate-config` | Diagnostics as payload |
| `validateResource(req)` | `POST /resources/validate-config` | Diagnostics as payload |
| `readResource(req)` | `POST /resources/read` | One resource live state |
| `planResource(req)` | `POST /resources/plan` | Returns planned state + opaque plan blob |
| `applyResource(req)` | `POST /resources/apply` | Bridge re-plans + stale-checks internally |
| `importResource(req)` | `POST /resources/import` | `ImportResourceState` + `ReadResource` |
| `readDataSource(req)` | `POST /data-sources/read` | For `data` nodes |

Note: `applyResource` does not require the caller to re-plan. The bridge handles stale detection (re-plan + divergence check) inside `bridge/handler/resource_apply.go`. If the stored plan is stale, the bridge returns a stale diagnostic and the apply does not run.

### `spawnBridge(opts)`

```typescript
const bridge = await spawnBridge({
  binPath: process.env.OPSY_BRIDGE_BIN!,
  providerDir: process.env.OPSY_PROVIDER_DIR!,
  // optional:
  poolSize: 20,           // bridge --pool-size flag
  startupTimeoutMs: 5000, // wait this long for the port line
  shutdownGraceMs: 5000,  // wait this long for SIGTERM before SIGKILL
  onStderr: (line) => log.info({ bridge: true }, line),
  onStdout: (line) => log.info({ bridge: true }, line),
  bridgeClientOptions: {
    // Per-RPC observability hook. Fires once per call (success, transport
    // error, or diagnostic error). The orchestrator wires this up to a pino
    // logger in PR 4.
    onCall: (event) => log.debug(event, "bridge call"),
  },
})

const provider = createAwsProvider({ bridge: bridge.client })

// ...later
await bridge.shutdown()
```

`SpawnedBridge.exited` is a promise that resolves with `{ code, signal }` when the bridge process exits — useful for tests and lifecycle assertions.

### Cancellation

Every `BridgeClient` method accepts an optional `{ signal: AbortSignal }` second argument. Aborting the signal closes the underlying `fetch` connection, the bridge handler's `r.Context()` cancels, the gRPC call propagates the cancel down to the TF provider, and the provider unwinds. The orchestrator builds a per-execution `AbortController` so a future cancel endpoint (or CLI Ctrl+C) can stop a hung apply without killing the api process.

Note: when cancellation triggers mid-apply, the TS side sees a `BridgeDiagnosticError` (or transport error) and the response's `new_state` is discarded. Persisting partial state on cancel is its own follow-up; it must land before the user-facing cancel surface ships.

### Observability (`onCall`)

`BridgeClientOptions.onCall` is opt-in and takes a `BridgeCallEvent`:

```typescript
interface BridgeCallEvent {
  method: "POST"
  path: string                  // e.g. "/resources/apply"
  status: number | "error"      // HTTP status, or "error" if fetch threw
  durationMs: number            // monotonic, start to finally
  error?: { name: string; message: string }
}
```

The hook fires in a `finally` block so it always runs — success, transport error, or diagnostic error. Distinguish error classes via `event.error?.name` (`BridgeTransportError` vs `BridgeDiagnosticError` vs `AbortError` vs other). Callback exceptions are caught and logged to stderr; they cannot break the bridge call.

## Running

This package has no runnable entry point — it's a library. Other packages import it.

```bash
cd packages/bridge-client
bun run typecheck
bun test
```

### Smoke test

`test/smoke.ts` is a standalone script (not part of the test suite) that spawns a real bridge, calls `getSchema` against `terraform-provider-null`, and prints the resource type list. Use it to verify end-to-end wiring after building the bridge binary.

```bash
cd <repo-root>

# 1. Build the bridge binary
cd bridge && go build -o ../bin/opsy-bridge .

# 2. Download terraform-provider-null v3.2.3 to a provider directory
#    See bridge/README.md for the expected directory layout

# 3. Run the smoke script
OPSY_BRIDGE_BIN=$(pwd)/bin/opsy-bridge \
OPSY_PROVIDER_DIR=$(pwd)/providers \
bun run packages/bridge-client/test/smoke.ts
# expected: resource types: [ "null_resource" ]
```

Common failure modes:
- Bridge binary missing or wrong path → check `bin/opsy-bridge` exists and is executable
- Provider directory layout wrong → must be `<dir>/hashicorp/null/3.2.3/terraform-provider-null_v3.2.3...` (see `bridge/README.md`)
- Port not announced within 5s → bridge crashed; check stderr (`bridge: ` prefixed lines)

## Type checking

```bash
cd packages/bridge-client
bun run typecheck
```

No `DATABASE_URL` or other environment vars needed — pure types and HTTP.

## Dependencies

| Dependency | Purpose |
|---|---|
| `@types/bun` (dev) | Bun runtime types for `node:child_process` and `node:readline` |

No runtime dependencies. The package uses `node:child_process`, `node:readline`, and global `fetch` directly.
