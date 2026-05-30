# Opsy

**The unified API for cloud, built for AI agents.**

Opsy gives an agent one consistent way to deploy a resource, run a command on
it, and read its logs — across any cloud, through a single imperative interface.
You issue an action; Opsy executes it through a real Terraform provider and
records the result as durable spec/status. **No HCL to write, no statefile to
manage.**

The founding idea: *Infrastructure as Code assumed a human author. Agents remove
the author. Keep Terraform's providers — the real asset — and delete HCL and the
statefile, the human packaging.*

## Three pillars

- **Deploy** — create, update, delete, and import cloud resources. One tool call
  per operation.
- **Operate** — restart, reboot, invoke, snapshot, scale. Imperative operations
  as first-class commands, not scripts.
- **Observe** — logs, metrics, and alerts resolved by resource slug, not by
  vendor identifier.

Every tool call creates a durable operation. Every operation records its
execution. Resources project the current state of the world. The result is a
queryable, replayable history of everything your agents did.

## Why this exists

Agents ship code daily. But the moment they need to touch infrastructure —
provision a queue, restart a worker, pull logs — they hand off to a human
opening a console. Cloud tooling is fragmented across fifteen-plus vendors, each
with its own shape. Humans tolerate this. Agents can't. Opsy gives them one API
so they keep going.

## Repository layout

This is a [Bun](https://bun.sh) workspace monorepo.

| Path | What it is |
|---|---|
| `apps/api` | **Control plane** — Hono HTTP server owning tenancy, auth, credentials, approvals, durable records, realtime streaming, and the MCP tool surface. The "brain." |
| `apps/web` | Web app for humans and teams — view and author over the same store. |
| `apps/landing` | Marketing site. |
| `apps/thinking-block-ui` | Dev UI for authoring/inspecting "thinking blocks." |
| `packages/cli` (`@opsyhq/opsy`) | The CLI — `opsy <noun> <action>` grammar for humans and agents. |
| `packages/provider` | TypeScript provider adapters (imperative commands, observability, listing). |
| `packages/bridge-client` | Typed client for the Go bridge. |
| `packages/contracts` | Shared request/result contracts. |
| `packages/thinking-blocks` | Thinking-block runtime and schemas. |
| `bridge/` | **Go Terraform Bridge** — standalone server that hosts Terraform providers over `tfprotov6`/gRPC and handles declarative CRUD (read/plan/apply/import). |
| `infra/` | CloudFormation for the deploy IAM role. |
| `scripts/`, `Makefile` | Build the Go bridge and download provider binaries. |

### How a request flows

```
Agent (MCP) / CLI / Web
  → apps/api  (control plane: auth, policy, durable records)
    → packages/provider   (imperative commands, observe, list)
    → bridge/ (Go)        (declarative CRUD over tfprotov6)
        → terraform-provider-aws / -cloudflare / … (gRPC subprocesses)
```

## Getting started

### Prerequisites

- [Bun](https://bun.sh) (see `.nvmrc` / `engines` for the Node baseline)
- Go (to build the Terraform bridge)
- PostgreSQL (for the control plane)

### Install and build

```bash
bun install
make build      # compile the Go bridge → bin/opsy-bridge
make setup      # download the Terraform provider binaries
make smoke      # bridge smoke test using the bundled null provider (no creds)
```

### Run the control plane

```bash
cp apps/api/.env.example apps/api/.env   # then fill in DATABASE_URL and the generated secrets
cd apps/api
bun run db:migrate
bun run dev
```

Generate the auth and credential-encryption secrets with `openssl rand -base64 32`.

### Run the web app

```bash
cp apps/web/.env.example apps/web/.env
bun run dev:web
```

### Use the CLI

```bash
bun run --filter @opsyhq/opsy build   # → packages/cli/dist/bin.js
node packages/cli/dist/bin.js --help  # or `npm link` it onto your PATH as `opsy`
```

`opsy --help` and `opsy <command> --help` are always authoritative for the
version you have. See `packages/cli/README.md` for the full grammar.

## Testing

```bash
make test       # unit tests — no network, no credentials
make testacc    # live acceptance tests against real AWS (needs creds)
```

`make testacc` requires AWS credentials. Copy `.env.test.example` to `.env.test`,
fill it in, then `source .env.test && make testacc`.

## Development

- `bun run typecheck` — TypeScript across all packages
- `bun run lint` / `bun run format` — Biome
- `bun run dead` — unused-export check (knip)

See [`AGENTS.md`](AGENTS.md) and [`CLAUDE.md`](CLAUDE.md) for the engineering
conventions this codebase follows (dynamic behavior, one source of truth,
minimal structure, the migration workflow).

## License

Apache License 2.0 — see [`LICENSE`](LICENSE).
