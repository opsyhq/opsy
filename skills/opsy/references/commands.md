# CLI Commands

This reference mirrors the current CLI in [packages/cli/src](/Users/sabachikhinashvili/projects/opsy/opsy/packages/cli/src).

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
opsy env list --project <slug>
opsy env get --project <slug> --env <slug>
opsy env create --project <slug> --slug <slug>
```

## Resources

```bash
opsy resource ls --project <slug> --env <slug> [--parent <slug>]
opsy resource get <slug> --project <slug> --env <slug> [--live]
opsy resource sync <slug> --project <slug> --env <slug>
opsy resource accept-live <slug> --project <slug> --env <slug>
opsy resource promote-current <slug> --project <slug> --env <slug>
opsy resource tree --project <slug> --env <slug> [--depth <n>]
```

## Changes

```bash
opsy change create --project <slug> --env <slug> [--summary <text>] [--mutations <json>] [--apply]
opsy change update <short-id> --mutations <json> [--summary <text>] [--apply]
opsy change list --project <slug> --env <slug>
opsy change get <short-id>
opsy change preview <short-id>
opsy change apply <short-id>
opsy change dismiss <short-id>
opsy change retry <short-id>
```

## Schema

```bash
opsy schema providers
opsy schema types --provider <pkg>
opsy schema describe --type <token>
```

## Discovery

```bash
opsy discover
opsy discover aws types --project <slug> --env <slug> [--query <text>]
opsy discover aws list --project <slug> --env <slug> [--type <reType>] [--region <region>] [--profile <profileId>]
opsy discover aws inspect --project <slug> --env <slug> --cloud-id <id> --type <type> [--profile <profileId>]
opsy discover aws import --project <slug> --env <slug> --items <json>
```

## Provider Profiles

```bash
opsy provider list
opsy provider get <id>
opsy provider create --provider <pkg> --name <name> --config <json>
```

## Feedback

```bash
opsy feedback send --message <text> [--from-llm]
```

All commands support global `--json` and `--quiet` flags.
