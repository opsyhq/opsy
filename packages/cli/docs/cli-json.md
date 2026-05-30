# Machine-readable output (`-F json`)

Every command that produces structured output accepts `-F json` (or
`--format json`). This document is the contract for scripts and agents:
the envelope each command emits, the exit-code taxonomy, and how errors
are reported.

Two rules cover everything below:

1. **One entity → a named wrapper; a collection → its plural key.** A single
   resource is `{ "resource": … }`, a list is `{ "resources": [ … ] }`. The
   wrapper never disappears, so a consumer can address one field path
   regardless of hits.
2. **Branch on `$?`, not on the body.** Success and failure both write JSON to
   **stdout** (see [Errors](#errors)); the process exit code is the reliable
   signal. The error body additionally carries a stable machine `code`/`tag`.

## Command envelopes

| Command | `-F json` shape |
|---|---|
| `resource get <slug>` | `{ "resource": <ResourceView> }` |
| `resource get <slug> --detail` / `resource describe <slug>` | `{ "resource": <ResourceView> }` |
| `resource get <slug> --output <dotpath>` | raw value, newline-terminated — **not** JSON-wrapped (see below) |
| `resource list` | `{ "resources": [ <ResourceView>, … ] }` |
| `project get <slug>` | `{ "project": <Project> }` |
| `project list` | `{ "projects": [ <Project>, … ] }` |
| `integration get <slug>` | `{ "integration": <Integration> }` |
| `integration list` | `{ "integrations": [ <Integration>, … ] }` |
| `registry list` | `{ "providers": [ <Provider>, … ] }` |
| `registry types <provider>` | `{ "results": [ { provider, type, … }, … ], "truncated": <bool> }` |
| `registry connect <provider>` | `{ provider, providerVersion, mode, credentialsSchema, configSchema, generated, onboarding, credentials }` |
| `operation get <id>` / `operation watch` | `{ "operation": <Operation> }` |
| `changeset …` | `{ "changeSet": <ChangeSet> }` |
| `context` / `whoami` | `{ profile, project, authenticated, user?, orgId?, expiresAt? }` |
| `auth status` | `{ authenticated, … }` (see [auth status](#auth-status)) |
| `config view` | `{ profile, apiUrl, project }` |
| `status` | `{ project, apiUrl, orgId, linkPath, profileProject }` (each context value as `{ value, source }`) |
| `link` / `unlink` | `{ project, path }` / `{ removed }` |

`<ResourceView>`, `<Project>`, etc. are the server's domain shapes returned
verbatim — the CLI does not reshape them, so they track the API, not a copied
schema. Notable additive fields:

- **`resource.inlinedInputs`** — present on the single-resource GET (`resource
  get`/`describe`) **only when `inputs` actually carried `$ref`s that
  resolved**: the same structure with each ref replaced by its target's live
  scalar. Absent means "no refs, or not yet resolvable" — fall back to
  `inputs`. `inputs` itself is never rewritten.

### `resource get --output <dotpath>`

A direct accessor for one value, using the same dot-path grammar as
`--set`/`--set-ref` (`outputs.arn`, `outputs.tags[0]`, `inputs.region`).
It prints the **raw value only**, newline-terminated, with no envelope:

```bash
opsy resource get my-bucket --output outputs.arn
# arn:aws:s3:::my-bucket
```

Strings print verbatim (no quotes); non-strings are JSON-encoded. A
falsy-but-present value (`false`, `0`, `null`) still prints — it is a value,
not a miss. A path that does not exist is a validation error (exit `5`), not
empty output, so a typo never looks like a legitimately empty field.

### `registry types` pagination

The server owns the page-size bound; the CLI passes `--limit`/`--offset`
through and surfaces the server's message on rejection (no client-side guard
to drift from it). `--all` walks pages until the server stops setting
`truncated`, accumulates, and emits a single envelope with
`"truncated": false`:

```bash
opsy registry types aws --all -F json | jq '.results | length'
```

`results` entries are reduced to their identifying fields; web-only display
metadata (`artifacts`) is stripped — it is noise for a machine consuming the
catalog.

### `auth status`

The shape depends on how you are authenticated:

```jsonc
// OPSY_API_KEY set
{ "authenticated": true, "mode": "api-key" }

// no stored credentials
{ "authenticated": false }

// stored session, probed live against the API
{ "authenticated": true,  "user":       { … }, "orgId": "…", "expiresAt": "…" }
{ "authenticated": false, "cachedUser": { … }, "reason": "token_rejected", "orgId": "…", "expiresAt": "…" }
```

`reason` is a stable token (`unreachable`, `token_rejected`, `token_invalid`,
`server_error`, …) explaining why a stored credential failed its live probe.

`context`/`whoami` is the one-shot "what am I pointed at": active profile +
project + identity, composed from the same probe. It deliberately omits
`apiUrl` — that stays the `config view` escape hatch.

## Exit codes

Scripts branch on `$?`. Categories derive from the failing operation's HTTP
status via the contracts status map — there is no parallel per-error table to
drift from.

| Code | Meaning | Typical trigger |
|---|---|---|
| `0` | success | — |
| `1` | generic / unclassified failure | unexpected error, unknown API failure |
| `2` | awaiting approval | an apply needs a `changeset approve` before it proceeds |
| `3` | auth | not logged in, token rejected/expired (HTTP 401/403) |
| `4` | not found | unknown project/resource/operation/integration (HTTP 404) |
| `5` | validation | bad input, missing required flag, bad `--output` path (HTTP 400/422) |
| `6` | network | API unreachable, connection refused |
| `7` | conflict | resource locked, operation already in flight (HTTP 409) |

## Errors

Error output goes to **stdout** as JSON when `-F json` is set (it is part of
the command's machine output, not an out-of-band log) and carries a stable
machine identifier:

```jsonc
{
  "error": "Resource \"web\" not found in project \"demo\"",
  "tag":   "ResourceNotFound",          // typed API errors: the contract tag
  "hint":  "run \"opsy resource list\" to see available resources.",
  // …error-specific fields (e.g. slug, projectSlug)
}
```

```jsonc
{
  "error": "Server unreachable at https://api.opsy.sh. Is the API running?",
  "code":  "NETWORK_ERROR"              // CLI-side failures: a code instead of a tag
}
```

`tag` (typed contract errors) and `code` (CLI-side failures) are the stable
fields to match on; `error` is a human message and may change wording. Do not
parse the message — branch on the exit code first, then read `tag`/`code` if
you need to distinguish causes within a category.
