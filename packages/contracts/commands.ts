import {
  OBSERVE_PROVIDERS,
  findObserveCommandHelp,
  renderObserveProviderHelp,
  renderObserveSupportedProviders,
} from "./observe";

export type CommandFlagSpec = {
  name: string;
  value?: string;
  required?: boolean;
  description: string;
};

export type CommandSpec = {
  id: string;
  path: string[];
  usage: string;
  summary: string;
  flags?: CommandFlagSpec[];
  examples?: string[];
  notes?: string[];
  whenToUse?: string[];
  nextSteps?: string[];
};

function flags(...entries: CommandFlagSpec[]): CommandFlagSpec[] {
  return entries;
}

function command(
  spec: CommandSpec,
): CommandSpec {
  return spec;
}

export const OPSY_DISCOVERY_PROVIDERS = [
  { id: "aws", label: "AWS" },
  { id: "cloudflare", label: "Cloudflare" },
] as const;

export function getUnsupportedDiscoveryProviderMessage(provider: string): string {
  return `Discovery is not implemented for "${provider}". Use manual import.`;
}

export const OPSY_COMMAND_SPECS: CommandSpec[] = [
  command({
    id: "workspace.list",
    path: ["workspace", "list"],
    usage: "opsy workspace list",
    summary: "List workspaces you can target.",
    examples: [
      "opsy workspace list",
    ],
    whenToUse: [
      "Start here on a fresh install or fresh MCP session when you do not know any workspace slugs yet.",
    ],
    nextSteps: [
      "Run `opsy environment list --workspace <slug>` with one returned workspace slug.",
    ],
  }),
  command({
    id: "workspace.get",
    path: ["workspace", "get"],
    usage: "opsy workspace get <slug>",
    summary: "Get one workspace by slug.",
    examples: [
      "opsy workspace get acme",
    ],
    whenToUse: [
      "Use this when you already know the workspace slug and want to confirm its details before targeting environments inside it.",
    ],
    nextSteps: [
      "Run `opsy environment list --workspace <slug>` to discover environments in that workspace.",
    ],
  }),
  command({
    id: "workspace.create",
    path: ["workspace", "create"],
    usage: "opsy workspace create --slug <slug> --name <name>",
    summary: "Create a new workspace.",
    flags: flags(
      { name: "slug", value: "<slug>", required: true, description: "Workspace slug." },
      { name: "name", value: "<name>", required: true, description: "Workspace display name." },
    ),
    examples: [
      'opsy workspace create --slug acme --name "Acme Production"',
    ],
    whenToUse: [
      "Use this only when you need a brand new top-level workspace, not when you are trying to discover an existing one.",
    ],
    nextSteps: [
      "Run `opsy environment create --workspace <slug> --slug <env-slug>` or `opsy environment list --workspace <slug>`.",
    ],
  }),
  command({
    id: "environment.list",
    path: ["environment", "list"],
    usage: "opsy environment list --workspace <workspace>",
    summary: "List environments inside one workspace.",
    flags: flags(
      { name: "workspace", value: "<workspace>", required: true, description: "Workspace slug." },
    ),
    examples: [
      "opsy environment list --workspace acme",
    ],
    whenToUse: [
      "Use this right after `workspace list` to discover valid environment slugs for one workspace.",
    ],
    nextSteps: [
      "Run `opsy resource list --workspace <slug> --env <slug>` with one returned environment slug.",
    ],
  }),
  command({
    id: "environment.get",
    path: ["environment", "get"],
    usage: "opsy environment get <slug> --workspace <workspace>",
    summary: "Get one environment.",
    flags: flags(
      { name: "workspace", value: "<workspace>", required: true, description: "Workspace slug." },
    ),
    examples: [
      "opsy environment get prod --workspace acme",
    ],
    whenToUse: [
      "Use this when you already know an environment slug and want its summary before listing or mutating resources inside it.",
    ],
    nextSteps: [
      "Run `opsy resource list --workspace <slug> --env <slug>` to inspect root resources.",
    ],
  }),
  command({
    id: "environment.create",
    path: ["environment", "create"],
    usage: "opsy environment create --workspace <workspace> --slug <slug>",
    summary: "Create an environment inside a workspace.",
    flags: flags(
      { name: "workspace", value: "<workspace>", required: true, description: "Workspace slug." },
      { name: "slug", value: "<slug>", required: true, description: "Environment slug." },
    ),
    examples: [
      "opsy environment create --workspace acme --slug prod",
    ],
    whenToUse: [
      "Use this when the workspace already exists and you need a new target environment inside it.",
    ],
    nextSteps: [
      "Run `opsy resource list --workspace <slug> --env <slug>` after the environment exists.",
    ],
  }),
  command({
    id: "resource.list",
    path: ["resource", "list"],
    usage: "opsy resource list --workspace <workspace> --env <env> [--parent <slug>] [--detailed]",
    summary: "List resources in an environment. With no `--parent`, Opsy returns root resources first.",
    flags: flags(
      { name: "workspace", value: "<workspace>", required: true, description: "Workspace slug." },
      { name: "env", value: "<env>", required: true, description: "Environment slug." },
      { name: "parent", value: "<slug>", description: "List only the children under one resource slug." },
      { name: "detailed", description: "Return full resource records instead of compact list rows." },
    ),
    examples: [
      "opsy resource list --workspace acme --env prod",
      "opsy resource list --workspace acme --env prod --parent network",
    ],
    whenToUse: [
      "Use this as the default read-first entry point before `resource get`, `change create`, or one-off resource mutations.",
      "Traverse the tree top-down: roots first, then add `--parent <slug>` when you want to drill into children.",
    ],
    nextSteps: [
      "Run `opsy resource get <slug> --workspace <slug> --env <slug>` for one returned resource.",
      "Use `--parent <slug>` with one returned root slug to keep traversing the tree.",
    ],
  }),
  command({
    id: "resource.get",
    path: ["resource", "get"],
    usage: "opsy resource get <slug> --workspace <workspace> --env <env> [--live]",
    summary: "Get one resource.",
    flags: flags(
      { name: "workspace", value: "<workspace>", required: true, description: "Workspace slug." },
      { name: "env", value: "<env>", required: true, description: "Environment slug." },
      { name: "live", description: "Include live cloud state comparison." },
    ),
    examples: [
      "opsy resource get vpc --workspace acme --env prod",
      "opsy resource get vpc --workspace acme --env prod --live",
    ],
    whenToUse: [
      "Use this after `resource list` when you need the full desired state, status, and optionally live state for one resource.",
    ],
    nextSteps: [
      "Choose a mutation path: `opsy change create --workspace <slug> --env <slug>` for a draft, or `opsy resource update <slug> --workspace <slug> --env <slug> --inputs <json>` for a one-off mutation.",
    ],
  }),
  command({
    id: "resource.create",
    path: ["resource", "create"],
    usage: "opsy resource create --workspace <workspace> --env <env> --slug <slug> --type <type> --inputs <json> [--parent <slug>] [--summary <text>]",
    summary: "Create one resource by proposing a single mutation and immediately attempting apply.",
    flags: flags(
      { name: "workspace", value: "<workspace>", required: true, description: "Workspace slug." },
      { name: "env", value: "<env>", required: true, description: "Environment slug." },
      { name: "slug", value: "<slug>", required: true, description: "Resource slug." },
      { name: "type", value: "<type>", required: true, description: "Pulumi resource token." },
      { name: "inputs", value: "<json>", required: true, description: "Resource inputs JSON object." },
      { name: "parent", value: "<slug>", description: "Optional parent resource slug." },
      { name: "summary", value: "<text>", description: "Optional change summary." },
    ),
    examples: [
      `opsy resource create --workspace acme --env prod --slug vpc --type aws:ec2/vpc:Vpc --inputs '{"cidrBlock":"10.0.0.0/16"}'`,
      `opsy resource create --workspace acme --env prod --slug site-zone --type cloudflare:index/zone:Zone --inputs '{"account":{"id":"<account-id>"},"zone":"example.com"}'`,
    ],
    whenToUse: [
      "Use this for a one-off resource creation when you do not need to stage multiple mutations in a draft first.",
    ],
    nextSteps: [
      "Inspect the returned change or approval result. If you need a staged workflow instead, start with `opsy change create --workspace <slug> --env <slug>`.",
    ],
  }),
  command({
    id: "resource.update",
    path: ["resource", "update"],
    usage: "opsy resource update <slug> --workspace <workspace> --env <env> --inputs <json> [--remove-input-paths <json>] [--parent <slug>] [--version <n>] [--summary <text>]",
    summary: "Update one resource by proposing a single mutation and immediately attempting apply.",
    flags: flags(
      { name: "workspace", value: "<workspace>", required: true, description: "Workspace slug." },
      { name: "env", value: "<env>", required: true, description: "Environment slug." },
      { name: "inputs", value: "<json>", required: true, description: "Inputs JSON object." },
      { name: "remove-input-paths", value: "<json>", description: "JSON array of nested input paths to remove." },
      { name: "parent", value: "<slug>", description: "Move the resource under a different parent slug." },
      { name: "version", value: "<n>", description: "Optimistic-lock version." },
      { name: "summary", value: "<text>", description: "Optional change summary." },
    ),
    examples: [
      `opsy resource update vpc --workspace acme --env prod --inputs '{"enableDnsHostnames":true}'`,
    ],
    whenToUse: [
      "Use this for a single direct edit after you have already inspected the resource with `resource get`.",
    ],
    nextSteps: [
      "Inspect the returned change or approval result. Use `opsy change create --workspace <slug> --env <slug>` instead when you want a reviewable draft with multiple steps.",
    ],
  }),
  command({
    id: "resource.delete",
    path: ["resource", "delete"],
    usage: "opsy resource delete <slug> --workspace <workspace> --env <env> [--recursive]",
    summary: "Delete one resource by proposing a single mutation and immediately attempting apply.",
    flags: flags(
      { name: "workspace", value: "<workspace>", required: true, description: "Workspace slug." },
      { name: "env", value: "<env>", required: true, description: "Environment slug." },
      { name: "recursive", description: "Delete descendants too." },
    ),
    examples: [
      "opsy resource delete old-bucket --workspace acme --env prod",
    ],
    whenToUse: [
      "Use this for a one-off deletion after you have confirmed the target resource and scope.",
    ],
    nextSteps: [
      "Inspect the returned change or approval result. Use `opsy change create --workspace <slug> --env <slug>` if this delete belongs in a larger staged change.",
    ],
  }),
  command({
    id: "resource.diff",
    path: ["resource", "diff"],
    usage: "opsy resource diff <slug> --workspace <workspace> --env <env>",
    summary: "Compare stored and live resource state.",
  }),
  command({
    id: "resource.refresh",
    path: ["resource", "refresh"],
    usage: "opsy resource refresh <slug> --workspace <workspace> --env <env>",
    summary: "Refresh a resource from cloud and recompute conflict state.",
  }),
  command({
    id: "resource.accept-live",
    path: ["resource", "accept-live"],
    usage: "opsy resource accept-live <slug> --workspace <workspace> --env <env>",
    summary: "Accept recorded live state into desired inputs.",
  }),
  command({
    id: "resource.reconcile",
    path: ["resource", "reconcile"],
    usage: "opsy resource reconcile <slug> --workspace <workspace> --env <env>",
    summary: "Promote desired state back to cloud through a change.",
  }),
  command({
    id: "resource.restore",
    path: ["resource", "restore"],
    usage: "opsy resource restore <slug> --workspace <workspace> --env <env> --operation <operationId>",
    summary: "Restore a resource to the state captured before an operation.",
  }),
  command({
    id: "resource.history",
    path: ["resource", "history"],
    usage: "opsy resource history <slug> --workspace <workspace> --env <env>",
    summary: "List operation history for one resource.",
  }),
  command({
    id: "change.list",
    path: ["change", "list"],
    usage: "opsy change list --workspace <workspace> --env <env>",
    summary: "List recent changes in one environment.",
    flags: flags(
      { name: "workspace", value: "<workspace>", required: true, description: "Workspace slug." },
      { name: "env", value: "<env>", required: true, description: "Environment slug." },
    ),
    examples: [
      "opsy change list --workspace acme --env prod",
    ],
    whenToUse: [
      "Use this when you need an existing change shortId for `change get`, `change preview`, `change append`, or `change apply`.",
    ],
    nextSteps: [
      "Run `opsy change get <shortId>` for details on one returned change.",
    ],
  }),
  command({
    id: "change.get",
    path: ["change", "get"],
    usage: "opsy change get <shortId>",
    summary: "Get one change with operations.",
    examples: [
      "opsy change get abcd1234",
    ],
    whenToUse: [
      "Use this after `change list` or after a create/apply response gives you a shortId.",
    ],
    nextSteps: [
      "Run `opsy change preview <shortId>` to inspect execution details, or `opsy change apply <shortId>` to execute it.",
    ],
  }),
  command({
    id: "change.create",
    path: ["change", "create"],
    usage: "opsy change create --workspace <workspace> --env <env> [--mutations <json>] [--summary <text>]",
    summary: "Create a draft change, optionally seeded with mutations.",
    flags: flags(
      { name: "workspace", value: "<workspace>", required: true, description: "Workspace slug." },
      { name: "env", value: "<env>", required: true, description: "Environment slug." },
      { name: "mutations", value: "<json>", description: "JSON array of mutations to seed the draft." },
      { name: "summary", value: "<text>", description: "Optional human summary for the change." },
    ),
    examples: [
      'opsy change create --workspace acme --env prod --summary "Create base network"',
      `opsy change create --workspace acme --env prod --mutations '[{"kind":"create","slug":"network","type":"group"},{"kind":"create","slug":"vpc","type":"aws:ec2/vpc:Vpc","parent":"network","inputs":{"cidrBlock":"10.0.0.0/16"}}]' --summary "Create grouped network"`,
      `opsy change create --workspace acme --env prod --mutations '[{"kind":"update","slug":"subnet-a","parent":"vpc-b","inputs":{}}]' --summary "Move subnet under new parent"`,
      `opsy change create --workspace acme --env prod --mutations '[{"kind":"update","slug":"policy","dependsOn":["public-access-block"],"inputs":{}}]' --summary "Make policy wait for public access block"`,
    ],
    whenToUse: [
      "Use this when you want a reviewable draft before applying mutations, especially when the work spans multiple resources.",
    ],
    notes: [
      'Every mutation object must include `"kind"` (for example `"create"` or `"update"`).',
      'In mutation JSON, use `"parent":"<slug>"` to organize resources under another resource.',
      'Use `"dependsOn":["<slug>"]` in mutation JSON for explicit dependency ordering when no input ref expresses the dependency.',
      'If you want a folder-like container with no cloud object, create a virtual resource with `type:"group"` first, then parent resources under it.',
    ],
    nextSteps: [
      "Run `opsy change append <shortId> --mutations <json>` to add more work.",
      "Run `opsy change preview <shortId>` to inspect the plan.",
      "Run `opsy change apply <shortId>` when the draft is ready.",
    ],
  }),
  command({
    id: "change.append",
    path: ["change", "append"],
    usage: "opsy change append <shortId> --mutations <json> [--summary <text>]",
    summary: "Append mutations to an existing open change.",
    flags: flags(
      { name: "mutations", value: "<json>", required: true, description: "JSON array of mutations to append." },
      { name: "summary", value: "<text>", description: "Optional summary override." },
    ),
    examples: [
      `opsy change append abcd1234 --mutations '[{"kind":"update","slug":"vpc","inputs":{"enableDnsHostnames":true}}]'`,
      `opsy change append abcd1234 --mutations '[{"kind":"update","slug":"subnet-a","parent":"network","inputs":{}}]'`,
      `opsy change append abcd1234 --mutations '[{"kind":"update","slug":"policy","dependsOn":["public-access-block"],"inputs":{}}]'`,
    ],
    whenToUse: [
      "Use this after `change create` when you are building up a staged change in multiple steps.",
    ],
    notes: [
      'Every mutation object must include `"kind"` (for example `"create"` or `"update"`).',
      'Mutation JSON uses `"parent":"<slug>"` for reparenting.',
      'Mutation JSON uses `"dependsOn":["<slug>"]` for explicit dependency ordering when no input ref expresses the dependency.',
    ],
    nextSteps: [
      "Run `opsy change preview <shortId>` to inspect the updated draft.",
      "Run `opsy change apply <shortId>` when the change is ready.",
    ],
  }),
  command({
    id: "change.preview",
    path: ["change", "preview"],
    usage: "opsy change preview <shortId>",
    summary: "Preview a change.",
    examples: [
      "opsy change preview abcd1234",
    ],
    whenToUse: [
      "Use this before apply when you want to inspect the planned operations and dependencies.",
    ],
    nextSteps: [
      "Run `opsy change apply <shortId>` if the preview is acceptable.",
    ],
  }),
  command({
    id: "change.apply",
    path: ["change", "apply"],
    usage: "opsy change apply <shortId>",
    summary: "Apply a change.",
    examples: [
      "opsy change apply abcd1234",
    ],
    whenToUse: [
      "Use this after you have created or previewed a change and want Opsy to execute it.",
    ],
    notes: [
      "If approval is required, the apply does not complete through MCP. Ask a human to open the returned review URL in the Opsy web UI and approve it there.",
    ],
    nextSteps: [
      "If approval is required, stop and ask a human to open the returned review URL in the Opsy web UI and approve it there. Otherwise inspect the resulting change with `opsy change get <shortId>`.",
    ],
  }),
  command({
    id: "change.discard",
    path: ["change", "discard"],
    usage: "opsy change discard <shortId>",
    summary: "Discard a change.",
  }),
  command({
    id: "change.retry",
    path: ["change", "retry"],
    usage: "opsy change retry <shortId>",
    summary: "Retry a failed change.",
  }),
  command({
    id: "provider.list",
    path: ["provider", "list"],
    usage: "opsy provider list",
    summary: "List provider profiles.",
  }),
  command({
    id: "provider.get",
    path: ["provider", "get"],
    usage: "opsy provider get <id>",
    summary: "Get one provider profile.",
  }),
  command({
    id: "provider.create",
    path: ["provider", "create"],
    usage: "opsy provider create --provider <provider> --name <name> --config <json>",
    summary: "Create a provider profile.",
  }),
  command({
    id: "schema.list",
    path: ["schema", "list"],
    usage: "opsy schema list --provider <provider> [--query <text>]",
    summary: "List resource schemas for one provider.",
    flags: flags(
      { name: "provider", value: "<provider>", required: true, description: "Provider package, for example `aws` or `cloudflare`." },
      { name: "query", value: "<text>", description: "Optional filter on the resource token." },
    ),
    examples: [
      "opsy schema list --provider cloudflare --query zone",
      "opsy schema list --provider aws --query vpc",
    ],
    whenToUse: [
      "Use this only when you need help finding the exact type token before creating or updating a resource.",
    ],
    nextSteps: [
      "Run `opsy schema get <type-token>` only if field names or types are still unclear.",
    ],
  }),
  command({
    id: "schema.get",
    path: ["schema", "get"],
    usage: "opsy schema get <type-token>",
    summary: "Show compact field types for one resource schema.",
    examples: [
      "opsy schema get cloudflare:index/zone:Zone",
      "opsy schema get aws:ec2/vpc:Vpc",
    ],
    whenToUse: [
      "Use this after `schema list` only when field names, field types, or required references are uncertain.",
    ],
    nextSteps: [
      "Return to `opsy resource create ... --type <type-token>` or `opsy change create ... --mutations <json>` with the schema details in hand.",
    ],
  }),
  command({
    id: "discovery.aws.types",
    path: ["discovery", "aws", "types"],
    usage: "opsy discovery aws types --workspace <workspace> --env <env> [--query <text>]",
    summary: "List AWS discovery types.",
  }),
  command({
    id: "discovery.aws.list",
    path: ["discovery", "aws", "list"],
    usage: "opsy discovery aws list --workspace <workspace> --env <env> [--type <type>] [--region <region>]",
    summary: "List existing AWS resources.",
  }),
  command({
    id: "discovery.aws.inspect",
    path: ["discovery", "aws", "inspect"],
    usage: "opsy discovery aws inspect --workspace <workspace> --env <env> --cloud-id <id> --type <type>",
    summary: "Inspect one AWS resource.",
  }),
  command({
    id: "discovery.aws.import",
    path: ["discovery", "aws", "import"],
    usage: "opsy discovery aws import --workspace <workspace> --env <env> --items <json>",
    summary: "Import existing AWS resources into a change.",
  }),
  command({
    id: "discovery.cloudflare.types",
    path: ["discovery", "cloudflare", "types"],
    usage: "opsy discovery cloudflare types --workspace <workspace> --env <env> [--query <text>]",
    summary: "List Cloudflare discovery types.",
  }),
  command({
    id: "discovery.cloudflare.list",
    path: ["discovery", "cloudflare", "list"],
    usage: "opsy discovery cloudflare list --workspace <workspace> --env <env> [--type <type>] [--location <location>]",
    summary: "List existing Cloudflare resources.",
  }),
  command({
    id: "discovery.cloudflare.inspect",
    path: ["discovery", "cloudflare", "inspect"],
    usage: "opsy discovery cloudflare inspect --workspace <workspace> --env <env> --provider-id <id> --type <type>",
    summary: "Inspect one Cloudflare resource.",
  }),
  command({
    id: "discovery.cloudflare.import",
    path: ["discovery", "cloudflare", "import"],
    usage: "opsy discovery cloudflare import --workspace <workspace> --env <env> --items <json>",
    summary: "Import existing Cloudflare resources into a change.",
  }),
  command({
    id: "observability.aws.logs.groups",
    path: ["observability", "aws", "logs", "groups"],
    usage: "opsy observability aws logs groups --workspace <workspace> --env <env> [...]",
    summary: "List CloudWatch log groups.",
  }),
  command({
    id: "observability.aws.logs.tail",
    path: ["observability", "aws", "logs", "tail"],
    usage: "opsy observability aws logs tail --workspace <workspace> --env <env> --log-group <name> [...]",
    summary: "Tail CloudWatch log events.",
  }),
  command({
    id: "observability.aws.logs.events",
    path: ["observability", "aws", "logs", "events"],
    usage: "opsy observability aws logs events --workspace <workspace> --env <env> --log-group <name> [...]",
    summary: "List CloudWatch log events.",
  }),
  command({
    id: "observability.aws.logs.query",
    path: ["observability", "aws", "logs", "query"],
    usage: "opsy observability aws logs query --workspace <workspace> --env <env> --log-groups <csv> --query-string <query> [...]",
    summary: "Run a CloudWatch Logs Insights query.",
  }),
  command({
    id: "observability.aws.metrics.list",
    path: ["observability", "aws", "metrics", "list"],
    usage: "opsy observability aws metrics list --workspace <workspace> --env <env> [...]",
    summary: "List CloudWatch metrics.",
  }),
  command({
    id: "observability.aws.metrics.query",
    path: ["observability", "aws", "metrics", "query"],
    usage: "opsy observability aws metrics query --workspace <workspace> --env <env> --queries <json> [...]",
    summary: "Run CloudWatch metric queries.",
  }),
  command({
    id: "observability.aws.alarms.list",
    path: ["observability", "aws", "alarms", "list"],
    usage: "opsy observability aws alarms list --workspace <workspace> --env <env> [...]",
    summary: "List CloudWatch alarms.",
  }),
  command({
    id: "observability.aws.alarms.detail",
    path: ["observability", "aws", "alarms", "detail"],
    usage: "opsy observability aws alarms detail --workspace <workspace> --env <env> --alarm-name <name>",
    summary: "Get one CloudWatch alarm.",
  }),
  command({
    id: "observability.aws.alarms.history",
    path: ["observability", "aws", "alarms", "history"],
    usage: "opsy observability aws alarms history --workspace <workspace> --env <env> --alarm-name <name> [...]",
    summary: "List CloudWatch alarm history.",
  }),
  command({
    id: "feedback.send",
    path: ["feedback", "send"],
    usage: "opsy feedback send --message <text> [--error-context <json>] [--from-llm]",
    summary: "Submit feedback to the Opsy team.",
  }),
  command({
    id: "auth.login",
    path: ["auth", "login"],
    usage: "opsy auth login --token <token> [--api-url <url>]",
    summary: "Store CLI credentials.",
    flags: flags(
      { name: "token", value: "<token>", required: true, description: "Personal access token." },
      { name: "api-url", value: "<url>", description: "Optional API base URL." },
    ),
    examples: [
      "opsy auth login --token <pat>",
    ],
    whenToUse: [
      "CLI only. Run this before the first CLI command unless you already pass `--token` or `OPSY_TOKEN` on each call.",
    ],
    nextSteps: [
      "Run `opsy workspace list` to begin explicit workspace discovery.",
    ],
  }),
  command({
    id: "auth.logout",
    path: ["auth", "logout"],
    usage: "opsy auth logout",
    summary: "Clear stored CLI credentials.",
  }),
  command({
    id: "auth.whoami",
    path: ["auth", "whoami"],
    usage: "opsy auth whoami",
    summary: "Show the current authenticated actor.",
  }),
];

