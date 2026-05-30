# Opsy CLI — internal architecture

> Contributor doc. **Not published to npm** — `package.json#files` is
> `["dist", "README.md"]`, so this file ships with the repo only. Keep
> implementation detail, stack choices, and design rationale here, not in
> `README.md` (which is the public npm page).

The CLI authenticates via Better Auth's RFC 8628 device authorization flow and
communicates with the control plane API via Hono's typed client
(`hc<AppType>()`) for end-to-end type inference.

## How it works

```
Terminal
  -> opsy auth login -> Better Auth device flow -> browser approval -> session token stored
  -> opsy <command>  -> hc<AppType>() -> Bearer token -> Control Plane API
```

Credentials are stored as plain JSON at `~/.opsy/.credentials.json` (mode
0600), the same convention as `aws`, `gcloud`, `stripe`, `vercel`, and `gh`
(default). macOS Keychain integration is intentionally not used: it doesn't
meaningfully improve the security model for a tool you invoke as your own user,
and the shell-quoting / native-binding overhead is real.

## Auth flow

1. User runs `opsy auth login`
2. CLI requests a device code from Better Auth (`POST /api/auth/device/code`)
   via `authClient.device.code({ client_id })`
3. Browser opens to the verification URL with a pre-filled user code
4. User authenticates in the browser (email+password, magic link, or Google)
   and approves the device
5. CLI polls `POST /api/auth/device/token` until it gets `{ access_token }` (or
   one of the standard `authorization_pending`, `slow_down`, `expired_token`,
   `access_denied` errors)
6. The session token is stored in `~/.opsy/.credentials.json`
7. Subsequent commands inject `Authorization: Bearer <token>` automatically —
   Better Auth's `bearer()` plugin resolves it as a session

Better Auth sessions are opaque (not JWTs) and auto-refresh on use via
`session.updateAge`. There's no client-side refresh logic: when a session
finally expires, the next call returns 401 and the CLI tells the user to re-run
`opsy auth login`. This matches `gh`, `stripe`, and `vercel`.

### CI / headless environments

Set `OPSY_API_KEY` to skip the device flow entirely. The CLI uses it as-is for
Bearer auth.

## Functional core / imperative shell

The CLI is split into a pure core and a side-effecting shell, wired together by
explicit dependency injection. tsconfig path aliases enforce the direction:
`@core/*` → `src/core/*`, `@shell/*` → `src/shell/*`. Core may not import shell
except as a type-only reference.

```
packages/cli/src/
  bin.ts                  # Entry point: Commander program; preAction hook builds realDeps() once
  client.ts               # hc<AppType> singleton + opsyFetch (token-injecting fetch)
  index.ts                # `export {}` — the CLI has no public API surface

  core/                   # Pure logic — no fs, no network, no process, no clock
    errors.ts             # CliError + apiError/networkError constructors with actionable hints
    constants.ts          # OPSY_CLI_CLIENT_ID, default API URL
    effects.ts            # Effect descriptors handlers return for the shell to run
    approval.ts           # Approval-policy decision logic (pure)
    link.ts               # parseLinkFile() — .opsy/project.json shape + safe parse (never throws)
    types/
      deps.ts             # HandlerDeps interface (the DI contract)
      operation-settlement.ts
    inputs/               # dot-path / set-path / --set + --set-ref resolution
    render/               # operation / ops / resource view-model builders (pure)
    output/
      table.ts            # formatTable(rows, cols) pure function
      key-value.ts        # formatKeyValue(rows) pure function
      output-format.ts    # parseOutputFormat / isJsonOutput (adapted from vercel/vercel)
    sse/parser.ts         # SSE frame parser (pure)

  shell/                  # Side effects — adapters the core is given, never imports
    deps.real.ts          # realDeps(): assembles the live HandlerDeps
    deps.fake.ts          # fake HandlerDeps for tests
    run-action.ts         # runAction(): pulls _deps off the program, injects as arg 0
    commander-opts.ts     # withProject / withFormat shared option fragments
    output.ts             # Output class — writes to a stream (log/success/warn/error/note/table/...)
    credentials.ts        # Plain-file credential storage (~/.opsy/.credentials.json)
    config.ts             # ~/.opsy/ config dir + module-level constants (CONFIG_DIR, API_URL, PROJECT)
    auth-client.ts        # Lazily-built Better Auth client (deviceAuthorizationClient plugin)
    project.ts            # resolveProject(opt, deps): 4-level precedence (see below)
    link.ts               # findLinkFile/writeLinkFile/removeLinkFile — .opsy/ I/O + upward walk
    operation-stream.ts   # Streams an operation to terminal status
    sse/                  # fetch-sse + api-stream (network SSE)
    render.ts             # renders core view-models via Output
    policy.ts approval.ts changeset.ts commit.ts debug.ts exit.ts

  domains/<noun>/
    index.ts              # Noun command tree: wires Commander subcommands to handlers
  domains/deploy.ts       # deployCommand() + hidden applyCommand() → changesetApply
  domains/plan.ts         # planCommand() → changesetValidate

  verbs/<verb>/
    handlers.ts           # Verb logic: (deps: HandlerDeps, ...args, opts) => Promise<void>
  verbs/{auth,config,changeset,link}/
    index.ts              # These keep their own command factory (not noun-shaped)
```

