---
name: opsy
description: Use when working with Opsy to manage infrastructure — inspecting projects/resources, proposing changes, previewing them, and applying executions. Prefer MCP when available, fall back to CLI otherwise.
---

# Opsy

## When to use

Use this skill for tasks involving Opsy projects, resources, changes, executions, integrations, discovery, observability flows, or schema inspection.

## MCP vs CLI

- **MCP** — preferred for interactive workflows (inspect, edit, validate, apply in one session)
- **CLI** — use when MCP is unavailable or for one-shot commands and scripts
- Use `observability` when the task is operational troubleshooting: logs, metrics, alarms, or recent runtime signals.
- CLI and MCP now share the same noun-first grammar through the single `opsy` surface.

## Workflow

1. Inspect current state before making changes (don't assume anything)
2. Propose explicit resource mutations as changes
3. Use preview before apply, and review blast radius for delete or downstream effects
4. Apply the change or direct the user to the change review page when approval is required
5. Don't retry failed changes blindly — inspect executions and step history first

## CLI reference

See `references/commands.md` for the full command surface.
See `references/domain.md` for mutation format, refs, groups, preview-first convenience mutations, and auto-apply behavior.