const TOP_LEVEL_HELP = [
  "Opsy manages infrastructure as explicit workspaces, environments, resources, and changes.",
  "",
  "First-run workflow:",
  "  1. `opsy auth login --token <pat>`",
  "  2. `opsy workspace list`",
  "  3. `opsy environment list --workspace <slug>`",
  "  4. `opsy resource list --workspace <slug> --env <slug>`",
  "  5. `opsy resource get <slug> --workspace <slug> --env <slug>`",
  "  6. `opsy change create ...` or `opsy resource create ...`",
  "",
  "Read-first safety rule:",
  "  Start with discovery and inspection before mutation. Read the tree, inspect one resource, then mutate.",
  "",
  "Resource traversal:",
  "  `opsy resource list --workspace <slug> --env <slug>` returns root resources first.",
  "  Add `--parent <slug>` to walk down the tree one level at a time.",
  "",
  "Mutation paths:",
  "  Use `opsy change create` for reviewable drafts and multi-step work.",
  "  Use `opsy resource create`, `opsy resource update`, or `opsy resource delete` for one-off mutations that should auto-apply when policy allows.",
  "",
  "Organizing resources:",
  "  Use `--parent <slug>` on `resource create` and `resource update` to place a resource under another resource.",
  '  In change mutation JSON, every mutation object must include `"kind"`, and you can use `"parent":"<slug>"` for hierarchy and `"dependsOn":["<slug>"]` for explicit dependency ordering.',
  '  If you want a folder-like container with no cloud object, create a virtual resource with `type:"group"` first, then parent resources under it.',
  "",
  "More help:",
  "  `opsy <noun> --help`",
  "  `opsy <noun> <action> --help`",
  "",
  "Nouns:",
  "  auth           CLI authentication",
  "  workspace      Workspaces",
  "  environment    Environments inside a workspace",
  "  resource       Managed resources and resource lifecycle actions",
  "  change         Proposed and applied changes",
  "  provider       Provider profiles",
  "  schema         Resource schema browsing",
  "  discovery      Provider-scoped resource discovery",
  "  observability  Provider-scoped logs, metrics, and alarms",
  "  feedback       Submit feedback to the Opsy team",
].join("\n");

