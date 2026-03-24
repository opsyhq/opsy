# Opsy CLI

Opsy is an agent-friendly infrastructure control plane. This package installs the `opsy` CLI for managing projects, environments, resources, changes, discovery, and observability workflows against the Opsy API.

The public GitHub repo mirrors the shipped CLI source for inspection and verification. Releases are published from Opsy's private source-of-truth monorepo.

## Install

```bash
npm install -g @opsyhq/opsy
```

## Quick start

```bash
opsy auth login --token <pat>
opsy project list
opsy environment list --workspace <slug>
opsy resource list --workspace <slug> --env <slug>
```

## Commands

```text
auth           Authentication
project        Projects
environment    Environments inside a project
resource       Managed resources and resource lifecycle actions
change         Proposed and applied changes
provider       Provider profiles
schema         Resource schema browsing
discovery      Provider-scoped resource discovery
observability  Provider-scoped logs, metrics, and alarms
feedback       Submit feedback to the Opsy team
```

Use `opsy --help` for the top-level command tree, `opsy discovery aws --help` for discovery commands, and `opsy observability aws --help` for CloudWatch observability commands.

## Authentication

The CLI accepts a personal access token through:

- `opsy auth login --token <pat>`
- `--token <pat>`
- `OPSY_TOKEN`

The API base URL can be configured with `--api-url` or `OPSY_API_URL`. The default is `https://api.opsy.sh`.

## Skill

The `skills/opsy` directory in the public mirror is installable in agent clients that support local skills. It documents when to use Opsy over MCP or CLI flows.

## Links

- [Opsy](https://opsy.sh)
