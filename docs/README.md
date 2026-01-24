# Opsy Documentation

## Tools

Opsy has dedicated tools for DevOps workflows with context awareness and safety guardrails.

| Tool | Description | Context |
|------|-------------|---------|
| [AWS](./aws.md) | AWS CLI with profile/region injection | AWS Profile + Region |
| [Terraform](./terraform.md) | Plan-before-apply workflow with state backups | Auto-detected project |
| [Kubernetes](./kubernetes.md) | kubectl with context injection | Kubernetes Context |
| [Helm](./helm.md) | Chart operations with context injection | Kubernetes Context |
| [GitHub](./github.md) | GitHub CLI with repo injection | GitHub Repository |
| [Vercel](./vercel.md) | Vercel CLI with team/project injection | Vercel Team + Project |

## Cloud Context

Use slash commands to select your cloud context:

| Command | Selects |
|---------|---------|
| `/aws` | AWS profile and region |
| `/kubernetes` or `/k8s` | Kubernetes context |
| `/github` | GitHub repository |
| `/vercel` | Vercel team and project |

Selected context is auto-injected into all relevant commands.

## Permission System

Commands are classified by danger level:

| Level | Examples | Default |
|-------|----------|---------|
| Read | `describe`, `list`, `get` | Auto-approve |
| Create | `create`, `put`, `apply` | Ask |
| Modify | `update`, `scale`, `patch` | Ask |
| Delete | `delete`, `terminate`, `destroy` | Ask |

Configure in `~/.opsy/opsy.jsonc`:

```jsonc
{
  "permission": {
    "aws": {
      "*": "ask",
      "* describe*": "allow"
    }
  }
}
```

## Security

| Feature | Description |
|---------|-------------|
| [Secret Redaction](./secrets.md) | Auto-detects and redacts API keys, tokens, passwords |

## More Documentation

For comprehensive documentation on configuration, agents, MCP servers, and more, see the [OpenCode docs](https://opencode.ai/docs/).

Opsy is built on OpenCode and shares the same configuration format.