The grammar is **noun-centric**: `src/domains/<noun>/index.ts` builds the
`opsy <noun> <action>` tree (`project · integration · resource · operation ·
provider`), each subcommand calling a handler from `src/verbs/<verb>/handlers.ts`
verbatim — the domain trees are a rewire, the verb *handlers* are unchanged. The
restructured verbs (`get describe create update delete import read retry cancel
explain query scan`) no longer have an `index.ts`; only their `handlers.ts`
survives. `get [--detail]` is collapsed: each noun's `get` subcommand calls the
summary handler, or the `describe*` handler when `--detail`; a hidden `describe`
subcommand forces detail. `deploy`/`plan` are promoted top-level verbs. `auth`,
`config`, `changeset` (reduced — `apply`/`validate` promoted out), and the
`link`/`unlink`/`status` group keep their own non-noun factories. Everything is
registered in `bin.ts` via `program.addCommand()`.

### Dependency injection

`bin.ts` registers a Commander `preAction` hook that builds `realDeps({ debug,
quiet })` **once** and stores it on the program via `setOptionValue("_deps",
…)`. `runAction` (in `shell/run-action.ts`) reads `_deps` back off the program
and invokes the handler with `deps` as its first argument:

```typescript
return cmd.action(
  runAction(async (d, name: string, opts: GetOpts) => getResource(d, name, opts)),
)
```

`HandlerDeps` (`core/types/deps.ts`) is the contract: `{ client, output, fs,
clock, signals, sleep, cwd, randomUUID }`. `fs` carries a write surface
(`existsSync`/`mkdirSync`/`writeFileSync`/`unlinkSync` alongside `readFileSync`)
so `opsy link`/`unlink` stay testable; `cwd` drives the `.opsy/` upward walk and
`randomUUID` is the DI'd id source for `registry connect` (deterministic in
tests). Handlers never touch `process`, `fs`, the network, or wall-clock time
directly — everything flows through `deps`, so `deps.fake.ts` makes the entire
handler layer unit-testable without a server, filesystem, or real clock (the new
methods default to throwing "no stub" until a test injects one).

## API client

The CLI uses Hono's typed client (`hc<AppType>()`) for end-to-end type safety
with no codegen. `client.ts` constructs a single module-level instance with a
custom `opsyFetch` that injects `Authorization: Bearer <token>` from
`getAccessToken()` before every request and emits HTTP debug. It is **not** a
public export (`index.ts` is `export {}`); handlers receive it as `deps.client`.

Inside handlers, the canonical pattern is the vanilla Hono RPC pattern —
`if (!res.ok) throw; await res.json()`, no custom unwrap helper:

```typescript
export async function getProject(deps: HandlerDeps, slug: string, opts: GetOpts) {
  const res = await deps.client.projects[":project"].$get({ param: { project: slug } });
  if (!res.ok) throw apiError(res.status, await res.text());
  const { project } = await res.json();           // narrowed to success type
  if (isJsonOutput(opts)) { deps.output.printJson({ project }); return; }
  deps.output.keyValue([["id", project.id], ["slug", project.slug]]);
}
```

`runAction` owns the surrounding try/catch and exit-code mapping, so handlers
just throw `CliError` / `apiError` and stay linear.

## Output module

Output is split across the core/shell line. `core/output/` holds the pure
formatters (`table.ts`, `key-value.ts`, `output-format.ts`); `shell/output.ts`
is the `Output` class that actually writes to a stream, composed from those
primitives and named by intent (`success`, `warn`, `error`, `note`) with
structured printers (`table`, `keyValue`, `printJson`) on top.

JSON dispatch is **per-command**, not in the `Output` class. Each handler
checks `isJsonOutput(opts)` near the top and early-returns after
`deps.output.printJson(data)`. This matches Vercel's pattern and keeps the JSON
shape and the human shape independent — they're often different.

## Integrations — provider resolution

Integrations are **project-scoped** and unique on `(project, provider, slug)`,
with `slug` defaulting to `"default"`. There is no separate bind/unbind step
and no provider-`alias` concept — a project owns its integrations directly.

1. At `opsy resource create --type aws_s3_bucket …` (or update/delete), the
   provider is inferred from the type prefix (`aws_s3_bucket` → `aws`); an
   unknown type is rejected with a hint to run `opsy registry types <provider>`.
2. The request carries `integrationSlug` only when `--integration <slug>` is
   passed; otherwise the API resolves the project's default integration for
   the inferred provider. `--integration` lives on `resource create`,
   `resource import`, and `resource query`.
