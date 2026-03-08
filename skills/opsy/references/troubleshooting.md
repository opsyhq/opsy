# Troubleshooting

## Unauthenticated or forbidden

- Re-check the token source order: explicit flag, environment, then stored config.
- Run `opsy auth whoami` to confirm the active identity.
- If MCP fails but CLI works, keep going with CLI and note the MCP issue.

## Missing context

- If workspace, stack, draft, or run identifiers are unclear, inspect first instead of guessing.
- Start with workspace listing and then inspect drafts, revisions, or runs relevant to the task.

## Validation warnings

- Do not ignore warnings silently.
- Report the warnings, decide whether to revise the draft, and only then continue.

## Awaiting approval

- Treat approval waits as a handoff point.
- Report the run state clearly instead of retrying blindly.

## Failed or canceled runs

- Inspect the run details before making another change.
- Prefer understanding the current state over creating a second draft immediately.
