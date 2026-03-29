# Opsy CLI

Opsy is an agent-friendly infrastructure control plane. The `opsy` CLI exposes the same operator surface that Opsy MCP uses: explicit projects, resources, and changes.

## Install

```bash
npm install -g @opsyhq/opsy
```

## Zero-Start Flow

Start from clean discovery. Do not assume a remembered target.

```bash
opsy auth login --token <pat>
opsy project list
opsy resource list --project <project-slug>
opsy resource get <resource-slug> --project <project-slug>
```

`resource list` returns root resources first. Add `--parent <slug>` to walk down the tree.

Use `--parent <slug>` on `resource create` and `resource update` to organize resources under another resource. In change mutation JSON, use `"parent":"<slug>"`. If you want a folder-like container with no cloud object, create a virtual `group` resource first and then parent resources under it.

## Mutation Paths

Use a draft change when the work should be reviewable or span multiple mutations:

```bash
opsy change create --project <project-slug> --summary "Create base network"
opsy change append <shortId> --mutations '[...]'
opsy change preview <shortId>
opsy change apply <shortId>
```

Example with a virtual group and explicit parenting:

```bash
opsy change create --project <project-slug> --summary "Create grouped network" \
  --mutations '[{"kind":"create","slug":"network","type":"group"},{"kind":"create","slug":"vpc","type":"aws:ec2/vpc:Vpc","parent":"network","inputs":{"cidrBlock":"10.0.0.0/16"}}]'
```

Use one-off resource mutations when you want a single mutation with an immediate preview. Pass `--auto-apply` when you want the convenience command to continue into apply:

```bash
opsy resource create --project <project-slug> --slug vpc --type aws:ec2/vpc:Vpc --inputs '{"cidrBlock":"10.0.0.0/16"}'
opsy resource update <resource-slug> --project <project-slug> --inputs '{"key":"value"}'
opsy resource delete <resource-slug> --project <project-slug>
opsy resource create --project <project-slug> --slug vpc --type aws:ec2/vpc:Vpc --inputs '{"cidrBlock":"10.0.0.0/16"}' --auto-apply
```

For reparenting, use:

```bash
opsy resource update <resource-slug> --project <project-slug> --parent <new-parent-slug> --inputs '{}'
```

## Help

Use the product surface itself as the guide:

```bash
opsy --help
opsy project list --help
opsy change create --help
```

## Authentication

The CLI accepts a personal access token through:

- `opsy auth login --token <pat>`
- `--token <pat>`
- `OPSY_TOKEN`

The API base URL can be configured with `--api-url` or `OPSY_API_URL`. The default is `https://api.opsy.sh`.

## Skill

The `skills/opsy` directory in the public mirror is installable in agent clients that support local skills. It documents when to use Opsy over MCP or CLI flows.

## Links

- [Opsy](https://opsy.sh)
