# Auth

## CLI auth

Current shipped CLI auth is PAT-based.

Supported inputs:

- `opsy auth login --token <pat>`
- `OPSY_TOKEN`
- `OPSY_API_URL`

Useful checks:

```bash
opsy auth whoami
opsy auth logout
```

## Storage

The current CLI stores config in a local config file. Do not describe keychain or credential-manager behavior as shipped unless the implementation changes.

## MCP auth

If MCP is already configured in the client, prefer reusing that setup rather than switching surfaces mid-task unless CLI execution is clearly simpler.
