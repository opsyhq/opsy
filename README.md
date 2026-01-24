# Opsy

**CLI DevOps Agent with guardrails.**

AI-powered infrastructure management from the command line. Opsy understands your AWS, Terraform, and Kubernetes context - and won't destroy prod.

![Opsy Demo](demos/opsy-demo.gif)

## Installation

```bash
curl -fsSL https://opsy.sh/install.sh | bash
```

## Quick Start

```bash
opsy
```

### Connecting to an LLM provider

Supports 75+ LLM providers. connects with existing Claude or OpenAI subscriptions.

```bash
/connect
```

### Selecting a cloud context

```bash
/aws
```
### Asking a question

```bash
why can't i reach my load balancer?
```

## Features

- **Full Plan Visibility** - See exactly what will happen before execution
- **Context Aware** - Auto-detects AWS account, region, Terraform workspace
- **Danger Classification** - Color-coded commands (read, update, delete, destroy)
- **Live Streaming** - Real-time output, no truncation
- **Audit Logging** - Full trail of every operation
- **[Secret Redaction](./docs/secrets.md)** - Auto-detects and redacts API keys, tokens, passwords
- **Run Recording** - Shareable recordings for review

## Documentation

| Tool | Guide |
|------|-------|
| AWS | [docs/aws.md](./docs/aws.md) - Profile/region context |
| Terraform | [docs/terraform.md](./docs/terraform.md) - Plan-before-apply, state backups |
| Kubernetes | [docs/kubernetes.md](./docs/kubernetes.md) - Context injection |
| Helm | [docs/helm.md](./docs/helm.md) - Chart operations |
| GitHub | [docs/github.md](./docs/github.md) - Repo context |
| Vercel | [docs/vercel.md](./docs/vercel.md) - Team/project context |

## Examples

| Type | Description |
|------|-------------|
| [Configs](./examples/configs/) | Ready-to-use opsy configurations |
| [Runbooks](./examples/runbooks/) | Step-by-step guides opsy can follow |
| [AGENTS.md](./examples/agents/) | Project templates for Terraform, K8s, monorepos |
| [Demos](./demos/) | Terraform demo projects and recordings |

## Skills

Skills teach opsy best practices for each tool. Add to `~/.opsy/opsy.jsonc`:

```json
{
  "instructions": [
    "https://raw.githubusercontent.com/opsyhq/opsy-cli/main/skills/aws-wtf/SKILL.md",
    "https://raw.githubusercontent.com/opsyhq/opsy-cli/main/skills/aws-finops/SKILL.md"
  ]
}
```

**Or use npx to add skills:**
```bash
npx add-skill opsyhq/opsy --skill aws-wtf    # AWS bill breakdown
npx add-skill opsyhq/opsy --skill aws-finops # Cost optimization
```

See [skills/](./skills/) for all available skills.

## Supported Providers

Opsy supports multiple LLM providers:
- Anthropic (Claude)
- OpenAI
- Azure OpenAI
- Google Vertex AI
- Amazon Bedrock
- Groq, Mistral, Cohere, and more

## Acknowledgements

Opsy is built on [OpenCode](https://opencode.ai), an open-source AI coding agent. Huge thanks to the OpenCode team for their work.

- [OpenCode GitHub](https://github.com/opencode-ai/opencode)
- [OpenCode Documentation](https://opencode.ai/docs/)

