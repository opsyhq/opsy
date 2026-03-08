---
name: opsy
description: Use when working with Opsy to manage infrastructure — inspecting stacks, editing drafts, applying runs, or managing org variables. Prefer MCP when available, fall back to CLI otherwise.
---

# Opsy

## When to use

Use this skill for tasks involving Opsy workspaces, stacks, drafts, revisions, runs, or org variables.

## MCP vs CLI

- **MCP** — preferred for interactive workflows (inspect, edit, validate, apply in one session)
- **CLI** — use when MCP is unavailable or for one-shot commands and scripts

## Workflow

1. Inspect current state before making changes (don't assume anything)
2. Use drafts for changes — write or edit, then validate
3. Apply and check run status — handle approval waits explicitly
4. Don't retry failed runs blindly — inspect first

## CLI reference

See `references/commands.md` for the full command surface.
