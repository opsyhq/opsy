# @opsy/provider

The generic provider contract that every Opsy provider package implements. Defines the `OpsyProvider` registry, `ProviderType` metadata, the `composeProvider` schema-driven composer, the `TypeExtension` shape, and a small `stateToImportId` helper.

This package is pure types and helpers. It depends on `@opsy/bridge-client` only because the composer takes a `BridgeClient`, reads provider summaries and selected schemas through the bridge schema cache, and wires bridge calls through the provider-level dispatch surface. It has no other runtime dependencies.

For the full design rationale, read [docs/provider-interface.md](../../docs/provider-interface.md) — that doc is the source of truth.

## Mental model

A provider is a **lazy, schema-driven registry** of type metadata. The composer reads the provider manifest summary at `init()` time, resolves individual Terraform types on demand, and fetches only selected schemas when a caller asks for them. Most TF types need zero hand-written code: bridge-backed Plan/Apply/Read/Import/ReadData operations flow through the provider-level `dispatch` method, with default identity metadata unless an extension overrides it.

```
OpsyProvider                               ← thin lazy registry
  name: "aws"
  init(version)                             ← fetches manifest summary
  searchTypes({ q, kind, limit, offset })   ← bridge manifest/index search
  getType(type) → Promise<ProviderType | undefined>
  getSchema(type, kind?)                    ← selected schema fetch
  dispatch(op, ctx)                         ← Plan / Apply / Read / Import / ReadData
```

The provider has **no** per-resource method surface. `apply`, `plan`, `read`, `importResource`, and `readDataSource` are represented as provider operations and routed through `dispatch(op, ctx)`.

### ProviderType capabilities

`ProviderType` carries metadata only: the Terraform type name, identity definition, optional schemas, and booleans for whether the type is a managed resource, a data source, or both. Hybrid TF types automatically get both capability booleans after the bridge resolves that selected type.

### No typed clients on the public surface

The public surface is **clients-generic-free**. There is no `OpsyProvider<Clients>`, no typed clients bag exposed anywhere on the orchestrator path. Each provider package handles credential → cloud SDK client construction internally and threads it into its extensions via a provider-owned `runtime` bag passed to `composeProvider({ runtime })`. The orchestrator only ever passes the `Integration` row through method calls.

```typescript
// ProviderOperationContext is the public context — no clients field
export interface ProviderOperationContext {
  integration: Integration
  signal?: AbortSignal
}
```

Provider operations receive a `ProviderOperationContext` carrying the `Integration` and optional abort signal. Provider-owned runtime helpers stay behind `composeProvider({ runtime })` instead of appearing on the orchestrator path.

## What it exports

```typescript
import {
  // OpsyProvider + ProviderType metadata
  type OpsyProvider,
  type ProviderType,
  type IdentityDef,

  // Operation request/result types
  type State,
  type ProviderOp,
  type ProviderResult,

  // Local Integration shape
  type Integration,

  // Composer
  composeProvider,
  type ComposeOptions,

  // Extension shapes
  type TypeExtension,

  // Identity helper
  stateToImportId,
} from "@opsy/provider"
```

The earlier `tfResource` / `tfData` / `tfBoth` / `tfResourceIdentity` factories are gone from the public surface. The composer is the only consumer of those internal builders now.

## composeProvider

`composeProvider` is the only entry point for building an `OpsyProvider`. It takes a bridge client, the TF provider source string, a `runtime` bag, a `providerConfigFor` function that shapes an `Integration` into the underlying TF provider's config blob, an identity registry, and a sparse map of per-type extensions. It returns an `OpsyProvider` with async `getType(type)` and `searchTypes(...)` lookups, plus an async `init(version)` that reads the provider summary.

```typescript
import { composeProvider } from "@opsy/provider"
import myIdentities from "./myprovider-identities.json" with { type: "json" }
import { extensions } from "./extensions"

export function createMyProvider(opts: { bridge: BridgeClient }): OpsyProvider {
  const runtime = createMyRuntime()
  return composeProvider<MyRuntime>({
    name: "myprovider",
    bridge: opts.bridge,
    tfSource: "myorg/myprovider",
    runtime,
    providerConfigFor: runtime.providerConfigFor,
    identities: myIdentities,
    extensions,
  })
}

// Caller side
const provider = createMyProvider({ bridge })
await provider.init("1.2.3")           // fetches the manifest summary
const widget = await provider.getType("myprovider_widget")
await provider.dispatch({ kind: "Read", type: widget!.type, state }, { integration })
```

### Lifecycle

1. **Construct.** `composeProvider({...})` does no I/O.
2. **Init.** `await provider.init(version)` calls `bridge.getSummary({ provider_source, provider_version })`. The bridge ensures the schema cache exists via the short-lived extractor, then returns manifest counts without returning all provider schemas.
3. **Serve.** `provider.getType(type)` resolves one type through `bridge.resolveType(...)`, builds one entry, and caches it. `provider.searchTypes(...)` delegates ranking and bounds to the bridge manifest index. `provider.getSchema(...)` fetches one selected schema at a time.

