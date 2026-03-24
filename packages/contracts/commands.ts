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
};

function flags(...entries: CommandFlagSpec[]): CommandFlagSpec[] {
  return entries;
}

export const OPSY_DISCOVERY_PROVIDERS = [
  { id: "aws", label: "AWS" },
  { id: "cloudflare", label: "Cloudflare" },
] as const;

export function getUnsupportedDiscoveryProviderMessage(provider: string): string {
  return `Discovery is not implemented for "${provider}". Use manual import.`;
}

export const OPSY_DOMAIN_GUIDANCE = `
Resources are the core primitive. Treat the resource tree as real hierarchy.

Mutation format:
  {kind:"create", slug, type, inputs, parentSlug?}
  {kind:"update", slug, inputs?, removeInputPaths?, version?, parentSlug?}
  {kind:"delete", slug, recursive?, force?}
  {kind:"import", slug, type, cloudId, parentSlug?}

Cross-resource refs: use \${slug.outputField} in inputs to reference outputs from other resources.
Opsy resolves refs and executes operations in dependency order.
Use schema get to inspect fields when you genuinely need it.
On update, set parentSlug to move a resource under another parent. Use parentSlug:null to move to the top level.
Use removeInputPaths:["a.b.c"] to delete nested keys while keeping deep-merge update behavior.

Groups: use type:"group" to create virtual folders. Groups auto-complete on apply and cannot be imported or forgotten.

Convenience resource wrappers:
  resource create / resource update / resource delete
  These create a change with one mutation and immediately attempt apply.
  If environment policy blocks apply, the response returns approvalRequired:true plus reviewUrl.

Efficiency:
  1. Type tokens follow Pulumi format: <provider>:<module>/<Resource>:<Resource>
  2. Prefer proposing directly and use validation errors as feedback.
  3. Batch related mutations into one change where possible.
`.trim();

