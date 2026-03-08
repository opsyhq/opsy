---
name: opsy
description: Use when working with Opsy through MCP or the opsy CLI to inspect current workspace state, manage drafts and revisions, review runs, or update org data. Prefer MCP for interactive agent workflows and use the CLI as a fallback when MCP is unavailable or shell execution is simpler.
---

# Opsy

## When to use this skill

Use this skill when the task is about Opsy workspaces, drafts, revisions, runs, or org-level notes and variables.

Start by inspecting current state. Do not assume prior repo state, prior run state, or previously created drafts.

## Surface choice

- Prefer MCP when an Opsy MCP server is already configured or the task needs iterative inspection, edits, validation, and follow-up actions in one session.
- Use the CLI when MCP is unavailable, when shell execution is easier, or when the task is a one-shot command or script.

## Default workflow

1. Inspect auth and current state first.
2. Prefer draft-based changes over direct destructive actions.
3. Validate drafts before apply when the change is non-trivial.
4. Check run status after apply or import, and handle approval explicitly if the run is waiting.

## Constraints

- Do not document or invoke CLI commands that are not shipped yet.
- Treat validation warnings, failed runs, and approval waits as explicit decision points.
- Keep auth guidance limited to current PAT-based CLI behavior and currently configured MCP flows.

## References

- Workflow guidance: `references/workflows.md`
- Current CLI command surface: `references/commands.md`
- Auth guidance: `references/auth.md`
- Troubleshooting: `references/troubleshooting.md`