The lazy-construction tradeoff: init is O(1) plus the summary round-trip instead of O(types). The cost is paid per cold selected-type lookup; warm calls are pure map reads.

### Extension shape

A `TypeExtension` is sparse — every field is optional. The composer fills sensible defaults for whatever you don't provide.

```typescript
export interface TypeExtension<TState = Record<string, unknown>, Runtime = unknown> {
  identity?: IdentityDef
  inputSchema?: ZodSchema
  stateSchema?: ZodSchema
}
```

Identity precedence: `extension.identity` > JSON registry entry > default `{ kind: "passthrough", format: "{id}", fields: ["id"] }`.

## stateToImportId

A pure helper that derives the canonical provider import ID from state by interpolating field paths into a format string.

```typescript
import { stateToImportId } from "@opsy/provider"

stateToImportId(
  { kind: "passthrough", format: "{id}", fields: ["id"] },
  { id: "i-abc123" },
) // → "i-abc123"

stateToImportId(
  { kind: "composite", format: "{cluster}/{name}", fields: ["cluster", "name"] },
  { cluster: "prod", name: "api" },
) // → "prod/api"

// Dotted paths and array indices are supported
stateToImportId(
  { kind: "composite", format: "{metadata.0.namespace}/{metadata.0.name}", fields: [...] },
  { metadata: [{ namespace: "prod", name: "api-abc" }] },
) // → "prod/api-abc"
```

## Identities

The composer's `identities` field expects a `Record<string, IdentityDef>` — one entry per TF type the provider declares. Provider packages typically import this from a JSON file the state-type generator manages (see below). Defaults to `{ kind: "passthrough", format: "{id}", fields: ["id"] }` for any type not in the registry, and per-type extensions can override the registry value via their `identity` field.

## Project structure

```
packages/provider/
  src/
    index.ts                # public exports
    integration.ts          # local Integration shape
    types.ts                # OpsyProvider, ProviderType, IdentityDef, State
    ops.ts                  # ProviderOp and operation payload shapes
    result.ts               # ProviderResult and effect shapes
    identity.ts             # stateToImportId() — pure helper
    extensions.ts           # TypeExtension and factory shapes
    compose.ts              # composeProvider — schema-driven composer (THE entry point)
    tf-backed.ts            # INTERNAL — generic CRUD method builders used by compose.ts
  scripts/
    gen-state-types.ts      # state-type generator (manual `bun run`)
  test/
    identity.test.ts        # unit tests for stateToImportId
    compose.test.ts         # composer tests against a fake BridgeClient
    gen-state-types.test.ts # generator tests against canned schema fixtures
    fixtures/schemas/       # canned codegen snapshot fixtures
```

## State-type generator

`packages/provider/scripts/gen-state-types.ts` is a manual codegen tool, isolated from runtime request paths. Live codegen mode enumerates through bounded bridge search pages and fetches selected schemas one at a time; `--schema-file` accepts a legacy full-schema snapshot fixture for offline tests and reviews. It emits two outputs:

1. One TypeScript file per TF type under `--out/state-types/` with `<Type>ResourceState`, `<Type>Inputs`, `<Type>DataState`, and `<Type>Selector` interfaces (whichever pair applies). Hybrid types get all four.
2. A single identities JSON file at `--identities` with one entry per TF type. **The generator merges with the existing file on regen**: hand-extracted overrides (entries whose format isn't `{id}`) are preserved, types removed from the schema are dropped, new types are added with the default passthrough. This makes bumping the TF provider version a one-command operation.

Invocation is manual — the generated files are committed and pinned to one TF provider version per release.

```bash
bun run --filter @opsy/provider gen:state-types -- \
  --source hashicorp/null \
  --version 3.2.3 \
  --out ./generated/null \
  --identities ./generated/null-identities.json
```

## Runtime Model

The API composes providers dynamically from the allowed Terraform provider
catalog. This package only owns the generic bridge-backed contract and schema
helpers; provider-specific create forms and onboarding metadata live in the app
catalog.

## Type checking

```bash
cd packages/provider
bun run typecheck
```

## Testing

```bash
cd packages/provider
bun test
```

The test suite is offline — no network, no real bridge. `compose.test.ts` exercises the composer against a fake `BridgeClient` that records calls and returns canned responses; `gen-state-types.test.ts` exercises the generator against canned schema fixtures.

## Dependencies

| Dependency | Purpose |
|---|---|
| `@opsy/bridge-client` | The composer takes a `BridgeClient` and calls summary/search/resolve/selected-schema endpoints |
| `zod` (peer) | `TypeExtension.inputSchema` and `TypeExtension.stateSchema` are `ZodSchema`. Provider packages bring their own zod version |
| `@types/bun` (dev) | Bun runtime types for tests |