function renderFlags(spec: CommandSpec): string {
  if (!spec.flags?.length) {
    return "";
  }

  return `\nFlags:\n${spec.flags.map((flag) => {
    const name = `--${flag.name}${flag.value ? ` ${flag.value}` : ""}`;
    const required = flag.required ? " (required)" : "";
    return `  ${name}${required}  ${flag.description}`;
  }).join("\n")}`;
}

function renderBulletedSection(title: string, lines?: string[]): string {
  if (!lines?.length) {
    return "";
  }

  return `\n${title}:\n${lines.map((line) => `  ${line}`).join("\n")}`;
}

function renderPrefixHelp(path: string[], children: CommandSpec[]): string {
  const nextParts = [...new Set(children.map((spec) => spec.path[path.length]))].filter(Boolean);
  const lines = nextParts.map((part) => {
    const child = children.find((spec) => spec.path[path.length] === part && spec.path.length === path.length + 1);
    const summary = child?.summary ? `  ${child.summary}` : "";
    return `  ${part}${summary}`;
  });

  return `${path.join(" ")}\n\nSubcommands:\n${lines.join("\n")}\n\nUse \`opsy ${path.join(" ")} <action> --help\` for command details.`;
}

export function findCommandSpec(path: string[]): CommandSpec | undefined {
  return OPSY_COMMAND_SPECS.find((spec) => spec.path.join(" ") === path.join(" "));
}

