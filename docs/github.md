# GitHub Tool

Opsy has a dedicated GitHub CLI tool with repository context awareness.

## Setup

1. Install [GitHub CLI](https://cli.github.com/)
2. Authenticate: `gh auth login`

## Select Repository

In opsy, type `/github` to select your GitHub repository. Opsy will auto-inject `--repo` for all commands.

## Usage

Run `opsy` to start interactive mode, then ask:

```
> list open PRs
> show issues labeled as bugs
> create a PR for this branch
> check the status of CI workflows
```

## Command Types

Opsy classifies commands by type:
- **read** - `list`, `view`, `status` (auto-approve)
- **create** - `create`, `fork`, `clone`
- **update** - `edit`, `merge`, `review`
- **delete** - `delete`, `close`

## Configuration

```jsonc
{
  "permission": {
    "gh": {
      "*": "ask"
    }
  }
}
```

## Common Workflows

```
> show me open pull requests
> create a PR from this branch to main
> what's the status of the CI for the latest commit
> show me the diff for PR #123
```
