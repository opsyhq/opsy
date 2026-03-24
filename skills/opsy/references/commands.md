# CLI Commands

This reference mirrors the shared noun-first command surface used by the CLI and the MCP `opsy` tool.

## Auth

```bash
opsy auth login --token <pat> [--api-url <url>]
opsy auth whoami
opsy auth logout
```

Environment variables: `OPSY_TOKEN`, `OPSY_API_URL`

## Projects

```bash
opsy project list
opsy project get <slug>
opsy project create --slug <slug> --name <name>
```

## Environments

```bash
opsy environment list --workspace <slug>
opsy environment get <slug> --workspace <slug>
opsy environment create --workspace <slug> --slug <slug>
```

## Resources

```bash
opsy resource list --workspace <slug> --env <slug> [--parent <slug>] [--detailed]
opsy resource get <slug> --workspace <slug> --env <slug> [--live]
opsy resource create --workspace <slug> --env <slug> --slug <slug> --type <token> --inputs <json> [--parent <slug>]
opsy resource update <slug> --workspace <slug> --env <slug> --inputs <json>
opsy resource delete <slug> --workspace <slug> --env <slug> [--recursive]
opsy resource refresh <slug> --workspace <slug> --env <slug>
opsy resource diff <slug> --workspace <slug> --env <slug>
opsy resource accept-live <slug> --workspace <slug> --env <slug>
opsy resource reconcile <slug> --workspace <slug> --env <slug>
opsy resource restore <slug> --workspace <slug> --env <slug> --operation <id>
opsy resource history <slug> --workspace <slug> --env <slug>
```

## Changes

```bash
opsy change create --workspace <slug> --env <slug> [--summary <text>] [--mutations <json>]
opsy change append <short-id> --mutations <json> [--summary <text>]
opsy change list --workspace <slug> --env <slug>
opsy change get <short-id>
opsy change preview <short-id>
opsy change apply <short-id>
opsy change discard <short-id>
opsy change retry <short-id>
```

## Schema

```bash
opsy provider list
opsy provider get <id>
opsy provider create --provider <pkg> --name <name> --config <json>
opsy schema list --provider <pkg> [--query <text>]
opsy schema get <token>
```

## Discovery

```bash
opsy discovery
opsy discovery aws types --workspace <slug> --env <slug> [--query <text>]
opsy discovery aws list --workspace <slug> --env <slug> [--type <reType>] [--region <region>] [--profile <profileId>]
opsy discovery aws inspect --workspace <slug> --env <slug> --cloud-id <id> --type <type> [--profile <profileId>]
opsy discovery aws import --workspace <slug> --env <slug> --items <json>
```

## Observability

```bash
opsy observability
opsy observability aws logs groups --workspace <slug> --env <slug> [--profile <profileId>] [--region <region>] [--name-prefix <prefix>] [--limit <n>] [--next-token <token>]
opsy observability aws logs tail --workspace <slug> --env <slug> --log-group <name> [--profile <profileId>] [--region <region>] [--log-stream <name>] [--filter-pattern <pattern>] [--since <duration-or-iso>] [--until <duration-or-iso>] [--limit <n>]
opsy observability aws logs events --workspace <slug> --env <slug> --log-group <name> [--profile <profileId>] [--region <region>] [--log-stream <name>] [--filter-pattern <pattern>] [--since <duration-or-iso>] [--until <duration-or-iso>] [--limit <n>] [--next-token <token>]
opsy observability aws logs query --workspace <slug> --env <slug> --log-groups <csv> --query-string <text> [--profile <profileId>] [--region <region>] [--since <duration-or-iso>] [--until <duration-or-iso>] [--limit <n>] [--timeout-seconds <n>]
opsy observability aws metrics list --workspace <slug> --env <slug> [--profile <profileId>] [--region <region>] [--namespace <name>] [--metric-name <name>] [--dimensions <json-array>] [--recently-active <PT3H>] [--next-token <token>]
opsy observability aws metrics query --workspace <slug> --env <slug> --queries <json-array> [--profile <profileId>] [--region <region>] [--since <duration-or-iso>] [--until <duration-or-iso>] [--scan-by <TimestampDescending|TimestampAscending>] [--max-datapoints <n>]
opsy observability aws alarms list --workspace <slug> --env <slug> [--profile <profileId>] [--region <region>] [--state <OK|ALARM|INSUFFICIENT_DATA>] [--type <metric|composite|all>] [--name-prefix <prefix>] [--limit <n>] [--next-token <token>]
opsy observability aws alarms detail --workspace <slug> --env <slug> --alarm-name <name> [--profile <profileId>] [--region <region>]
opsy observability aws alarms history --workspace <slug> --env <slug> --alarm-name <name> [--profile <profileId>] [--region <region>] [--history-item-type <ConfigurationUpdate|StateUpdate|Action>] [--since <duration-or-iso>] [--until <duration-or-iso>] [--limit <n>] [--next-token <token>]
```

## Feedback

```bash
opsy feedback send --message <text> [--error-context <json>] [--from-llm]
```

All commands support global `--json` and `--quiet` flags.