export function listCommandSpecsForPrefix(path: string[]): CommandSpec[] {
  return OPSY_COMMAND_SPECS.filter((spec) => path.every((part, index) => spec.path[index] === part));
}

function addNextStep(message: string, nextStep: string): string {
  return `${message} Next: ${nextStep}`;
}

export function renderCommandErrorMessage(message: string): string {
  if (message.includes("Next:")) {
    return message;
  }

  if (message === "Missing --workspace." || message === "Missing workspace slug.") {
    return addNextStep(message, "run `opsy workspace list` and retry with one returned slug as `--workspace <slug>`.");
  }

  if (message === "Missing --env." || message === "Missing environment slug.") {
    return addNextStep(message, "run `opsy environment list --workspace <slug>` and retry with one returned slug as `--env <slug>`.");
  }

  if (message === "Missing resource slug.") {
    return addNextStep(message, "run `opsy resource list --workspace <slug> --env <slug>` and reuse one returned slug.");
  }

  if (message === "Missing change shortId.") {
    return addNextStep(message, "run `opsy change list --workspace <slug> --env <slug>` and reuse one returned shortId.");
  }

  const invalidJson = message.match(/^Invalid JSON in --([a-z-]+)\.$/);
  if (invalidJson) {
    const flag = invalidJson[1]!;
    if (flag === "mutations") {
      return addNextStep(message, "pass a valid JSON array, then continue with `opsy change create --workspace <slug> --env <slug> --mutations '[...]'` or `opsy change append <shortId> --mutations '[...]'`.");
    }
    if (flag === "inputs") {
      return addNextStep(message, "pass a valid JSON object, then retry the resource mutation command.");
    }
    return addNextStep(message, `pass valid JSON to \`--${flag}\` and retry the command.`);
  }

  if (message.includes('Workspace "') && message.includes('not found')) {
    return addNextStep(message, "run `opsy workspace list` to confirm the workspace slug, then retry with `--workspace <slug>`.");
  }

  if ((message.includes('Environment "') || message.includes('Env "')) && message.includes('not found')) {
    return addNextStep(message, "run `opsy environment list --workspace <slug>` to confirm the environment slug, then retry with `--env <slug>`.");
  }

  if (message.includes('Resource "') && message.includes('not found')) {
    return addNextStep(message, "run `opsy resource list --workspace <slug> --env <slug>` to confirm the slug, or add `--parent <slug>` to keep traversing the tree.");
  }

  if (message.includes('Change "') && message.includes('not found')) {
    return addNextStep(message, "run `opsy change list --workspace <slug> --env <slug>` to confirm the shortId, then retry.");
  }

  return message;
}

