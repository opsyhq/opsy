# AWS Tool

Opsy has a dedicated AWS tool that provides context-aware AWS CLI execution with automatic profile and region injection.

## Setup

1. Install [AWS CLI](https://aws.amazon.com/cli/)
2. Configure profiles in `~/.aws/credentials` or `~/.aws/config`

## Select Profile

In opsy, type `/aws` to select your AWS profile and region. Opsy will auto-inject `AWS_PROFILE` and `AWS_REGION` for all commands.

## Usage

Run `opsy` to start interactive mode, then ask:

```
> list my EC2 instances
> show S3 buckets in us-east-1
> describe my RDS databases
```

## Auto-Approval

Read-only commands are auto-approved:
- `list`, `describe`, `get`, `head`
- `search`, `query`, `scan`
- `validate`, `check`, `test`

Modifying commands require approval:
- `create`, `put`, `run`, `start`
- `update`, `modify`, `attach`
- `delete`, `terminate`, `remove`

## Configuration

In your opsy config (`~/.opsy/opsy.jsonc`):

```jsonc
{
  "permission": {
    "aws": {
      "*": "ask",
      "* describe*": "allow",
      "* list*": "allow"
    }
  }
}
```

## Region Selection

After selecting a profile, you can also select a region from the cloud context menu. The region will be auto-injected via `AWS_REGION`.
