# Workflows

## Choose the surface

Prefer MCP when:

- the MCP server is already configured
- the task will need repeated inspection and follow-up actions
- you want the richest Opsy-native workflow in one agent session

Use the CLI when:

- MCP is unavailable
- shell execution is easier than reconfiguring a client
- the task is a one-shot check or scripted operation

## Inspect first

Before making changes, inspect current state instead of assuming it:

- confirm auth
- inspect available workspaces
- inspect drafts, revisions, or runs relevant to the target stack
- inspect org-level notes or variables only if they are part of the task

For CLI work, use the shipped command groups and local help:

```bash
opsy auth whoami
opsy workspace list
opsy draft --help
opsy revision --help
opsy run --help
opsy org --help
```

## Draft workflow

Default shape:

1. inspect the existing draft or revision state
2. create or select a draft
3. write or edit the draft
4. validate the draft
5. apply or hand off
6. inspect the resulting run

CLI fallback uses the shipped `draft`, `revision`, and `run` commands. Use `--help` locally for exact argument details because the public skill must stay aligned to the shipped CLI.

## Run workflow

After `run apply` or `run import`:

1. inspect the run
2. wait if the task requires completion
3. stop and report if the run is awaiting approval, failed, rejected, or canceled

Do not assume an apply completed just because the command returned.

## Org workflow

Use org commands only when the task explicitly needs org notes or org variables. Keep those changes scoped and reversible.