export const OPSY_COMMAND_SPECS: CommandSpec[] = [
  {
    id: "project.list",
    path: ["project", "list"],
    usage: "opsy project list",
    summary: "List projects.",
  },
  {
    id: "project.get",
    path: ["project", "get"],
    usage: "opsy project get <slug>",
    summary: "Get one project.",
  },
  {
    id: "project.create",
    path: ["project", "create"],
    usage: "opsy project create --slug <slug> --name <name>",
    summary: "Create a project.",
  },
  {
    id: "environment.list",
    path: ["environment", "list"],
    usage: "opsy environment list --workspace <workspace>",
    summary: "List environments for a project.",
    flags: flags({ name: "workspace", value: "<workspace>", required: true, description: "Project slug." }),
  },
  {
    id: "environment.get",
    path: ["environment", "get"],
    usage: "opsy environment get <slug> --workspace <workspace>",
    summary: "Get one environment.",
    flags: flags({ name: "workspace", value: "<workspace>", required: true, description: "Project slug." }),
  },
  {
    id: "environment.create",
    path: ["environment", "create"],
    usage: "opsy environment create --workspace <workspace> --slug <slug>",
    summary: "Create an environment.",
  },
  {
    id: "resource.list",
    path: ["resource", "list"],
    usage: "opsy resource list --workspace <workspace> --env <env> [--parent <slug>] [--detailed]",
    summary: "List resources in an environment.",
    flags: flags(
      { name: "workspace", value: "<workspace>", required: true, description: "Project slug." },
      { name: "env", value: "<env>", required: true, description: "Environment slug." },
      { name: "parent", value: "<slug>", description: "Filter to children of one resource." },
      { name: "detailed", description: "Include full resource records instead of summary rows." },
    ),
  },
  {
    id: "resource.get",
    path: ["resource", "get"],
    usage: "opsy resource get <slug> --workspace <workspace> --env <env> [--live]",
    summary: "Get one resource.",
    flags: flags(
      { name: "workspace", value: "<workspace>", required: true, description: "Project slug." },
      { name: "env", value: "<env>", required: true, description: "Environment slug." },
      { name: "live", description: "Include live cloud state comparison." },
    ),
  },
  {
    id: "resource.create",
    path: ["resource", "create"],
    usage: "opsy resource create --workspace <workspace> --env <env> --slug <slug> --type <type> --inputs <json> [--parent <slug>]",
    summary: "Create one resource by proposing one mutation and immediately attempting apply.",
    examples: [
      `opsy resource create --workspace acme --env prod --slug vpc --type aws:ec2/vpc:Vpc --inputs '{"cidrBlock":"10.0.0.0/16"}'`,
      `opsy resource create --workspace acme --env prod --slug site-zone --type cloudflare:index/zone:Zone --inputs '{"account":{"id":"<account-id>"},"zone":"example.com"}'`,
    ],
    flags: flags(
      { name: "workspace", value: "<workspace>", required: true, description: "Project slug." },
      { name: "env", value: "<env>", required: true, description: "Environment slug." },
      { name: "slug", value: "<slug>", required: true, description: "Resource slug." },
      { name: "type", value: "<type>", required: true, description: "Resource token." },
      { name: "inputs", value: "<json>", required: true, description: "Resource inputs JSON object." },
      { name: "parent", value: "<slug>", description: "Optional parent resource slug." },
    ),
  },
  {
    id: "resource.update",
    path: ["resource", "update"],
    usage: "opsy resource update <slug> --workspace <workspace> --env <env> --inputs <json>",
    summary: "Update one resource by proposing one mutation and immediately attempting apply.",
  },
  {
    id: "resource.delete",
    path: ["resource", "delete"],
    usage: "opsy resource delete <slug> --workspace <workspace> --env <env> [--recursive]",
    summary: "Delete one resource by proposing one mutation and immediately attempting apply.",
  },
  {
    id: "resource.diff",
    path: ["resource", "diff"],
    usage: "opsy resource diff <slug> --workspace <workspace> --env <env>",
    summary: "Compare stored and live resource state.",
  },
  {
    id: "resource.refresh",
    path: ["resource", "refresh"],
    usage: "opsy resource refresh <slug> --workspace <workspace> --env <env>",
    summary: "Refresh a resource from cloud and recompute conflict state.",
  },
  {
    id: "resource.accept-live",
    path: ["resource", "accept-live"],
    usage: "opsy resource accept-live <slug> --workspace <workspace> --env <env>",
    summary: "Accept recorded live state into desired inputs.",
  },
  {
    id: "resource.reconcile",
    path: ["resource", "reconcile"],
    usage: "opsy resource reconcile <slug> --workspace <workspace> --env <env>",
    summary: "Promote desired state back to cloud through a change.",
  },
  {
    id: "resource.restore",
    path: ["resource", "restore"],
    usage: "opsy resource restore <slug> --workspace <workspace> --env <env> --operation <operationId>",
    summary: "Restore a resource to the state captured before an operation.",
  },
  {
    id: "resource.history",
    path: ["resource", "history"],
    usage: "opsy resource history <slug> --workspace <workspace> --env <env>",
    summary: "List operation history for one resource.",
  },
  {
    id: "change.list",
    path: ["change", "list"],
    usage: "opsy change list --workspace <workspace> --env <env>",
    summary: "List recent changes.",
    flags: flags(
      { name: "workspace", value: "<workspace>", required: true, description: "Project slug." },
      { name: "env", value: "<env>", required: true, description: "Environment slug." },
    ),
  },
  { id: "change.get", path: ["change", "get"], usage: "opsy change get <shortId>", summary: "Get one change with operations." },
  {
    id: "change.create",
    path: ["change", "create"],
    usage: "opsy change create --workspace <workspace> --env <env> [--mutations <json>] [--summary <text>]",
    summary: "Create a change, optionally with mutations.",
  },
  {
    id: "change.append",
    path: ["change", "append"],
    usage: "opsy change append <shortId> --mutations <json> [--summary <text>]",
    summary: "Append mutations to an open change.",
  },
  { id: "change.preview", path: ["change", "preview"], usage: "opsy change preview <shortId>", summary: "Preview a change." },
  { id: "change.apply", path: ["change", "apply"], usage: "opsy change apply <shortId>", summary: "Apply a change." },
  { id: "change.discard", path: ["change", "discard"], usage: "opsy change discard <shortId>", summary: "Discard a change." },
  { id: "change.retry", path: ["change", "retry"], usage: "opsy change retry <shortId>", summary: "Retry a failed change." },
  { id: "provider.list", path: ["provider", "list"], usage: "opsy provider list", summary: "List provider profiles." },
  { id: "provider.get", path: ["provider", "get"], usage: "opsy provider get <id>", summary: "Get one provider profile." },
  {
    id: "provider.create",
    path: ["provider", "create"],
    usage: "opsy provider create --provider <provider> --name <name> --config <json>",
    summary: "Create a provider profile.",
  },
  {
    id: "schema.list",
    path: ["schema", "list"],
    usage: "opsy schema list --provider <provider> [--query <text>]",
    summary: "List resource schemas for a provider.",
    examples: [
      "opsy schema list --provider cloudflare --query zone",
    ],
    flags: flags(
      { name: "provider", value: "<provider>", required: true, description: "Provider package, for example aws." },
      { name: "query", value: "<text>", description: "Filter by schema token." },
    ),
  },
  {
    id: "schema.get",
    path: ["schema", "get"],
    usage: "opsy schema get <type-token>",
    summary: "Describe one resource schema.",
    examples: [
      "opsy schema get cloudflare:index/zone:Zone",
    ],
  },
  {
    id: "discovery.aws.types",
    path: ["discovery", "aws", "types"],
    usage: "opsy discovery aws types --workspace <workspace> --env <env> [--query <text>]",
    summary: "List AWS discovery types.",
  },
  {
    id: "discovery.aws.list",
    path: ["discovery", "aws", "list"],
    usage: "opsy discovery aws list --workspace <workspace> --env <env> [--type <type>] [--region <region>]",
    summary: "List existing AWS resources.",
  },
  {
    id: "discovery.aws.inspect",
    path: ["discovery", "aws", "inspect"],
    usage: "opsy discovery aws inspect --workspace <workspace> --env <env> --cloud-id <id> --type <type>",
    summary: "Inspect one AWS resource.",
  },
  {
    id: "discovery.aws.import",
    path: ["discovery", "aws", "import"],
    usage: "opsy discovery aws import --workspace <workspace> --env <env> --items <json>",
    summary: "Import existing AWS resources into a change.",
  },
  {
    id: "discovery.cloudflare.types",
    path: ["discovery", "cloudflare", "types"],
    usage: "opsy discovery cloudflare types --workspace <workspace> --env <env> [--query <text>]",
    summary: "List Cloudflare discovery types.",
  },
  {
    id: "discovery.cloudflare.list",
    path: ["discovery", "cloudflare", "list"],
    usage: "opsy discovery cloudflare list --workspace <workspace> --env <env> [--type <type>] [--location <location>]",
    summary: "List existing Cloudflare resources.",
  },
  {
    id: "discovery.cloudflare.inspect",
    path: ["discovery", "cloudflare", "inspect"],
    usage: "opsy discovery cloudflare inspect --workspace <workspace> --env <env> --provider-id <id> --type <type>",
    summary: "Inspect one Cloudflare resource.",
  },
  {
    id: "discovery.cloudflare.import",
    path: ["discovery", "cloudflare", "import"],
    usage: "opsy discovery cloudflare import --workspace <workspace> --env <env> --items <json>",
    summary: "Import existing Cloudflare resources into a change.",
  },
  {
    id: "observability.aws.logs.groups",
    path: ["observability", "aws", "logs", "groups"],
    usage: "opsy observability aws logs groups --workspace <workspace> --env <env> [...]",
    summary: "List CloudWatch log groups.",
  },
  {
    id: "observability.aws.logs.tail",
    path: ["observability", "aws", "logs", "tail"],
    usage: "opsy observability aws logs tail --workspace <workspace> --env <env> --log-group <name> [...]",
    summary: "Tail CloudWatch log events.",
  },
  {
    id: "observability.aws.logs.events",
    path: ["observability", "aws", "logs", "events"],
    usage: "opsy observability aws logs events --workspace <workspace> --env <env> --log-group <name> [...]",
    summary: "List CloudWatch log events.",
  },
  {
    id: "observability.aws.logs.query",
    path: ["observability", "aws", "logs", "query"],
    usage: "opsy observability aws logs query --workspace <workspace> --env <env> --log-groups <csv> --query-string <query> [...]",
    summary: "Run a CloudWatch Logs Insights query.",
  },
  {
    id: "observability.aws.metrics.list",
    path: ["observability", "aws", "metrics", "list"],
    usage: "opsy observability aws metrics list --workspace <workspace> --env <env> [...]",
    summary: "List CloudWatch metrics.",
  },
  {
    id: "observability.aws.metrics.query",
    path: ["observability", "aws", "metrics", "query"],
    usage: "opsy observability aws metrics query --workspace <workspace> --env <env> --queries <json> [...]",
    summary: "Run CloudWatch metric queries.",
  },
  {
    id: "observability.aws.alarms.list",
    path: ["observability", "aws", "alarms", "list"],
    usage: "opsy observability aws alarms list --workspace <workspace> --env <env> [...]",
    summary: "List CloudWatch alarms.",
  },
  {
    id: "observability.aws.alarms.detail",
    path: ["observability", "aws", "alarms", "detail"],
    usage: "opsy observability aws alarms detail --workspace <workspace> --env <env> --alarm-name <name>",
    summary: "Get one CloudWatch alarm.",
  },
  {
    id: "observability.aws.alarms.history",
    path: ["observability", "aws", "alarms", "history"],
    usage: "opsy observability aws alarms history --workspace <workspace> --env <env> --alarm-name <name> [...]",
    summary: "List CloudWatch alarm history.",
  },
  {
    id: "feedback.send",
    path: ["feedback", "send"],
    usage: "opsy feedback send --message <text> [--error-context <json>] [--from-llm]",
    summary: "Submit feedback to the Opsy team.",
  },
  { id: "auth.login", path: ["auth", "login"], usage: "opsy auth login --token <token> [--api-url <url>]", summary: "Store CLI credentials." },
  { id: "auth.logout", path: ["auth", "logout"], usage: "opsy auth logout", summary: "Clear stored CLI credentials." },
  { id: "auth.whoami", path: ["auth", "whoami"], usage: "opsy auth whoami", summary: "Show the current authenticated actor." },
];

