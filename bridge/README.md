# Opsy Terraform Bridge

Standalone Go HTTP server that wraps Terraform providers over `tfprotov6`. This is the CRUD backend for Opsy's control plane.

The bridge handles declarative resource operations (read, plan, apply, import) for `resource` nodes and data source reads for `data` nodes. Imperative commands, observability, and listing are handled by TypeScript provider adapters — not the bridge.

## How it works

The TS control plane spawns the bridge as a subprocess. On startup the bridge binds to a random localhost port and writes the port number to stdout. The control plane reads it and sends requests over HTTP.

```
TS Control Plane
  → HTTP (localhost:PORT) →
    Go Bridge
      → gRPC → terraform-provider-aws (subprocess)
      → gRPC → terraform-provider-cloudflare (subprocess)
```

Terraform provider binaries run as gRPC subprocesses of the bridge using HashiCorp's `go-plugin` library. This is the same mechanism `terraform` itself uses to host providers. Multiple provider versions can run simultaneously.

## API

Most execution requests include `provider_source`, `provider_version`, and `provider_config`. Schema discovery requests take only `provider_source` and `provider_version`; they read the schema cache and never require credentials.

| Endpoint | Purpose |
|---|---|
| `POST /providers/metadata` | Provider metadata and capabilities |
| `POST /providers/summary` | Manifest-backed provider resource/data-source counts |
| `POST /providers/types/search` | Bounded manifest-backed type search |
| `POST /providers/types/resolve` | Resolve one type to resource/data-source kinds |
| `POST /providers/types/schema` | Project one selected resource or data-source schema |
| `POST /providers/config-schema` | Project the provider configuration schema |
| `POST /providers/validate-config` | Validate provider configuration |
| `POST /resources/validate-config` | Validate resource configuration against schema |
| `POST /resources/read` | Read current live state for one managed resource |
| `POST /resources/plan` | Plan one resource change, returns planned state + opaque plan blob |
| `POST /resources/apply` | Apply a planned change. For updates/deletes: re-plan to detect staleness first. For creates (prior_state null): apply directly. Returns new state |
| `POST /resources/import` | Import existing resource by provider ID (ImportResourceState + ReadResource) |
| `POST /data-sources/read` | Read a data source by config/selector (for `data` nodes) |

### Stale plan detection

`/resources/apply` does not blindly apply stored plans for updates and deletes. It re-plans with current state first (matching what `terraform apply` does internally). If the re-plan action diverges from the stored plan (e.g., an update became a replace), the bridge returns a stale diagnostic without applying. The control plane then marks the action as stale and asks the user to re-preview.

Creates (`prior_state` is null) skip this check — there is nothing to drift against.

### Error model

- Provider diagnostics (warnings/errors from the TF provider) are returned in the response body with HTTP 200. These are expected — the control plane interprets them.
- Transport-level errors (binary not found, gRPC failure, encoding error) return HTTP 4xx/5xx with a JSON error body.

## Provider instance pool

The bridge pools configured provider instances to avoid spawning a new subprocess for every CRUD request.

**Pool key**: `sha256(provider_source + provider_version + json(provider_config))`

Same credentials from different tenants hit the same instance — safe because they have identical access. Different credentials always get different instances.

LRU eviction at `--pool-size` (default 20). Evicted instances are gracefully shut down via `StopProvider` RPC.

The pool only manages configured execution-path instances (`read`, `plan`, `apply`, `import`, `validate`, `data-source-read`). Runtime instances do not call `GetProviderSchema`; execution handlers read the selected canonical schema shard and convert it to the codec schema type needed for that one operation. A short-lived `schema-extract` subprocess performs the provider schema RPC, writes cache shards, and exits.

## Provider binaries

Binaries are expected at a known directory path, organized as:

```
<provider-dir>/
  hashicorp/aws/6.44.0/terraform-provider-aws_v6.44.0
  hashicorp/aws/5.95.0/terraform-provider-aws_v5.95.0
  hashicorp/cloudflare/4.48.0/terraform-provider-cloudflare_v4.48.0
```

The directory is set via `--provider-dir` or `OPSY_PROVIDER_DIR`, defaulting to `/opt/opsy/providers` in production and `./providers` locally.

Binaries are bundled in the Docker image. There is no on-demand downloading in v2.

## Project structure