export function renderCommandHelp(path: string[]): string {
  if (path.length === 0) {
    return TOP_LEVEL_HELP;
  }

  if (path[0] === "observability") {
    if (path.length === 1) {
      return `${renderObserveSupportedProviders()}\nUse "opsy observability aws --help" for AWS observability commands.`;
    }
    if (path[1] === "aws") {
      if (path.length === 2) {
        return renderObserveProviderHelp("aws");
      }
      const observeHelp = findObserveCommandHelp("aws", path.slice(2));
      if (observeHelp) {
        const notes = observeHelp.notes?.length ? `\nNotes:\n${observeHelp.notes.map((note) => `  ${note}`).join("\n")}` : "";
        const examples = observeHelp.examples.length ? `\nExamples:\n${observeHelp.examples.map((example) => `  ${example}`).join("\n")}` : "";
        return `${observeHelp.synopsis}\n\n${observeHelp.purpose}${notes}${examples}`;
      }
    }
  }

  if (path[0] === "discovery") {
    if (path.length === 1) {
      return `Supported discovery providers:\n${OPSY_DISCOVERY_PROVIDERS.map((provider) => `  ${provider.id}`).join("\n")}\nUse "opsy discovery <provider> --help" for provider-specific discovery commands.`;
    }
    if (!OPSY_DISCOVERY_PROVIDERS.some((provider) => provider.id === path[1])) {
      return getUnsupportedDiscoveryProviderMessage(path[1] ?? "");
    }
  }

  const exact = findCommandSpec(path);
  if (exact) {
    return [
      `Usage:\n  ${exact.usage}`,
      `\n${exact.summary}`,
      renderFlags(exact),
      renderBulletedSection("When to use", exact.whenToUse),
      renderBulletedSection("Examples", exact.examples),
      renderBulletedSection("Notes", exact.notes),
      renderBulletedSection("What to do next", exact.nextSteps),
    ].join("");
  }

  const children = listCommandSpecsForPrefix(path);
  if (children.length > 0) {
    return renderPrefixHelp(path, children);
  }

  return `Unknown help topic: ${path.join(" ")}`;
}

