# Opsy CLI

Opsy is an agent-friendly infrastructure control plane. This package installs the `opsy` CLI for managing projects, environments, resources, changes, discovery, and observe workflows against the Opsy API.

The public GitHub repo mirrors the shipped CLI source for inspection and verification. Releases are published from Opsy's private source-of-truth monorepo.

## Install

```bash
npm install -g @opsyhq/opsy
```

## Quick start

```bash
opsy auth login --token <pat>
opsy project list
opsy env list --project <slug>
opsy resource ls --project <slug> --env <slug>
```

## Commands

```text
auth      Authentication
project   Manage workspaces/projects
env       Manage environments
resource  Manage resources
change    Manage changes
schema    Browse resource schemas
discover  Provider-scoped resource discovery
observe   Provider-scoped logs, metrics, and alarms
provider  Manage provider profiles
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