```
bridge/
  main.go                    # entry point: parse flags, bind port, print to stdout
  server/
    server.go                # chi router + middleware (logging, recovery)
    routes.go                # route registration
  handler/
    resource_read.go         # POST /resources/read
    resource_plan.go         # POST /resources/plan
    resource_apply.go        # POST /resources/apply (re-plan + stale check)
    resource_import.go       # POST /resources/import
    resource_validate.go     # POST /resources/validate-config
    datasource_read.go       # POST /data-sources/read
    provider_metadata.go     # POST /providers/metadata
    provider_schema.go       # schema summary/search/resolve/selected-schema endpoints
    provider_validate.go     # POST /providers/validate-config
    common.go                # shared handler utilities
  schema/
    dto.go                   # Terraform-shaped canonical persistence DTO
    write.go                 # extractor serialization to schema-cache shards
    service.go               # cache ensure, manifest search, selected projection
    projection.go            # selected schema projection and codec conversion
  provider/
    pool.go                  # LRU provider instance pool
    instance.go              # single provider: gRPC client + process handle
    launcher.go              # spawn provider binary via go-plugin, connect gRPC
    discovery.go             # find binary by source + version in bundled directory
  codec/
    dynamic_value.go         # JSON <-> msgpack <-> DynamicValue (tftypes)
    schema.go                # schema type helpers
  types/
    request.go               # HTTP request structs
    response.go              # HTTP response structs
  internal/
    staleplan/
      staleplan.go           # compare two plan results for action divergence
  respond/
    respond.go               # JSON response helpers
```

## Running

```bash
cd bridge
go build -o opsy-bridge .
./opsy-bridge --provider-dir ./providers --pool-size 20
# prints port number to stdout, e.g.: 54321
```

## Testing

### Unit tests

Unit tests cover the codec (JSON↔msgpack↔tftypes), stale-plan detection logic, and provider discovery. No external binaries required.

```bash
cd bridge
go test ./codec/... ./internal/... ./provider/...
```

### Integration tests

Integration tests exercise the full stack: HTTP handler → codec → go-plugin → real provider binary. The test binary downloads `terraform-provider-null v3.2.3` from releases.hashicorp.com on first run and caches it under `integration/testdata/providers/`. Subsequent runs skip the download.

```bash
cd bridge
go test -v -timeout 120s ./integration/
```

Set `BRIDGE_PROVIDER_DIR` to point at a pre-populated provider directory (same layout as `--provider-dir`) to skip the download entirely — useful in offline CI.

The integration suite starts the bridge in-process on a random port and runs all tests against it:

| Test | What it exercises |
|---|---|
| `TestProviderSummaryAndSelectedTypeSchema` | manifest summary/search and selected schema projection |
| `TestProviderMetadata` | `POST /providers/metadata` — server capabilities |
| `TestNullResourceLifecycle` | Full create → read → update (replace) → destroy cycle |
| `TestNullResourceImport` | `POST /resources/import` — provider diagnostic surfaced correctly |
| `TestProviderValidate` | `POST /providers/validate-config` |
| `TestResourceValidate` | `POST /resources/validate-config` |
| `TestStalePlanDetection` | Stale plan detection (re-plan divergence) |
| `TestCodecPrecision` | Large integers round-trip through JSON↔msgpack without float coercion |
| `TestConcurrentRequests` | 20 concurrent applies share one provider instance |
| `TestUnknownProviderVersion` | Returns HTTP 400 with available versions |
| `TestUnknownResourceType` | Returns HTTP 400 |

### Notes on the null provider

- `null_resource.id` is a computed string — unknown at plan time, assigned at apply. The bridge represents unknown values as JSON `null`.
- `null_resource.triggers` triggers a **replace** (not in-place update) when changed. The `/resources/apply` request must include `requires_replace` from the plan response so the bridge can correctly classify the stored action.
- `null_resource` does not support import in v3.2.3 (terraform-plugin-framework); the bridge surfaces the provider diagnostic with HTTP 200.

## Dependencies

| Dependency | Purpose |
|---|---|
| `terraform-plugin-go` | tfprotov6 types, tftypes, DynamicValue encoding |
| `go-plugin` | Provider subprocess management (spawn, gRPC, mTLS) |
| `chi` | Lightweight HTTP router |
| `grpc` | gRPC client to provider subprocesses |
| `golang.org/x/sync` | `singleflight` — prevents duplicate provider spawns under concurrent load |
