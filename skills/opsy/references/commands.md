# CLI Commands

## Auth

```
opsy auth login --token <pat> [--api-url <url>]
opsy auth whoami
opsy auth logout
```

Environment variables: `OPSY_TOKEN`, `OPSY_API_URL`

## Workspaces

```
opsy workspace list
opsy workspace get    <slug>
opsy workspace create --slug <slug> --name <name>
opsy workspace delete <slug>
```

## Stacks

```
opsy stack list       --workspace <slug>
opsy stack get        <slug> --workspace <slug>
opsy stack create     --workspace <slug> --slug <slug> [--yaml <yaml>]
opsy stack set-notes  --workspace <slug> --stack <slug> [--notes <text> | --file <path> | stdin | --clear]
opsy stack delete     <slug> --workspace <slug>
opsy stack state      <slug> --workspace <slug>
```

## Environments

```
opsy env list         --workspace <slug>
opsy env create       --workspace <slug> --slug <slug>
opsy env delete       --workspace <slug> --env <slug>
opsy env config-get   --workspace <slug> --env <slug>
opsy env config-set   --workspace <slug> --env <slug> [--config <json> | --file <path> | stdin]
```

## Drafts

```
opsy draft list    --workspace <slug> --stack <slug>
opsy draft get     <draft-short-id>
opsy draft create  --workspace <slug> --stack <slug> [--name <name>]
opsy draft write   [draft-short-id] [--workspace <slug> --stack <slug>] [--yaml <yaml> | --file <path> | stdin]
opsy draft edit    [draft-short-id] [--workspace <slug> --stack <slug>] --old-string <text> --new-string <text>
opsy draft validate <draft-short-id>
opsy draft delete  <draft-short-id>
```

## Revisions

```
opsy revision list   --workspace <slug> --stack <slug>
opsy revision get    [revision-number] --workspace <slug> --stack <slug>
opsy revision delete <revision-number> --workspace <slug> --stack <slug>
```

## Runs

```
opsy run apply   --workspace <slug> --stack <slug> --env <slug> [--draft <short-id> | --revision <n>] [--preview-only] [--reason <text>]
opsy run wait    <run-id|short-id> [--timeout-seconds <n>]
opsy run get     <run-id|short-id>
opsy run list    --workspace <slug> [--stack <slug>] [--status <status>] [--exclude-status <status>]
opsy run import  --workspace <slug> --stack <slug> [--env <slug>] [--targets <json> | --file <path> | stdin] [--reason <text>]
opsy run cancel  <run-id|short-id> [--force]
```

## Org

```
opsy org list
opsy org set       <key> [--value <text> | --file <path> | stdin] [--sensitive]
opsy org delete    <key>
opsy org get-notes
opsy org set-notes [--notes <text> | --file <path> | stdin | --clear]
```

All commands support `--json` and `--quiet` flags.
