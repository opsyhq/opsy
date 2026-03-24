# Opsy CLI

Opsy is an agent-friendly infrastructure control plane. This package installs the `opsy` CLI for managing workspaces, environments, resources, changes, discovery, and observe workflows against the Opsy API.

The public GitHub repo mirrors the shipped CLI source for inspection and verification. Releases are published from Opsy's private source-of-truth monorepo.

## Install

```bash
npm install -g @opsyhq/opsy
```

## Quick start

```bash
opsy auth login --token <pat>
opsy list workspaces
opsy list envs --workspace <slug>
opsy list resources --workspace <slug> --env <slug>
```

## Commands

```text
auth      Authentication
list      List resources, changes, workspaces, environments, providers, and schemas
get       Fetch one resource, change, workspace, environment, provider, or schema
create    Create resources, changes, workspaces, environments, and providers
update    Update resources
delete    Delete resources
apply     Apply a change
plan      Preview a change
dismiss   Dismiss a change
append    Append mutations to a change
retry     Retry a failed change
refresh   Refresh live resource state
diff      Diff stored and live resource state
accept    Accept recorded live state for a resource
push      Push stored desired state through a change
restore   Restore a resource from operation history
history   List resource operation history
discover  Provider-scoped resource discovery
observe   Provider-scoped logs, metrics, and alarms
feedback  Submit feedback to the Opsy team
```

Use `opsy --help` for the top-level command tree, `opsy discover aws --help` for discovery commands, and `opsy observe aws --help` for CloudWatch observe commands.

## Authentication

The CLI accepts a personal access token through:

- `opsy auth login --token <pat>`
- `--token <pat>`
- `OPSY_TOKEN`

The API base URL can be configured with `--api-url` or `OPSY_API_URL`. The default is `http://localhost:4000`.

## Skill

The `skills/opsy` directory in the public mirror is installable in agent clients that support local skills. It documents when to use Opsy over MCP or CLI flows.

## Links

- [Opsy](https://opsy.sh)
