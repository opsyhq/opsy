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

export const OPSY_DISCOVERY_PROVIDERS = [{ id: "aws", label: "AWS" }] as const;

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
Use schema describe or get schema to inspect fields when you genuinely need it.
On update, set parentSlug to move a resource under another parent. Use parentSlug:null to move to the top level.
Use removeInputPaths:["a.b.c"] to delete nested keys while keeping deep-merge update behavior.

Groups: use type:"group" to create virtual folders. Groups auto-complete on apply and cannot be imported or forgotten.

Convenience resource wrappers:
  create resource / update resource / delete resource
  These create a change with one mutation and immediately attempt apply.
  If environment policy blocks apply, the response returns approvalRequired:true plus reviewUrl.

Efficiency:
  1. Type tokens follow Pulumi format: <provider>:<module>/<Resource>:<Resource>
  2. Prefer proposing directly and use validation errors as feedback.
  3. Batch related mutations into one change where possible.
`.trim();

export const OPSY_COMMAND_SPECS: CommandSpec[] = [
  {
    id: "list.resources",
    path: ["list", "resources"],
    usage: "opsy list resources --workspace <workspace> --env <env> [--parent <slug>] [--detailed]",
    summary: "List resources in an environment.",
    flags: flags(
      { name: "workspace", value: "<workspace>", required: true, description: "Workspace slug." },
      { name: "env", value: "<env>", required: true, description: "Environment slug." },
      { name: "parent", value: "<slug>", description: "Filter to children of one resource." },
      { name: "detailed", description: "Include full resource records instead of summary rows." },
    ),
  },
  {
    id: "list.changes",
    path: ["list", "changes"],
    usage: "opsy list changes --workspace <workspace> --env <env>",
    summary: "List recent changes.",
    flags: flags(
      { name: "workspace", value: "<workspace>", required: true, description: "Workspace slug." },
      { name: "env", value: "<env>", required: true, description: "Environment slug." },
    ),
  },
  { id: "list.workspaces", path: ["list", "workspaces"], usage: "opsy list workspaces", summary: "List workspaces." },
  {
    id: "list.envs",
    path: ["list", "envs"],
    usage: "opsy list envs --workspace <workspace>",
    summary: "List environments for a workspace.",
    flags: flags({ name: "workspace", value: "<workspace>", required: true, description: "Workspace slug." }),
  },
  { id: "list.providers", path: ["list", "providers"], usage: "opsy list providers", summary: "List provider profiles." },
  {
    id: "list.schemas",
    path: ["list", "schemas"],
    usage: "opsy list schemas --provider <provider> [--query <text>]",
    summary: "List resource schemas for a provider.",
    flags: flags(
      { name: "provider", value: "<provider>", required: true, description: "Provider package, for example aws." },
      { name: "query", value: "<text>", description: "Filter by schema token." },
    ),
  },
  {
    id: "get.resource",
    path: ["get", "resource"],
    usage: "opsy get resource <slug> --workspace <workspace> --env <env> [--live]",
    summary: "Get one resource.",
    flags: flags(
      { name: "workspace", value: "<workspace>", required: true, description: "Workspace slug." },
      { name: "env", value: "<env>", required: true, description: "Environment slug." },
      { name: "live", description: "Include live cloud state comparison." },
    ),
  },
  { id: "get.change", path: ["get", "change"], usage: "opsy get change <shortId>", summary: "Get one change with operations." },
  { id: "get.workspace", path: ["get", "workspace"], usage: "opsy get workspace <slug>", summary: "Get one workspace." },
  {
    id: "get.env",
    path: ["get", "env"],
    usage: "opsy get env <slug> --workspace <workspace>",
    summary: "Get one environment.",
    flags: flags({ name: "workspace", value: "<workspace>", required: true, description: "Workspace slug." }),
  },
  { id: "get.provider", path: ["get", "provider"], usage: "opsy get provider <id>", summary: "Get one provider profile." },
  {
    id: "get.schema",
    path: ["get", "schema"],
    usage: "opsy get schema <type-token>",
    summary: "Describe one resource schema.",
  },
  {
    id: "create.resource",
    path: ["create", "resource"],
    usage: "opsy create resource --workspace <workspace> --env <env> --slug <slug> --type <type> --inputs <json> [--parent <slug>]",
    summary: "Create one resource by proposing one mutation and immediately attempting apply.",
    examples: [
      `opsy create resource --workspace acme --env prod --slug vpc --type aws:ec2/vpc:Vpc --inputs '{"cidrBlock":"10.0.0.0/16"}'`,
    ],
    flags: flags(
      { name: "workspace", value: "<workspace>", required: true, description: "Workspace slug." },
      { name: "env", value: "<env>", required: true, description: "Environment slug." },
      { name: "slug", value: "<slug>", required: true, description: "Resource slug." },
      { name: "type", value: "<type>", required: true, description: "Resource token." },
      { name: "inputs", value: "<json>", required: true, description: "Resource inputs JSON object." },
      { name: "parent", value: "<slug>", description: "Optional parent resource slug." },
    ),
  },
  {
    id: "create.change",
    path: ["create", "change"],
    usage: "opsy create change --workspace <workspace> --env <env> [--mutations <json>] [--summary <text>]",
    summary: "Create a change, optionally with mutations.",
  },
  {
    id: "create.workspace",
    path: ["create", "workspace"],
    usage: "opsy create workspace --slug <slug> --name <name>",
    summary: "Create a workspace.",
  },
  {
    id: "create.env",
    path: ["create", "env"],
    usage: "opsy create env --workspace <workspace> --slug <slug>",
    summary: "Create an environment.",
  },
  {
    id: "create.provider",
    path: ["create", "provider"],
    usage: "opsy create provider --provider <provider> --name <name> --config <json>",
    summary: "Create a provider profile.",
  },
  {
    id: "update.resource",
    path: ["update", "resource"],
    usage: "opsy update resource <slug> --workspace <workspace> --env <env> --inputs <json>",
    summary: "Update one resource by proposing one mutation and immediately attempting apply.",
  },
  {
    id: "delete.resource",
    path: ["delete", "resource"],
    usage: "opsy delete resource <slug> --workspace <workspace> --env <env> [--recursive]",
    summary: "Delete one resource by proposing one mutation and immediately attempting apply.",
  },
  { id: "apply.change", path: ["apply", "change"], usage: "opsy apply change <shortId>", summary: "Apply a change." },
  { id: "plan.change", path: ["plan", "change"], usage: "opsy plan change <shortId>", summary: "Preview a change." },
  { id: "dismiss.change", path: ["dismiss", "change"], usage: "opsy dismiss change <shortId>", summary: "Dismiss a change." },
  {
    id: "append.change",
    path: ["append", "change"],
    usage: "opsy append change <shortId> --mutations <json> [--summary <text>]",
    summary: "Append mutations to an open change.",
  },
  { id: "retry.change", path: ["retry", "change"], usage: "opsy retry change <shortId>", summary: "Retry a failed change." },
  {
    id: "refresh.resource",
    path: ["refresh", "resource"],
    usage: "opsy refresh resource <slug> --workspace <workspace> --env <env>",
    summary: "Refresh a resource from cloud and recompute conflict state.",
  },
  {
    id: "diff.resource",
    path: ["diff", "resource"],
    usage: "opsy diff resource <slug> --workspace <workspace> --env <env>",
    summary: "Compare stored and live resource state.",
  },
  {
    id: "accept.resource",
    path: ["accept", "resource"],
    usage: "opsy accept resource <slug> --workspace <workspace> --env <env>",
    summary: "Accept recorded live state into desired inputs.",
  },
  {
    id: "push.resource",
    path: ["push", "resource"],
    usage: "opsy push resource <slug> --workspace <workspace> --env <env>",
    summary: "Promote desired state back to cloud through a change.",
  },
  {
    id: "restore.resource",
    path: ["restore", "resource"],
    usage: "opsy restore resource <slug> --workspace <workspace> --env <env> --operation <operationId>",
    summary: "Restore a resource to the state captured before an operation.",
  },
  {
    id: "history.resource",
    path: ["history", "resource"],
    usage: "opsy history resource <slug> --workspace <workspace> --env <env>",
    summary: "List operation history for one resource.",
  },
  {
    id: "discover.aws.types",
    path: ["discover", "aws", "types"],
    usage: "opsy discover aws types --workspace <workspace> --env <env> [--query <text>]",
    summary: "List AWS discovery types.",
  },
  {
    id: "discover.aws.list",
    path: ["discover", "aws", "list"],
    usage: "opsy discover aws list --workspace <workspace> --env <env> [--type <type>] [--region <region>]",
    summary: "List existing AWS resources.",
  },
  {
    id: "discover.aws.inspect",
    path: ["discover", "aws", "inspect"],
    usage: "opsy discover aws inspect --workspace <workspace> --env <env> --cloud-id <id> --type <type>",
    summary: "Inspect one AWS resource.",
  },
  {
    id: "discover.aws.import",
    path: ["discover", "aws", "import"],
    usage: "opsy discover aws import --workspace <workspace> --env <env> --items <json>",
    summary: "Import existing AWS resources into a change.",
  },
  {
    id: "observe.aws.logs.tail",
    path: ["observe", "aws", "logs", "tail"],
    usage: "opsy observe aws logs tail --workspace <workspace> --env <env> --log-group <name> [...]",
    summary: "Tail CloudWatch log events.",
  },
  {
    id: "observe.aws.logs.events",
    path: ["observe", "aws", "logs", "events"],
    usage: "opsy observe aws logs events --workspace <workspace> --env <env> --log-group <name> [...]",
    summary: "List CloudWatch log events.",
  },
  {
    id: "observe.aws.logs.groups",
    path: ["observe", "aws", "logs", "groups"],
    usage: "opsy observe aws logs groups --workspace <workspace> --env <env> [...]",
    summary: "List CloudWatch log groups.",
  },
  {
    id: "observe.aws.logs.query",
    path: ["observe", "aws", "logs", "query"],
    usage: "opsy observe aws logs query --workspace <workspace> --env <env> --log-groups <csv> --query-string <query> [...]",
    summary: "Run a CloudWatch Logs Insights query.",
  },
  {
    id: "observe.aws.metrics.list",
    path: ["observe", "aws", "metrics", "list"],
    usage: "opsy observe aws metrics list --workspace <workspace> --env <env> [...]",
    summary: "List CloudWatch metrics.",
  },
  {
    id: "observe.aws.metrics.query",
    path: ["observe", "aws", "metrics", "query"],
    usage: "opsy observe aws metrics query --workspace <workspace> --env <env> --queries <json> [...]",
    summary: "Run CloudWatch metric queries.",
  },
  {
    id: "observe.aws.alarms.list",
    path: ["observe", "aws", "alarms", "list"],
    usage: "opsy observe aws alarms list --workspace <workspace> --env <env> [...]",
    summary: "List CloudWatch alarms.",
  },
  {
    id: "observe.aws.alarms.detail",
    path: ["observe", "aws", "alarms", "detail"],
    usage: "opsy observe aws alarms detail --workspace <workspace> --env <env> --alarm-name <name>",
    summary: "Get one CloudWatch alarm.",
  },
  {
    id: "observe.aws.alarms.history",
    path: ["observe", "aws", "alarms", "history"],
    usage: "opsy observe aws alarms history --workspace <workspace> --env <env> --alarm-name <name> [...]",
    summary: "List CloudWatch alarm history.",
  },
  {
    id: "feedback.send",
    path: ["feedback", "send"],
    usage: "opsy feedback send --message <text> [--error-context <json>] [--from-llm]",
    summary: "Submit feedback to the Opsy team.",
  },
];

const TOP_LEVEL_HELP = [
  "Opsy command surface",
  "",
  "Core verbs:",
  "  list      List resources, changes, workspaces, environments, providers, or schemas",
  "  get       Fetch one resource, change, workspace, environment, provider, or schema",
  "  create    Create a resource/change/workspace/environment/provider",
  "  update    Update a resource",
  "  delete    Delete a resource",
  "  apply     Apply a change",
  "  plan      Preview a change",
  "  dismiss   Dismiss a change",
  "  append    Append mutations to a change",
  "  retry     Retry a failed change",
  "  refresh   Refresh live resource state",
  "  diff      Diff stored and live resource state",
  "  accept    Accept recorded live state for a resource",
  "  push      Push stored desired state through a change",
  "  restore   Restore a resource from operation history",
  "  history   List resource operation history",
  "",
  "Cloud-scoped commands:",
  "  discover aws  Discover existing AWS resources",
  "  observe aws   Read CloudWatch logs, metrics, and alarms",
  "",
  "Other:",
  "  feedback send  Submit product feedback",
  "  auth           Authentication commands (CLI only)",
  "",
  'Use "opsy <verb> --help" or "opsy <verb> <noun> --help" for details.',
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

  if (path[0] === "observe") {
    if (path.length === 1) {
      return `${renderObserveSupportedProviders()}\nUse "opsy observe aws --help" for AWS observe commands.`;
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

  if (path[0] === "discover") {
    if (path.length === 1) {
      return `Supported discovery providers:\n${OPSY_DISCOVERY_PROVIDERS.map((provider) => `  ${provider.id}`).join("\n")}\nUse "opsy discover aws --help" for AWS discovery commands.`;
    }
    if (path[1] !== "aws") {
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
    'Call `opsy --help` to discover the surface and `opsy <verb> <noun> --help` for targeted help.',
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
  if (positionals.length === 1) {
    return positionals;
  }

  const [verb, second, third, fourth] = positionals;
  if (verb === "list") {
    return [verb, second];
  }
  if (verb === "discover" || verb === "observe" || verb === "feedback") {
    return fourth ? [verb, second, third, fourth] : third ? [verb, second, third] : [verb, second];
  }
  return [verb, second];
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
