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
    id: "project.list",
    path: ["project", "list"],
    usage: "opsy project list",
    summary: "List projects you can target.",
    examples: [
      "opsy project list",
    ],
    whenToUse: [
      "Start here on a fresh install or fresh MCP session when you do not know any project slugs yet.",
    ],
    nextSteps: [
      "Run `opsy resource list --project <slug>` with one returned project slug.",
    ],
  }),
  command({
    id: "project.get",
    path: ["project", "get"],
    usage: "opsy project get <slug>",
    summary: "Get one project by slug.",
    examples: [
      "opsy project get acme",
    ],
    whenToUse: [
      "Use this when you already know the project slug and want to confirm its details before targeting resources inside it.",
    ],
    nextSteps: [
      "Run `opsy resource list --project <slug>` to discover resources in that project.",
    ],
  }),
  command({
    id: "project.create",
    path: ["project", "create"],
    usage: "opsy project create --slug <slug> --name <name>",
    summary: "Create a new project.",
    flags: flags(
      { name: "slug", value: "<slug>", required: true, description: "Project slug." },
      { name: "name", value: "<name>", required: true, description: "Project display name." },
    ),
    examples: [
      'opsy project create --slug acme --name "Acme Production"',
    ],
    whenToUse: [
      "Use this only when you need a brand new top-level project, not when you are trying to discover an existing one.",
    ],
    nextSteps: [
      "Run `opsy resource list --project <slug>` after the project exists.",
    ],
  }),
  command({
    id: "resource.list",
    path: ["resource", "list"],
    usage: "opsy resource list --project <project> [--parent <slug>] [--detailed]",
    summary: "List resources in a project. With no `--parent`, Opsy returns root resources first.",
    flags: flags(
      { name: "project", value: "<project>", required: true, description: "Project slug." },
      { name: "parent", value: "<slug>", description: "List only the children under one resource slug." },
      { name: "detailed", description: "Return full resource records instead of compact list rows." },
    ),
    examples: [
      "opsy resource list --project acme",
      "opsy resource list --project acme --parent network",
    ],
    whenToUse: [
      "Use this as the default read-first entry point before `resource get`, `change create`, or one-off resource mutations.",
      "Traverse the tree top-down: roots first, then add `--parent <slug>` when you want to drill into children.",
    ],
    nextSteps: [
      "Run `opsy resource get <slug> --project <slug>` for one returned resource.",
      "Use `--parent <slug>` with one returned root slug to keep traversing the tree.",
    ],
  }),
  command({
    id: "resource.get",
    path: ["resource", "get"],
    usage: "opsy resource get <slug> --project <project>",
    summary: "Get one managed Opsy resource record.",
    flags: flags(
      { name: "project", value: "<project>", required: true, description: "Project slug." },
    ),
    examples: [
      "opsy resource get vpc --project acme",
    ],
    whenToUse: [
      "Use this after `resource list` when you need the managed Opsy record for one slug.",
    ],
    nextSteps: [
      "Run `opsy resource read <slug> --project <slug>` when you want the live provider read for the same resource.",
      "Choose a mutation path: `opsy change create --project <slug>` for a draft, or `opsy resource update <slug> --project <slug> --inputs <json>` for a one-off mutation.",
    ],
  }),
  command({
    id: "resource.discover",
    path: ["resource", "discover"],
    usage: "opsy resource discover --project <project> [--provider <provider>] [--type <type>] [--profile <profileId>] [--location <location>]",
    summary: "Browse provider inventory across managed and unmanaged resources.",
    flags: flags(
      { name: "project", value: "<project>", required: true, description: "Project slug." },
      { name: "provider", value: "<provider>", description: "Optional provider id, e.g. aws or cloudflare." },
      { name: "type", value: "<type>", description: "Optional type filter." },
      { name: "profile", value: "<profileId>", description: "Optional integration profile id." },
      { name: "location", value: "<location>", description: "Optional region/location filter." },
    ),
    examples: [
      "opsy resource discover --project acme --provider aws",
      "opsy resource discover --project acme --provider cloudflare --type zone",
    ],
    whenToUse: [
      "Start here when you do not know the exact provider object yet or when you need to find unmanaged inventory to import or delete.",
    ],
    nextSteps: [
      "Run `opsy resource read --project <slug> --type <type> --provider-id <id>` for one discovered object.",
      "Run `opsy resource import --project <slug> --slug <slug> --type <type> --provider-id <id>` before updating an unmanaged resource.",
    ],
  }),
  command({
    id: "resource.read",
    path: ["resource", "read"],
    usage: "opsy resource read [slug] --project <project> [--type <type> --provider-id <id> --provider <provider> --profile <profileId>]",
    summary: "Run a live provider read for one managed slug or external selector.",
    flags: flags(
      { name: "project", value: "<project>", required: true, description: "Project slug." },
      { name: "type", value: "<type>", description: "External resource type when reading unmanaged inventory." },
      { name: "provider-id", value: "<id>", description: "External provider ID when reading unmanaged inventory." },
      { name: "provider", value: "<provider>", description: "Optional provider override for unmanaged reads." },
      { name: "profile", value: "<profileId>", description: "Optional integration profile id." },
    ),
    examples: [
      "opsy resource read vpc --project acme",
      "opsy resource read --project acme --type cloudflare:index/zone:Zone --provider-id zone-123 --provider cloudflare",
    ],
    whenToUse: [
      "Use this when you already know the target resource and want the live provider read, not the stored managed record.",
    ],
    nextSteps: [
      "Run `opsy resource get <slug> --project <slug>` for the managed Opsy record.",
      "Run `opsy resource import --project <slug> --slug <slug> --type <type> --provider-id <id>` before updating an unmanaged resource.",
    ],
  }),
  command({
    id: "resource.create",
    path: ["resource", "create"],
    usage: "opsy resource create --project <project> --slug <slug> --type <type> --inputs <json> [--parent <slug>] [--depends-on <json>] [--auto-apply] [--summary <text>]",
    summary: "Create one resource by proposing a single mutation, previewing it by default, and applying only when --auto-apply is set.",
    flags: flags(
      { name: "project", value: "<project>", required: true, description: "Project slug." },
      { name: "slug", value: "<slug>", required: true, description: "Resource slug." },
      { name: "type", value: "<type>", required: true, description: "Pulumi resource token." },
      { name: "inputs", value: "<json>", required: true, description: "Resource inputs JSON object." },
      { name: "parent", value: "<slug>", description: "Optional parent resource slug." },
      { name: "depends-on", value: "<json>", description: "JSON array of dependency slugs for explicit ordering." },
      { name: "auto-apply", description: "Apply immediately after preview instead of returning a preview-only change." },
      { name: "summary", value: "<text>", description: "Optional change summary." },
    ),
    examples: [
      `opsy resource create --project acme --slug vpc --type aws:ec2/vpc:Vpc --inputs '{"cidrBlock":"10.0.0.0/16"}'`,
      `opsy resource create --project acme --slug policy --type aws:s3/bucketPolicy:BucketPolicy --inputs '{"bucket":"demo"}' --depends-on '["public-access-block"]'`,
      `opsy resource create --project acme --slug site-zone --type cloudflare:index/zone:Zone --inputs '{"account":{"id":"<account-id>"},"zone":"example.com"}'`,
    ],
    whenToUse: [
      "Use this for a one-off resource creation when you do not need to stage multiple mutations in a draft first.",
    ],
    nextSteps: [
      "By default, run `opsy change apply <shortId>` if the preview looks correct. If you need a staged workflow instead, start with `opsy change create --project <slug>`.",
    ],
  }),
  command({
    id: "resource.update",
    path: ["resource", "update"],
    usage: "opsy resource update <slug> --project <project> --inputs <json> [--remove-input-paths <json>] [--parent <slug>] [--depends-on <json>] [--auto-apply] [--version <n>] [--summary <text>]",
    summary: "Update one resource by proposing a single mutation, previewing it by default, and applying only when --auto-apply is set.",
    flags: flags(
      { name: "project", value: "<project>", required: true, description: "Project slug." },
      { name: "inputs", value: "<json>", required: true, description: "Inputs JSON object." },
      { name: "remove-input-paths", value: "<json>", description: "JSON array of nested input paths to remove." },
      { name: "parent", value: "<slug>", description: "Move the resource under a different parent slug." },
      { name: "depends-on", value: "<json>", description: "JSON array of dependency slugs for explicit ordering." },
      { name: "auto-apply", description: "Apply immediately after preview instead of returning a preview-only change." },
      { name: "version", value: "<n>", description: "Optimistic-lock version." },
      { name: "summary", value: "<text>", description: "Optional change summary." },
    ),
    examples: [
      `opsy resource update vpc --project acme --inputs '{"enableDnsHostnames":true}'`,
      `opsy resource update policy --project acme --inputs '{}' --depends-on '["public-access-block"]'`,
    ],
    whenToUse: [
      "Use this for a single direct edit after you have already inspected the managed resource with `resource get`.",
    ],
    notes: [
      "Unmanaged resources must be imported first. External selectors are rejected on update.",
    ],
    nextSteps: [
      "By default, run `opsy change apply <shortId>` if the preview looks correct. Use `opsy change create --project <slug>` instead when you want a reviewable draft with multiple steps.",
    ],
  }),
  command({
    id: "resource.delete",
    path: ["resource", "delete"],
    usage: "opsy resource delete [slug] --project <project> [--recursive] [--auto-apply] [--type <type> --provider-id <id> --profile <profileId>]",
    summary: "Delete one managed resource or one external provider object, previewing first unless --auto-apply is set.",
    flags: flags(
      { name: "project", value: "<project>", required: true, description: "Project slug." },
      { name: "recursive", description: "Delete descendants too." },
      { name: "auto-apply", description: "Apply immediately after preview instead of returning a preview-only change." },
      { name: "type", value: "<type>", description: "External resource type for approved provider-side deletes." },
      { name: "provider-id", value: "<id>", description: "External provider ID for approved provider-side deletes." },
      { name: "profile", value: "<profileId>", description: "Optional integration profile id for external deletes." },
    ),
    examples: [
      "opsy resource delete old-bucket --project acme",
      "opsy resource delete --project acme --type cloudflare:index/zone:Zone --provider-id zone-123 --profile cf-prod",
    ],
    whenToUse: [
      "Use this for a one-off deletion after you have confirmed the target resource and scope.",
    ],
    notes: [
      "External deletes always require approval, even when the project would normally auto-apply.",
    ],
    nextSteps: [
      "By default, run `opsy change apply <shortId>` if the preview looks correct. Use `opsy change create --project <slug>` if this delete belongs in a larger staged change.",
    ],
  }),
  command({
    id: "resource.import",
    path: ["resource", "import"],
    usage: "opsy resource import --project <project> --slug <slug> --type <type> --provider-id <id> [--profile <profileId>] [--summary <text>]",
    summary: "Adopt an existing external resource into managed Opsy state.",
    flags: flags(
      { name: "project", value: "<project>", required: true, description: "Project slug." },
      { name: "slug", value: "<slug>", required: true, description: "Managed Opsy slug to create or claim." },
      { name: "type", value: "<type>", required: true, description: "Pulumi type token." },
      { name: "provider-id", value: "<id>", required: true, description: "External provider ID." },
      { name: "profile", value: "<profileId>", description: "Optional integration profile id." },
      { name: "summary", value: "<text>", description: "Optional change summary." },
    ),
    examples: [
      "opsy resource import --project acme --slug example-zone --type cloudflare:index/zone:Zone --provider-id zone-123",
    ],
    whenToUse: [
      "Use this before `resource update` when the target exists in the provider but is not yet managed by Opsy.",
    ],
    nextSteps: [
      "Run `opsy resource update <slug> --project <slug> --inputs <json>` after the import is accepted.",
    ],
  }),
  command({
    id: "resource.forget",
    path: ["resource", "forget"],
    usage: "opsy resource forget <slug> --project <project> [--recursive] [--target-dependents] [--summary <text>]",
    summary: "Forget one resource from Opsy state by proposing a state-only removal and immediately attempting apply.",
    flags: flags(
      { name: "project", value: "<project>", required: true, description: "Project slug." },
      { name: "recursive", description: "Forget descendants too." },
      { name: "target-dependents", description: "Forget graph dependents too." },
      { name: "summary", value: "<text>", description: "Optional change summary." },
    ),
    examples: [
      "opsy resource forget old-bucket --project acme",
      "opsy resource forget network --project acme --recursive",
      "opsy resource forget provider --project acme --target-dependents",
    ],
    whenToUse: [
      "Use this when the cloud object is already gone or intentionally retained and you need Opsy to stop managing the recorded state.",
    ],
    notes: [
      "This is state-only removal: Opsy does not call the provider delete method.",
      "Without `--recursive`, children block the forget. Without `--target-dependents`, graph dependents block the forget.",
      "`--target-dependents` expands from the requested root target; inferred dependents are not standalone apply targets.",
    ],
    nextSteps: [
      "Inspect the returned change or approval result. Use `opsy change create --project <slug>` if this forget belongs in a larger staged change.",
    ],
  }),
  command({
    id: "resource.diff",
    path: ["resource", "diff"],
    usage: "opsy resource diff <slug> --project <project>",
    summary: "Compare stored and live resource state.",
  }),
  command({
    id: "resource.refresh",
    path: ["resource", "refresh"],
    usage: "opsy resource refresh <slug> --project <project>",
    summary: "Refresh a resource from cloud and recompute conflict state.",
  }),
  command({
    id: "resource.accept-live",
    path: ["resource", "accept-live"],
    usage: "opsy resource accept-live <slug> --project <project>",
    summary: "Accept recorded live state into desired inputs immediately.",
    notes: [
      "Requires an `out_of_sync` resource with a recorded conflict snapshot.",
      "This updates stored desired inputs directly instead of creating a reviewable change.",
    ],
  }),
  command({
    id: "resource.reconcile",
    path: ["resource", "reconcile"],
    usage: "opsy resource reconcile <slug> --project <project>",
    summary: "Promote recorded live state into desired inputs through a change.",
    whenToUse: [
      "Use this when a resource is `out_of_sync` and you want a reviewable change that adopts the recorded live inputs instead of accepting them immediately.",
    ],
    notes: [
      "Requires an `out_of_sync` resource and a recorded live input snapshot from drift detection.",
      "If no live snapshot is recorded yet, refresh drift first and retry.",
    ],
    nextSteps: [
      "Preview or apply the returned change, or use `opsy resource accept-live <slug> --project <slug>` if you want to adopt the same state immediately without a change.",
    ],
  }),
  command({
    id: "resource.restore",
    path: ["resource", "restore"],
    usage: "opsy resource restore <slug> --project <project> --operation <operationId>",
    summary: "Restore a resource to the state captured before an operation.",
  }),
  command({
    id: "resource.history",
    path: ["resource", "history"],
    usage: "opsy resource history <slug> --project <project>",
    summary: "List operation history for one resource.",
  }),
  command({
    id: "change.list",
    path: ["change", "list"],
    usage: "opsy change list --project <project>",
    summary: "List recent changes in one project.",
    flags: flags(
      { name: "project", value: "<project>", required: true, description: "Project slug." },
    ),
    examples: [
      "opsy change list --project acme",
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
    usage: "opsy change create --project <project> [--mutations <json>] [--summary <text>]",
    summary: "Create a draft change, optionally seeded with mutations.",
    flags: flags(
      { name: "project", value: "<project>", required: true, description: "Project slug." },
      { name: "mutations", value: "<json>", description: "JSON array of mutations to seed the draft." },
      { name: "summary", value: "<text>", description: "Optional human summary for the change." },
    ),
    examples: [
      'opsy change create --project acme --summary "Create base network"',
      `opsy change create --project acme --mutations '[{"kind":"create","slug":"network","type":"group"},{"kind":"create","slug":"vpc","type":"aws:ec2/vpc:Vpc","parent":"network","inputs":{"cidrBlock":"10.0.0.0/16"}}]' --summary "Create grouped network"`,
      `opsy change create --project acme --mutations '[{"kind":"update","slug":"subnet-a","parent":"vpc-b","inputs":{}}]' --summary "Move subnet under new parent"`,
      `opsy change create --project acme --mutations '[{"kind":"update","slug":"policy","dependsOn":["public-access-block"],"inputs":{}}]' --summary "Make policy wait for public access block"`,
      `opsy change create --project acme --mutations '[{"kind":"forget","slug":"bucket"}]' --summary "Forget stale bucket state"`,
      `opsy change create --project acme --mutations '[{"kind":"forget","slug":"provider","targetDependents":true}]' --summary "Forget provider and dependents from Opsy state"`,
      `opsy change create --project acme --mutations '[{"kind":"create","slug":"bucket","type":"aws:s3/bucket:Bucket","inputs":{"bucket":"demo"},"customTimeouts":{"create":"30m","delete":"10m"}}]' --summary "Create bucket with custom timeouts"`,
    ],
    whenToUse: [
      "Use this when you want a reviewable draft before applying mutations, especially when the work spans multiple resources.",
    ],
    notes: [
      'Every mutation object must include `"kind"`. Supported kinds are `"create"`, `"update"`, `"delete"`, `"import"`, and `"forget"`.',
      'In mutation JSON, use `"parent":"<slug>"` to organize resources under another resource.',
      'Use `"dependsOn":["<slug>"]` in mutation JSON for explicit dependency ordering when no input ref expresses the dependency.',
      'Use `"targetDependents":true` only on `"forget"` when you intend state-only removal to cascade from the requested root to graph dependents.',
      'Use `"customTimeouts"` for Pulumi-style operation timeouts. `create`, `update`, and `import` mutations can set `create`/`update`/`delete`; `delete` mutations can override only `"delete"`; `forget` does not support `customTimeouts`.',
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
      `opsy change append abcd1234 --mutations '[{"kind":"forget","slug":"bucket","targetDependents":true}]'`,
      `opsy change append abcd1234 --mutations '[{"kind":"update","slug":"bucket","inputs":{"tags":{"env":"prod"}},"customTimeouts":{"update":"45m"}}]'`,
    ],
    whenToUse: [
      "Use this after `change create` when you are building up a staged change in multiple steps.",
    ],
    notes: [
      'Every mutation object must include `"kind"`. Supported kinds are `"create"`, `"update"`, `"delete"`, `"import"`, and `"forget"`.',
      'Mutation JSON uses `"parent":"<slug>"` for reparenting.',
      'Mutation JSON uses `"dependsOn":["<slug>"]` for explicit dependency ordering when no input ref expresses the dependency.',
      'Mutation JSON uses `"targetDependents":true` only for `"forget"` to cascade state-only removal from the requested root to graph dependents.',
      'Mutation JSON also supports `"customTimeouts"` with the same rules: full policy for `create`/`update`/`import`, delete-only override for `delete`, unsupported for `forget`.',
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
    id: "change.cancel",
    path: ["change", "cancel"],
    usage: "opsy change cancel <shortId> [--reason <text>]",
    summary: "Cancel the active apply execution for one change.",
    flags: flags(
      { name: "reason", value: "<text>", description: "Optional cancellation reason." },
    ),
    examples: [
      "opsy change cancel abcd1234",
      'opsy change cancel abcd1234 --reason "Manual rollback requested"',
    ],
    whenToUse: [
      "Use this compatibility path when you know the change shortId but not the execution id.",
    ],
    nextSteps: [
      "Run `opsy change get <shortId>` to confirm cancellation progress and inspect the latest execution record.",
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
    id: "execution.cancel",
    path: ["execution", "cancel"],
    usage: "opsy execution cancel <executionId> [--reason <text>]",
    summary: "Cancel one running execution by execution id.",
    flags: flags(
      { name: "reason", value: "<text>", description: "Optional cancellation reason." },
    ),
    examples: [
      "opsy execution cancel 00000000-0000-0000-0000-000000000000",
    ],
    whenToUse: [
      "Use this as the primary control-plane cancel path when you already have an execution id from a change detail or execution record.",
    ],
    nextSteps: [
      "Re-run `opsy change get <shortId>` or inspect the web UI change page to confirm cancellation progress.",
    ],
  }),
  command({
    id: "integration.list",
    path: ["integration", "list"],
    usage: "opsy integration list",
    summary: "List integrations.",
  }),
  command({
    id: "integration.get",
    path: ["integration", "get"],
    usage: "opsy integration get <id>",
    summary: "Get one integration.",
  }),
  command({
    id: "integration.create",
    path: ["integration", "create"],
    usage: "opsy integration create --provider <provider> --name <name> --config <json>",
    summary: "Create an integration.",
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
    usage: "opsy discovery aws types --project <project> [--query <text>]",
    summary: "List AWS discovery types.",
  }),
  command({
    id: "discovery.aws.list",
    path: ["discovery", "aws", "list"],
    usage: "opsy discovery aws list --project <project> [--type <type>] [--region <region>]",
    summary: "Compatibility alias for provider-scoped AWS inventory discovery.",
    nextSteps: [
      "Prefer `opsy resource discover --project <slug> --provider aws` on the unified public surface.",
    ],
  }),
  command({
    id: "discovery.aws.inspect",
    path: ["discovery", "aws", "inspect"],
    usage: "opsy discovery aws inspect --project <project> --provider-id <id> --type <type>",
    summary: "Compatibility alias for provider-scoped AWS reads.",
    nextSteps: [
      "Prefer `opsy resource read --project <slug> --type <type> --provider-id <id> --provider aws` on the unified public surface.",
    ],
  }),
  command({
    id: "discovery.aws.import",
    path: ["discovery", "aws", "import"],
    usage: "opsy discovery aws import --project <project> --items <json>",
    summary: "Import existing AWS resources into a change.",
  }),
  command({
    id: "discovery.cloudflare.types",
    path: ["discovery", "cloudflare", "types"],
    usage: "opsy discovery cloudflare types --project <project> [--query <text>]",
    summary: "List Cloudflare discovery types.",
  }),
  command({
    id: "discovery.cloudflare.list",
    path: ["discovery", "cloudflare", "list"],
    usage: "opsy discovery cloudflare list --project <project> [--type <type>] [--location <location>]",
    summary: "Compatibility alias for provider-scoped Cloudflare inventory discovery.",
    nextSteps: [
      "Prefer `opsy resource discover --project <slug> --provider cloudflare` on the unified public surface.",
    ],
  }),
  command({
    id: "discovery.cloudflare.inspect",
    path: ["discovery", "cloudflare", "inspect"],
    usage: "opsy discovery cloudflare inspect --project <project> --provider-id <id> --type <type>",
    summary: "Compatibility alias for provider-scoped Cloudflare reads.",
    nextSteps: [
      "Prefer `opsy resource read --project <slug> --type <type> --provider-id <id> --provider cloudflare` on the unified public surface.",
    ],
  }),
  command({
    id: "discovery.cloudflare.import",
    path: ["discovery", "cloudflare", "import"],
    usage: "opsy discovery cloudflare import --project <project> --items <json>",
    summary: "Import existing Cloudflare resources into a change.",
  }),
  command({
    id: "observability.aws.logs.groups",
    path: ["observability", "aws", "logs", "groups"],
    usage: "opsy observability aws logs groups --project <project> [...]",
    summary: "List CloudWatch log groups.",
  }),
  command({
    id: "observability.aws.logs.tail",
    path: ["observability", "aws", "logs", "tail"],
    usage: "opsy observability aws logs tail --project <project> --log-group <name> [...]",
    summary: "Tail CloudWatch log events.",
  }),
  command({
    id: "observability.aws.logs.events",
    path: ["observability", "aws", "logs", "events"],
    usage: "opsy observability aws logs events --project <project> --log-group <name> [...]",
    summary: "List CloudWatch log events.",
  }),
  command({
    id: "observability.aws.logs.query",
    path: ["observability", "aws", "logs", "query"],
    usage: "opsy observability aws logs query --project <project> --log-groups <csv> --query-string <query> [...]",
    summary: "Run a CloudWatch Logs Insights query.",
  }),
  command({
    id: "observability.aws.metrics.list",
    path: ["observability", "aws", "metrics", "list"],
    usage: "opsy observability aws metrics list --project <project> [...]",
    summary: "List CloudWatch metrics.",
  }),
  command({
    id: "observability.aws.metrics.query",
    path: ["observability", "aws", "metrics", "query"],
    usage: "opsy observability aws metrics query --project <project> --queries <json> [...]",
    summary: "Run CloudWatch metric queries.",
  }),
  command({
    id: "observability.aws.alarms.list",
    path: ["observability", "aws", "alarms", "list"],
    usage: "opsy observability aws alarms list --project <project> [...]",
    summary: "List CloudWatch alarms.",
  }),
  command({
    id: "observability.aws.alarms.detail",
    path: ["observability", "aws", "alarms", "detail"],
    usage: "opsy observability aws alarms detail --project <project> --alarm-name <name>",
    summary: "Get one CloudWatch alarm.",
  }),
  command({
    id: "observability.aws.alarms.history",
    path: ["observability", "aws", "alarms", "history"],
    usage: "opsy observability aws alarms history --project <project> --alarm-name <name> [...]",
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
      "Run `opsy project list` to begin explicit project discovery.",
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
  "Opsy manages infrastructure as explicit projects, resources, and changes.",
  "",
  "First-run workflow:",
  "  1. `opsy auth login --token <pat>`",
  "  2. `opsy project list`",
  "  3. `opsy resource list --project <slug>`",
  "  4. `opsy resource get <slug> --project <slug>`",
  "  5. `opsy change create ...` or `opsy resource create ...`",
  "",
  "Read-first safety rule:",
  "  Start with discovery and inspection before mutation. Read the tree, inspect one resource, then mutate.",
  "",
  "Resource traversal:",
  "  `opsy resource list --project <slug>` returns root resources first.",
  "  Add `--parent <slug>` to walk down the tree one level at a time.",
  "",
  "Mutation paths:",
  "  Use `opsy change create` for reviewable drafts and multi-step work.",
  "  Use `opsy resource create`, `opsy resource update`, or `opsy resource delete` for one-off mutations that preview first; pass `--auto-apply` to apply immediately.",
  "  Use `opsy resource forget` for one-off state-only removal that still auto-applies when policy allows.",
  "",
  "Organizing resources:",
  "  Use `--parent <slug>` on `resource create` and `resource update` to place a resource under another resource.",
  '  Use `--depends-on <json>` on `resource create` and `resource update` for explicit dependency ordering in one-off mutations.',
  '  In change mutation JSON, every mutation object must include `"kind"` and must be one of `"create"`, `"update"`, `"delete"`, `"import"`, or `"forget"`. Use `"parent":"<slug>"` for hierarchy, `"dependsOn":["<slug>"]` for explicit dependency ordering, and `"targetDependents":true` only on `"forget"` to cascade state-only removal from the requested root to graph dependents.',
  '  Mutation JSON also supports `"customTimeouts":{"create":"30m","update":"20m","delete":"10m"}` for Pulumi-style operation timeouts on `create`, `update`, and `import`. `delete` mutations can override only `"delete"`. `forget` does not support `customTimeouts`.',
  '  If you want a folder-like container with no cloud object, create a virtual resource with `type:"group"` first, then parent resources under it.',
  "",
  "More help:",
  "  `opsy <noun> --help`",
  "  `opsy <noun> <action> --help`",
  "",
  "Nouns:",
  "  auth           CLI authentication",
  "  project        Projects",
  "  resource       Managed resources and resource lifecycle actions",
  "  change         Proposed and applied changes",
  "  integration    Integrations",
  "  schema         Resource schema browsing",
  "  discovery      Provider-scoped discovery compatibility alias",
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

  if (message === "Missing --project." || message === "Missing project slug.") {
    return addNextStep(message, "run `opsy project list` and retry with one returned slug as `--project <slug>`.");
  }

  if (message === "Missing resource slug.") {
    return addNextStep(message, "run `opsy resource list --project <slug>` and reuse one returned slug.");
  }

  if (message === "Missing change shortId.") {
    return addNextStep(message, "run `opsy change list --project <slug>` and reuse one returned shortId.");
  }

  const invalidJson = message.match(/^Invalid JSON in --([a-z-]+)\.$/);
  if (invalidJson) {
    const flag = invalidJson[1]!;
    if (flag === "mutations") {
      return addNextStep(message, "pass a valid JSON array, then continue with `opsy change create --project <slug> --mutations '[...]'` or `opsy change append <shortId> --mutations '[...]'`.");
    }
    if (flag === "inputs") {
      return addNextStep(message, "pass a valid JSON object, then retry the resource mutation command.");
    }
    return addNextStep(message, `pass valid JSON to \`--${flag}\` and retry the command.`);
  }

  if (message.includes('Project "') && message.includes('not found')) {
    return addNextStep(message, "run `opsy project list` to confirm the project slug, then retry with `--project <slug>`.");
  }

  if (message.includes('Resource "') && message.includes('not found')) {
    return addNextStep(message, "run `opsy resource list --project <slug>` to confirm the slug, or add `--parent <slug>` to keep traversing the tree.");
  }

  if (message.includes('Change "') && message.includes('not found')) {
    return addNextStep(message, "run `opsy change list --project <slug>` to confirm the shortId, then retry.");
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
    "Opsy manages infrastructure through projects, resources, and changes.",
    "Tools: opsy_project, opsy_resource, opsy_change, opsy_integration, opsy_schema, opsy_discovery, opsy_observability, opsy_admin.",
    "Zero-start flow: opsy_project list -> opsy_resource list -> opsy_resource get, then opsy_change create or opsy_resource create.",
    "opsy_resource create/update/delete preview first unless autoApply=true; import and forget keep their immediate-apply path.",
    'Resource and change `inputs` follow Pulumi property names for each type (example: `aws:s3/bucket:Bucket` with `{"bucket":"my-bucket"}`). Reach for opsy_schema list/get only when the exact type token, field names, or field types are unclear.',
    'Use `parent` on resource mutations to organize resources, and `dependsOn` for explicit dependency ordering. In change mutation JSON, every mutation object must include `"kind"` and must be one of `"create"`, `"update"`, `"delete"`, `"import"`, or `"forget"`. Use `"parent":"<slug>"` for hierarchy, `"dependsOn":["<slug>"]` for explicit dependency ordering when no input ref expresses the dependency, and `"targetDependents":true` only on `"forget"` to cascade state-only removal from the requested root to graph dependents. `"customTimeouts":{"create":"30m","update":"20m","delete":"10m"}` is supported on `create`, `update`, and `import`. `delete` mutations can override only `"delete"`. `forget` does not support `customTimeouts`. Create `type:"group"` first when you need a virtual container.',
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
    first === "project" ||
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
