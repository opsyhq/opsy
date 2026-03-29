# CLI Commands

This reference mirrors the shared noun-first command surface used by the CLI and the MCP `opsy` tool.

## Auth

```bash
opsy auth login --token <pat> [--api-url <url>]
opsy auth whoami
opsy auth logout
```

Environment variables: `OPSY_TOKEN`, `OPSY_API_URL`, `OPSY_PROJECT`

## Projects

```bash
opsy project list
opsy project get <slug>
opsy project create --slug <slug> --name <name>
opsy project delete <slug>
```

## Resources

```bash
opsy resource list --project <slug> [--parent <slug>] [--detailed]
opsy resource discover --project <slug> [--provider <provider>] [--type <type>]
opsy resource get <slug> --project <slug>
opsy resource read [<slug>] --project <slug> [--type <type> --provider-id <id> --provider <provider>]
opsy resource create --project <slug> --slug <slug> --type <token> --inputs <json> [--parent <slug>] [--depends-on <json>] [--auto-apply]
opsy resource update <slug> --project <slug> --inputs <json> [--remove-input-paths <json>] [--parent <slug>] [--depends-on <json>] [--auto-apply]
opsy resource delete [<slug>] --project <slug> [--recursive] [--auto-apply] [--type <type> --provider-id <id>]
opsy resource import --project <slug> --slug <slug> --type <type> --provider-id <id>
opsy resource refresh <slug> --project <slug>
opsy resource diff <slug> --project <slug>
opsy resource accept-live <slug> --project <slug>
opsy resource reconcile <slug> --project <slug>
opsy resource restore <slug> --project <slug> --operation <id>
opsy resource history <slug> --project <slug>
```

Notes:
- `resource create`, `resource update`, and `resource delete` are preview-first. They return a change preview by default and include the next explicit `change apply` step. Pass `--auto-apply` to continue into apply immediately.
- `opsy resource accept-live` requires an `out_of_sync` resource with a recorded conflict snapshot and updates desired inputs immediately.
- `opsy resource reconcile` requires an `out_of_sync` resource with recorded live inputs and creates a reviewable change that adopts those live inputs.
- If `resource reconcile` says there is no recorded live input snapshot to promote, refresh drift first and retry.

## Changes

```bash
opsy change create --project <slug> [--summary <text>] [--mutations <json>]
opsy change append <short-id> --mutations <json> [--summary <text>]
opsy change list --project <slug>
opsy change get <short-id>
opsy change preview <short-id>
opsy change apply <short-id>
opsy change discard <short-id>
opsy change retry <short-id>
```

## Integrations

```bash
opsy integration list
opsy integration get <id>
opsy integration create --provider <pkg> --name <name> --config <json>
opsy integration delete <id>
```

## Schema

```bash
opsy schema list --provider <pkg> [--query <text>]
opsy schema get <token>
```

## Observability

```bash
opsy observability
opsy observability aws logs groups --project <slug> [--region <region>] [--name-prefix <prefix>] [--limit <n>] [--next-token <token>]
opsy observability aws logs tail --project <slug> --log-group <name> [--region <region>] [--log-stream <name>] [--filter-pattern <pattern>] [--since <duration-or-iso>] [--until <duration-or-iso>] [--limit <n>]
opsy observability aws logs events --project <slug> --log-group <name> [--region <region>] [--log-stream <name>] [--filter-pattern <pattern>] [--since <duration-or-iso>] [--until <duration-or-iso>] [--limit <n>] [--next-token <token>]
opsy observability aws logs query --project <slug> --log-groups <csv> --query-string <text> [--region <region>] [--since <duration-or-iso>] [--until <duration-or-iso>] [--limit <n>] [--timeout-seconds <n>]
opsy observability aws metrics list --project <slug> [--region <region>] [--namespace <name>] [--metric-name <name>] [--dimensions <json-array>] [--recently-active <PT3H>] [--next-token <token>]
opsy observability aws metrics query --project <slug> --queries <json-array> [--region <region>] [--since <duration-or-iso>] [--until <duration-or-iso>] [--scan-by <TimestampDescending|TimestampAscending>] [--max-datapoints <n>]
opsy observability aws alarms list --project <slug> [--region <region>] [--state <OK|ALARM|INSUFFICIENT_DATA>] [--type <metric|composite|all>] [--name-prefix <prefix>] [--limit <n>] [--next-token <token>]
opsy observability aws alarms detail --project <slug> --alarm-name <name> [--region <region>]
opsy observability aws alarms history --project <slug> --alarm-name <name> [--region <region>] [--history-item-type <ConfigurationUpdate|StateUpdate|Action>] [--since <duration-or-iso>] [--until <duration-or-iso>] [--limit <n>] [--next-token <token>]
```

## Feedback

```bash
opsy feedback send --message <text> [--error-context <json>] [--from-llm]
```

All commands support global `--json` and `--quiet` flags.
