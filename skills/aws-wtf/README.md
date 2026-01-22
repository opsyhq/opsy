# AWS WTF Skill

Explains every charge on your AWS bill — what it is, why you're paying, and what resource caused it.

Automatically generates a CSV report with every charge linked to a specific resource ARN, detects credit coverage, and enumerates resources across all regions.

![Usage Example](./usage.png)

## Installation

**Prerequisites:** [Install opsy first](../../README.md#installation)

**Add the skill:**

```bash
npx add-skill opsyhq/opsy --skill aws-wtf
```

> **Note:** When prompted, choose to install under `claude/opencode` or `all agents`. Opsy will automatically pick it up.

Or manually add to `~/.opsy/opsy.jsonc`:

```json
{
  "instructions": [
    "https://raw.githubusercontent.com/opsyhq/opsy-cli/main/skills/aws-wtf/SKILL.md"
  ]
}
```

## Usage

```bash
opsy
> /connect    # Connect with Claude/OpenAI
> /aws        # Select AWS account
> wtf is my aws bill
```

Opsy automatically generates `aws-wtf-{account-id}-{date}.csv` with full charge breakdown.