3. A second integration for the same provider needs a distinct slug at
   `opsy integration create` time; the `(project, provider, slug)` uniqueness is
   enforced at the database level, so a duplicate fails immediately.

### Discovery surface: registry vs. integration

Discovery is **registry-level** — provider definitions don't change because you
have an integration. Mirrors `kubectl api-resources` / `terraform providers
schema`: discovery sits next to the catalog, not next to bound credentials.

- `opsy registry list` — providers known to the server.
- `opsy registry types <provider>` — resource and data-source type catalog.
- `opsy registry schema <provider> <type>` — one type's schema, delegating to
  `explainTarget` (`verbs/explain/handlers.ts`) which already renders
  REQUIRED/OPTIONAL/COMPUTED sections plus the import identity hint
  (`→ opsy resource import …`).
- `opsy registry connect <provider>` (handler `registryConnect` in
  `verbs/get/handlers.ts`) — the one-shot connect command. Proxies the provider
  integration-schema endpoint the web form reads, ships the credential/config
  JSON Schemas + credential modes + onboarding metadata verbatim, mints helpers
  (`createGeneratedFieldsByMode[mode]` — the `{kind:"uuid"}` →
  `deps.randomUUID()` switch is mirrored from
  `apps/web/src/components/IntegrationForm.tsx`), and when the mode matches the
  provider's onboarding mode calls the onboarding endpoint with the generated
  external id to emit the trust artifacts.

The endpoint owns provider/version validation (`requireSchemaProvider`), so the
CLI re-implements no allow-list pre-check (CLAUDE.md "validate once at the
owning boundary"). The provider definition
(`packages/provider/src/integrations/<p>.ts`) stays the single declaration
site — nothing about `aws`/`external_id` is hardcoded in the CLI.

`opsy integration` is **pure CRUD** on the project's bound credentials
(`list/get/create/update/delete`). No discovery verbs hang off it — those live
on `registry`.

## Project context

`resolveProject(opt, deps)` (`shell/project.ts`) resolves the active project
once, lazily, at call time, with 4-level precedence:

1. `--project <slug>` flag (`opt`)
2. `OPSY_PROJECT` env, when non-empty
3. `.opsy/project.json` link file — `findLinkFile` walks `deps.cwd()` upward to
   the filesystem root, stopping at the first `.opsy/project.json` (monorepo
   subdir ergonomics, the `git` convention)
4. profile `project` in `~/.opsy/config.json` (back-compat)

…else `CliError NO_PROJECT`. `opsy link [slug]` (`verbs/link/`) writes
`.opsy/project.json` and a self-executing `.opsy/.gitignore` (`*`) so the link
never enters version control (Vercel's `.vercel/` prior art); `opsy status`
reports each of project/apiUrl/orgId with its resolved source and warns when a
link shadows the profile project. `findLinkFile` returns the path even when the
link JSON is malformed (so `unlink` can still remove it) while resolution treats
a malformed link as absent. The pure shape/parse lives in `core/link.ts`; all
I/O (and the upward walk) is in `shell/link.ts`.

### Validation

Credentials and config are **provider-validated, not api-validated**. The api
stores both fields verbatim; the provider package (and ultimately the bridge /
TF provider plugin) rejects invalid keys at plan time. Trade-off: invalid
config surfaces on the first `plan` execution rather than at
`create integration` — but the error message comes from the provider's actual
validator, not a stale api-side schema that drifts from the provider.

## Running

```bash
# Development — runs straight from TS source via bun
cd packages/cli
bun run dev auth login
bun run dev project list

# Or run directly from anywhere in the monorepo
bun run packages/cli/src/bin.ts --help
```

Recommended local alias for development:

```bash
alias opsy='bun run /path/to/opsy-monorepo/packages/cli/src/bin.ts'
```

## Type checking

```bash
cd packages/cli
bun run typecheck
```

The CLI references `@opsy/api` for `AppType` — the API package must be
type-resolvable for type checking to pass. Workspace symlinks handle this
automatically in monorepo dev.

## Building

```bash
cd packages/cli
bun run build
```

Produces a self-contained `dist/bin.js` (workspace deps inlined; only `node:*`
external). The `bin` entry in `package.json` points to `./dist/bin.js`. The
published npm package strips workspace deps and ships only `dist/` +
`README.md`.

## Dependencies

| Dependency | Purpose |
|---|---|
| `commander` | CLI framework (command parsing, flags, help generation) |
| `@clack/prompts` | Terminal UI (spinners, prompts) for interactive flows |
| `chalk` | Colored terminal output |
| `hono` | Typed RPC client (`hc<AppType>()`) for API consumption |
| `open` | Open browser for device auth flow |
| `better-auth` | Better Auth client + `deviceAuthorizationClient` plugin |
| `@opsy/api` | Workspace dep — provides `AppType` for typed client (types only) |
| `@opsy/contracts` | Workspace dep — shared request/response contracts (types only) |
