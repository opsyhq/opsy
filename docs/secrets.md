# Secret Redaction

Opsy automatically detects and redacts secrets to prevent accidental exposure to LLMs.

## How It Works

| Stage | What Happens |
|-------|--------------|
| User Input | Secrets in prompts redacted before reaching LLM |
| Tool Execution | Placeholders restored to real values |
| Tool Output | Secrets in output redacted before returning to LLM |
| Streaming | Real-time redaction of command output |

The LLM never sees your actual secrets - only placeholders like `[REDACTED_SECRET:aws-access-key-id:x7f2k9]`.

## Supported Secrets

| Type | Example |
|------|---------|
| AWS Access Key | `AKIAIOSFODNN7EXAMPLE` |
| AWS Secret Key | `wJalrXUtnFEMI/K7MDENG...` |
| GitHub PAT | `ghp_xxxx...`, `github_pat_xxxx...` |
| OpenAI Key | `sk-xxxx...T3BlbkFJ...` |
| Anthropic Key | `sk-ant-xxxx...` |
| GCP API Key | `AIzaxxxx...` |
| Slack Token | `xoxb-xxxx...` |
| Stripe Key | `sk_live_xxxx...` |
| Private Keys | `-----BEGIN PRIVATE KEY-----` |
| JWT | `eyJxxxx.eyJxxxx.xxxx` |
| Database URLs | `postgres://user:pass@host` |

Plus 20+ more patterns including generic API keys and secrets.

## Configuration

In `~/.opsy/opsy.jsonc`:

```jsonc
{
  "secret": {
    "enabled": true,
    "excludePatterns": ["jwt", "generic-api-key"],
    "customPatterns": [
      {
        "id": "my-internal-key",
        "description": "Internal API Key",
        "pattern": "INTERNAL_[A-Z0-9]{32}",
        "keywords": ["INTERNAL_"],
        "entropyMin": 3.5
      }
    ]
  }
}
```

| Option | Default | Description |
|--------|---------|-------------|
| `enabled` | `true` | Enable/disable secret redaction |
| `excludePatterns` | `[]` | Pattern IDs to skip |
| `customPatterns` | `[]` | Additional patterns to detect |

### Custom Pattern Fields

| Field | Required | Description |
|-------|----------|-------------|
| `id` | Yes | Unique identifier |
| `description` | Yes | Human-readable description |
| `pattern` | Yes | Regex pattern (as string) |
| `keywords` | No | Pre-filter keywords for performance |
| `entropyMin` | No | Minimum Shannon entropy threshold |

## Disable

```jsonc
{
  "secret": {
    "enabled": false
  }
}
```