export function renderServerInstructions(): string {
  return [
    "Opsy manages infrastructure through workspaces, environments, resources, and changes.",
    "Tools: opsy_workspace, opsy_environment, opsy_resource, opsy_change, opsy_provider, opsy_schema, opsy_discovery, opsy_observability, opsy_admin.",
    "Zero-start flow: opsy_workspace list -> opsy_environment list -> opsy_resource list -> opsy_resource get, then opsy_change create or opsy_resource create.",
    'Resource and change `inputs` follow Pulumi property names for each type (example: `aws:s3/bucket:Bucket` with `{"bucket":"my-bucket"}`). Reach for opsy_schema list/get only when the exact type token, field names, or field types are unclear.',
    'Use `parent` on resource mutations to organize resources. In change mutation JSON, every mutation object must include `"kind"`, and you can use `"parent":"<slug>"` for hierarchy and `"dependsOn":["<slug>"]` for explicit dependency ordering when no input ref expresses the dependency. Create `type:"group"` first when you need a virtual container.',
    "MCP authentication is handled by the client session, not by opsy_admin login.",
    "Pass help: true to any tool to see command-specific usage.",
  ].join("\n");
}

export type ParsedCommand = {
  positionals: string[];
  flags: Record<string, string | boolean>;
};

export function parseCommandString(command: string): ParsedCommand {
  const tokens: string[] = [];
  let current = "";
  let quote: "'" | '"' | null = null;

  for (let index = 0; index < command.length; index++) {
    const char = command[index]!;
    if (quote) {
      if (char === quote) {
        quote = null;
      } else {
        current += char;
      }
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      continue;
    }
    if (/\s/.test(char)) {
      if (current.length > 0) {
        tokens.push(current);
        current = "";
      }
      continue;
    }
    current += char;
  }
  if (current.length > 0) {
    tokens.push(current);
  }

  if (tokens[0] === "opsy") {
    tokens.shift();
  }

  const positionals: string[] = [];
  const flags: Record<string, string | boolean> = {};
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index]!;
    if (!token.startsWith("--")) {
      positionals.push(token);
      continue;
    }
    const name = token.slice(2);
    const next = tokens[index + 1];
    if (!next || next.startsWith("--")) {
      flags[name] = true;
      continue;
    }
    flags[name] = next;
    index++;
  }

  return { positionals, flags };
}

export function normalizeCommandPath(positionals: string[]): string[] {
  if (positionals.length === 0) {
    return [];
  }

  const [first] = positionals;
  if (first === "discovery") {
    return positionals.slice(0, Math.min(positionals.length, 3));
  }
  if (first === "observability") {
    return positionals.slice(0, Math.min(positionals.length, 4));
  }
  if (
    first === "auth" ||
    first === "workspace" ||
    first === "environment" ||
    first === "resource" ||
    first === "change" ||
    first === "provider" ||
    first === "schema" ||
    first === "feedback"
  ) {
    return positionals.slice(0, Math.min(positionals.length, 2));
  }
  return positionals;
}

export function getObserveSupportedProvidersMessage(): string {
  return renderObserveSupportedProviders();
}

export function getObserveProviderHelpMessage(provider: string): string {
  return renderObserveProviderHelp(provider);
}

export function getObserveProviders() {
  return OBSERVE_PROVIDERS;
}
