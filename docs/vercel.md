# Vercel Tool

Opsy has a dedicated Vercel CLI tool with team and project context awareness.

## Setup

1. Install Vercel CLI: `npm i -g vercel`
2. Authenticate: `vercel login`

## Select Team & Project

In opsy, type `/vercel` to select your Vercel team and project. Opsy will auto-inject `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID`.

## Usage

Run `opsy` to start interactive mode, then ask:

```
> list my vercel deployments
> show environment variables
> deploy to production
> rollback to the previous deployment
```

## Command Types

Opsy classifies commands by type:
- **read** - `list`, `inspect`, `env pull` (auto-approve)
- **create** - `deploy`, `env add`
- **update** - `env`, `alias`
- **delete** - `remove`, `env rm`

## Configuration

```jsonc
{
  "permission": {
    "vercel": {
      "*": "ask"
    }
  }
}
```

## Common Workflows

```
> deploy this project to vercel
> show production environment variables
> add a new env var API_KEY
> rollback to the previous production deployment
> show details of the latest deployment
```
