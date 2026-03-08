# Opsy

Opsy is an AI-native infrastructure workflow for inspecting state, editing drafts, validating changes, and applying them through an agent-friendly interface.

This repo contains the public Opsy developer surface:

- the `opsy` CLI
- shared runtime contracts used by the CLI
- the installable Opsy skill for agent clients

## What To Use

- Use the CLI for one-shot commands, scripts, and environments where MCP is not configured.
- Use the Opsy skill to teach agent clients when to prefer MCP and when to fall back to the CLI.

## Current Layout

- `packages/cli` contains the `opsy` CLI source
- `packages/contracts` contains shared runtime schemas and types
- `skills/opsy` contains the installable Opsy skill

## Status

The hosted Opsy backend and operational infrastructure are not in this repository. This repo is the public client and integration surface.
