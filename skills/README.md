# Opsy Skills

Pre-built instruction sets that extend opsy with specialized capabilities. Each skill teaches opsy how to perform specific DevOps tasks.

## Available Skills

| Skill | Description |
|-------|-------------|
| [aws-wtf](./aws-wtf/) | Explains every charge on your AWS bill — what it is, why you're paying, and what resource caused it |
| [aws-finops](./aws-finops/) | Analyzes AWS costs to find waste, optimize spending, and identify savings opportunities |

## Installation

Install skills using the add-skill CLI:

```bash
npx add-skill opsyhq/opsy --skill aws-wtf
npx add-skill opsyhq/opsy --skill aws-finops
```

Or manually add to your opsy config (`~/.opsy/opsy.jsonc` or `.opsy/opsy.jsonc`):

```json
{
  "instructions": [
    "https://raw.githubusercontent.com/opsyhq/opsy-cli/main/skills/aws-wtf/SKILL.md",
    "https://raw.githubusercontent.com/opsyhq/opsy-cli/main/skills/aws-finops/SKILL.md"
  ]
}
```

## Creating Custom Skills

Skills are markdown files with instructions. Create your own by:

1. Create a directory with a `SKILL.md` file
2. Add it to your config's `instructions` array
3. Reference by local path or URL

Example custom skill structure:

```markdown
# My Custom Skill

## When to Use
Describe when this skill should be triggered.

## Instructions
Step-by-step instructions for opsy to follow.

## Output
What the skill produces (reports, files, etc.).
```