const TOP_LEVEL_HELP = [
  "Opsy command surface",
  "",
  "Core nouns:",
  "  auth          Authentication commands",
  "  project       Projects (existing workspace routes and behavior)",
  "  environment   Environments inside a project",
  "  resource      Managed resources and resource lifecycle actions",
  "  change        Proposed and applied changes",
  "  provider      Provider profiles",
  "  schema        Resource schema browsing",
  "",
  "Cloud-scoped commands:",
  "  discovery aws      Discover existing AWS resources",
  "  discovery cloudflare  Discover existing Cloudflare resources",
  "  observability aws  Read CloudWatch logs, metrics, and alarms",
  "",
  "Other:",
  "  feedback send  Submit product feedback",
  "",
  'Use "opsy <noun> --help" or "opsy <noun> <action> --help" for details.',
].join("\n");

export function findCommandSpec(path: string[]): CommandSpec | undefined {
  return OPSY_COMMAND_SPECS.find((spec) => spec.path.join(" ") === path.join(" "));
}

export function listCommandSpecsForPrefix(path: string[]): CommandSpec[] {
  return OPSY_COMMAND_SPECS.filter((spec) => path.every((part, index) => spec.path[index] === part));
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
    const flagLines = exact.flags?.length
      ? `\nFlags:\n${exact.flags.map((flag) => {
        const name = `--${flag.name}${flag.value ? ` ${flag.value}` : ""}`;
        const required = flag.required ? " (required)" : "";
        return `  ${name}${required}  ${flag.description}`;
      }).join("\n")}`
      : "";
    const notes = exact.notes?.length ? `\nNotes:\n${exact.notes.map((note) => `  ${note}`).join("\n")}` : "";
    const examples = exact.examples?.length ? `\nExamples:\n${exact.examples.map((example) => `  ${example}`).join("\n")}` : "";
    return `${exact.usage}\n\n${exact.summary}${flagLines}${notes}${examples}`;
  }

  const children = listCommandSpecsForPrefix(path);
  if (children.length > 0) {
    const nextParts = [...new Set(children.map((spec) => spec.path[path.length]))].filter(Boolean);
    if (nextParts.length > 0) {
      return `${path.join(" ")}\n\nSubcommands:\n${nextParts.map((part) => `  ${part}`).join("\n")}`;
    }
  }

  return `Unknown help topic: ${path.join(" ")}`;
}

export function renderServerInstructions(): string {
  return [
    "Opsy v2: Agent-to-Infrastructure interface.",
    "",
    'Use the single "opsy" tool. The command string follows the CLI grammar exactly.',
    'Call `opsy --help` to discover the surface and `opsy <noun> <action> --help` for targeted help.',
    "",
    OPSY_DOMAIN_GUIDANCE,
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
