# Opsy Skills

Pre-built instruction sets for DevOps tools. These skills teach opsy best practices and safety rules for each tool.

## Available Skills

| Skill | Description |
|-------|-------------|
| [terraform.md](./terraform.md) | Terraform operations with plan-before-apply safety |
| [aws.md](./aws.md) | AWS CLI with account/region awareness |
| [kubectl.md](./kubectl.md) | Kubernetes operations with context safety |
| [helm.md](./helm.md) | Helm chart management with dry-run practices |

## Installation

Add skills to your opsy config (`~/.opsy/opsy.jsonc` or `.opsy/opsy.jsonc`):

```json
{
  "instructions": [
    "https://raw.githubusercontent.com/opsyhq/opsy-cli/main/skills/terraform.md",
    "https://raw.githubusercontent.com/opsyhq/opsy-cli/main/skills/aws.md",
    "https://raw.githubusercontent.com/opsyhq/opsy-cli/main/skills/kubectl.md",
    "https://raw.githubusercontent.com/opsyhq/opsy-cli/main/skills/helm.md"
  ]
}
```

Or download locally and reference by path:

```json
{
  "instructions": [
    "~/.opsy/skills/terraform.md",
    "~/.opsy/skills/aws.md"
  ]
}
```

## What Skills Provide

Each skill includes:

- **Safety Rules** - What to check before operations
- **Command Classification** - Safe, caution, and dangerous operations
- **Best Practices** - Recommended workflows
- **Common Workflows** - Step-by-step examples

## Creating Custom Skills

Skills are just markdown files. Create your own by:

1. Create a `.md` file with instructions
2. Add it to your config's `instructions` array
3. Reference by local path or URL

Example custom skill structure:

```markdown
# My Custom Tool Skills

## Safety Rules
1. Always check X before Y
2. Never do Z without confirmation

## Command Classification
### Safe Operations
- command1
- command2

### Dangerous Operations
- dangerous-command

## Best Practices
...
```
