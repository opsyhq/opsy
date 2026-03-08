# Opsy

Infrastructure management for AI agents. Define stacks in YAML, deploy through Pulumi, manage everything through an agent-friendly API.

## Packages

- **`@opsy/cli`** — CLI for managing workspaces, drafts, runs, and org settings
- **`@opsy/contracts`** — Shared schemas and types

## CLI

```bash
opsy auth login --token <pat>
opsy workspace list
```

### Drafts

```bash
opsy draft list --workspace <slug> --stack <slug>
opsy draft write --workspace <slug> --stack <slug> --file spec.yaml
opsy draft edit --workspace <slug> --stack <slug> --old-string "old" --new-string "new"
opsy draft validate <draft-id>
```

### Runs

```bash
opsy run apply --workspace <slug> --stack <slug> --env <slug>
opsy run wait <run-id>
opsy run list --workspace <slug>
```

### Org

```bash
opsy org list
opsy org set <key> --value <value> [--sensitive]
opsy org set-notes --file notes.md
```

All commands support `--json` for machine-readable output and `--quiet` for minimal output.

## Opsy Skill

The `skills/opsy` directory is an installable skill for AI agent clients (e.g. Claude Code). It teaches agents when and how to use Opsy's MCP server or CLI.

Install it by pointing your agent client at the `skills/opsy` directory.

## Links

- [opsy.sh](https://opsy.sh)
