# Opsy

Infrastructure management for AI agents. Define stacks in YAML, deploy through Pulumi, manage everything through an agent-friendly CLI and API.

## Install

```bash
npm install -g @opsyhq/opsy
```

## Quick start

```bash
opsy auth login --token <pat>
opsy workspace list
opsy stack list --workspace <slug>
```

## Commands

```
AUTH
  auth login         Authenticate with a personal access token
  auth whoami        Show the authenticated user
  auth logout        Remove stored credentials

WORKSPACES
  workspace list     List all workspaces
  workspace get      Show workspace details
  workspace create   Create a new workspace
  workspace delete   Delete a workspace

STACKS
  stack list         List stacks in a workspace
  stack get          Show stack details and deployments
  stack create       Create a new stack
  stack set-notes    Set or clear stack notes
  stack delete       Delete a stack
  stack state        Show deployed stack state

ENVIRONMENTS
  env list           List environments in a workspace
  env create         Create a new environment
  env delete         Delete an environment
  env config-get     Show environment config
  env config-set     Set environment config

DRAFTS
  draft list         List drafts for a stack
  draft get          Show draft details and spec
  draft create       Create a new draft
  draft write        Write YAML spec to a draft
  draft edit         Edit a draft with string replacement
  draft validate     Validate a draft
  draft delete       Delete a draft

REVISIONS
  revision list      List revisions for a stack
  revision get       Show revision details and spec
  revision delete    Delete a revision

RUNS
  run get            Show run details
  run list           List runs for a workspace
  run apply          Queue an apply run
  run wait           Wait for a run to finish
  run import         Import existing resources
  run cancel         Cancel a run

ORG
  org list           List org variables
  org set            Set an org variable
  org delete         Delete an org variable
  org get-notes      Show org notes
  org set-notes      Set or clear org notes
```

All commands support `--json` for machine-readable output and `--quiet` for minimal output.

## Links

- [opsy.sh](https://opsy.sh)
- [GitHub](https://github.com/opsyhq/opsy)
