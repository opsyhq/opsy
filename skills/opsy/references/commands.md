# CLI Commands

This reference mirrors the shared verb-first command surface used by the CLI and the MCP `opsy` tool.

## Auth

```bash
opsy auth login --token <pat> [--api-url <url>]
opsy auth whoami
opsy auth logout
```

Environment variables: `OPSY_TOKEN`, `OPSY_API_URL`

## Projects

```bash
opsy list projects
opsy get project <slug>
opsy create project --slug <slug> --name <name>
```

## Environments

```bash
opsy list envs --project <slug>
opsy get env <slug> --project <slug>
opsy create env --project <slug> --slug <slug>
```

## Resources

```bash
opsy list resources --project <slug> --env <slug> [--parent <slug>] [--detailed]
opsy get resource <slug> --project <slug> --env <slug> [--live]
opsy create resource --project <slug> --env <slug> --slug <slug> --type <token> --inputs <json> [--parent <slug>]
opsy update resource <slug> --project <slug> --env <slug> --inputs <json>
opsy delete resource <slug> --project <slug> --env <slug> [--recursive]
opsy refresh resource <slug> --project <slug> --env <slug>
opsy diff resource <slug> --project <slug> --env <slug>
opsy accept resource <slug> --project <slug> --env <slug>
opsy push resource <slug> --project <slug> --env <slug>
opsy restore resource <slug> --project <slug> --env <slug> --operation <id>
opsy history resource <slug> --project <slug> --env <slug>
```

## Changes

```bash
opsy create change --project <slug> --env <slug> [--summary <text>] [--mutations <json>]
opsy append change <short-id> --mutations <json> [--summary <text>]
opsy list changes --project <slug> --env <slug>
opsy get change <short-id>
opsy plan change <short-id>
opsy apply change <short-id>
opsy dismiss change <short-id>
opsy retry change <short-id>
```

## Schema

```bash
opsy list providers
opsy get provider <id>
opsy create provider --provider <pkg> --name <name> --config <json>
opsy list schemas --provider <pkg> [--query <text>]
opsy get schema <token>
```

## Discovery

```bash
opsy discover
opsy discover aws types --project <slug> --env <slug> [--query <text>]
opsy discover aws list --project <slug> --env <slug> [--type <reType>] [--region <region>] [--profile <profileId>]
opsy discover aws inspect --project <slug> --env <slug> --cloud-id <id> --type <type> [--profile <profileId>]
opsy discover aws import --project <slug> --env <slug> --items <json>
```

## Observe

```bash
opsy observe
opsy observe aws logs groups --project <slug> --env <slug> [--profile <profileId>] [--region <region>] [--name-prefix <prefix>] [--limit <n>] [--next-token <token>]
opsy observe aws logs tail --project <slug> --env <slug> --log-group <name> [--profile <profileId>] [--region <region>] [--log-stream <name>] [--filter-pattern <pattern>] [--since <duration-or-iso>] [--until <duration-or-iso>] [--limit <n>]
opsy observe aws logs events --project <slug> --env <slug> --log-group <name> [--profile <profileId>] [--region <region>] [--log-stream <name>] [--filter-pattern <pattern>] [--since <duration-or-iso>] [--until <duration-or-iso>] [--limit <n>] [--next-token <token>]
opsy observe aws logs query --project <slug> --env <slug> --log-groups <csv> --query-string <text> [--profile <profileId>] [--region <region>] [--since <duration-or-iso>] [--until <duration-or-iso>] [--limit <n>] [--timeout-seconds <n>]
opsy observe aws metrics list --project <slug> --env <slug> [--profile <profileId>] [--region <region>] [--namespace <name>] [--metric-name <name>] [--dimensions <json-array>] [--recently-active <PT3H>] [--next-token <token>]
opsy observe aws metrics query --project <slug> --env <slug> --queries <json-array> [--profile <profileId>] [--region <region>] [--since <duration-or-iso>] [--until <duration-or-iso>] [--scan-by <TimestampDescending|TimestampAscending>] [--max-datapoints <n>]
opsy observe aws alarms list --project <slug> --env <slug> [--profile <profileId>] [--region <region>] [--state <OK|ALARM|INSUFFICIENT_DATA>] [--type <metric|composite|all>] [--name-prefix <prefix>] [--limit <n>] [--next-token <token>]
opsy observe aws alarms detail --project <slug> --env <slug> --alarm-name <name> [--profile <profileId>] [--region <region>]
opsy observe aws alarms history --project <slug> --env <slug> --alarm-name <name> [--profile <profileId>] [--region <region>] [--history-item-type <ConfigurationUpdate|StateUpdate|Action>] [--since <duration-or-iso>] [--until <duration-or-iso>] [--limit <n>] [--next-token <token>]
```

## Feedback

```bash
opsy feedback send --message <text> [--error-context <json>] [--from-llm]
```

All commands support global `--json` and `--quiet` flags.
