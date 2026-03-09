export type CommandMeta = {
  usage: string;
  description: string;
  flags?: string[];
  examples?: string[];
};

export const COMMAND_META: Record<string, CommandMeta> = {
  "auth login": {
    description: "Authenticate with a personal access token.",
    usage: "opsy auth login --token <pat> [--api-url <url>] [--json]",
    flags: [
      "--token <pat>       Personal access token (required)",
      "--api-url <url>     Override API URL",
      "--json              Output as JSON",
    ],
    examples: ["opsy auth login --token opt_abc123"],
  },
  "auth whoami": {
    description: "Show the authenticated user.",
    usage: "opsy auth whoami [--token <pat>] [--api-url <url>] [--json]",
    flags: [
      "--token <pat>       Override token for this request",
      "--api-url <url>     Override API URL",
      "--json              Output as JSON",
    ],
    examples: ["opsy auth whoami", "opsy auth whoami --json"],
  },
  "auth logout": {
    description: "Remove stored credentials.",
    usage: "opsy auth logout [--json]",
    flags: ["--json              Output as JSON"],
    examples: ["opsy auth logout"],
  },
  "workspace list": {
    description: "List all workspaces.",
    usage: "opsy workspace list [--json]",
    flags: ["--json              Output as JSON"],
    examples: ["opsy workspace list", "opsy workspace list --json"],
  },
  "workspace get": {
    description: "Show workspace details.",
    usage: "opsy workspace get <slug> [--json]",
    flags: ["--json              Output as JSON"],
    examples: ["opsy workspace get acme"],
  },
  "workspace create": {
    description: "Create a new workspace.",
    usage: "opsy workspace create --slug <slug> --name <name> [--quiet] [--json]",
    flags: [
      "--slug <slug>       Workspace slug (required)",
      "--name <name>       Workspace display name (required)",
      "--quiet             Print only the slug",
      "--json              Output as JSON",
    ],
    examples: ["opsy workspace create --slug acme --name Acme"],
  },
  "workspace delete": {
    description: "Delete a workspace.",
    usage: "opsy workspace delete <slug> [--quiet] [--json]",
    flags: [
      "--quiet             Print only the slug",
      "--json              Output as JSON",
    ],
    examples: ["opsy workspace delete acme"],
  },
  "stack list": {
    description: "List stacks in a workspace.",
    usage: "opsy stack list --workspace <slug> [--json]",
    flags: [
      "--workspace <slug>  Workspace slug (required)",
      "--json              Output as JSON",
    ],
    examples: ["opsy stack list --workspace acme"],
  },
  "stack get": {
    description: "Show stack details and deployments.",
    usage: "opsy stack get <slug> --workspace <slug> [--json]",
    flags: [
      "--workspace <slug>  Workspace slug (required)",
      "--json              Output as JSON",
    ],
    examples: ["opsy stack get api --workspace acme"],
  },
  "stack create": {
    description: "Create a new stack.",
    usage: "opsy stack create --workspace <slug> --slug <slug> [--yaml <yaml>] [--quiet] [--json]",
    flags: [
      "--workspace <slug>  Workspace slug (required)",
      "--slug <slug>       Stack slug (required)",
      "--yaml <yaml>       Initial YAML spec",
      "--quiet             Print only the slug",
      "--json              Output as JSON",
    ],
    examples: ["opsy stack create --workspace acme --slug api"],
  },
  "stack set-notes": {
    description: "Set or clear stack notes.",
    usage: "opsy stack set-notes --workspace <slug> --stack <slug> [--notes <text> | --file <path> | stdin | --clear] [--quiet] [--json]",
    flags: [
      "--workspace <slug>  Workspace slug (required)",
      "--stack <slug>      Stack slug (required)",
      "--notes <text>      Notes content",
      "--file <path>       Read notes from file",
      "--clear             Clear existing notes",
      "--quiet             Print only the slug",
      "--json              Output as JSON",
    ],
    examples: [
      "opsy stack set-notes --workspace acme --stack api --notes 'Main API'",
      "opsy stack set-notes --workspace acme --stack api --clear",
    ],
  },
  "stack delete": {
    description: "Delete a stack.",
    usage: "opsy stack delete <slug> --workspace <slug> [--quiet] [--json]",
    flags: [
      "--workspace <slug>  Workspace slug (required)",
      "--quiet             Print only the slug",
      "--json              Output as JSON",
    ],
    examples: ["opsy stack delete api --workspace acme"],
  },
  "stack state": {
    description: "Show deployed stack state.",
    usage: "opsy stack state <slug> --workspace <slug> [--json]",
    flags: [
      "--workspace <slug>  Workspace slug (required)",
      "--json              Output as JSON",
    ],
    examples: ["opsy stack state api --workspace acme"],
  },
  "env list": {
    description: "List environments in a workspace.",
    usage: "opsy env list --workspace <slug> [--json]",
    flags: [
      "--workspace <slug>  Workspace slug (required)",
      "--json              Output as JSON",
    ],
    examples: ["opsy env list --workspace acme"],
  },
  "env create": {
    description: "Create a new environment.",
    usage: "opsy env create --workspace <slug> --slug <slug> [--quiet] [--json]",
    flags: [
      "--workspace <slug>  Workspace slug (required)",
      "--slug <slug>       Environment slug (required)",
      "--quiet             Print only the slug",
      "--json              Output as JSON",
    ],
    examples: ["opsy env create --workspace acme --slug prod"],
  },
  "env delete": {
    description: "Delete an environment.",
    usage: "opsy env delete --workspace <slug> --env <slug> [--quiet] [--json]",
    flags: [
      "--workspace <slug>  Workspace slug (required)",
      "--env <slug>        Environment slug (required)",
      "--quiet             Print only the slug",
      "--json              Output as JSON",
    ],
    examples: ["opsy env delete --workspace acme --env staging"],
  },
  "env config-get": {
    description: "Show environment config.",
    usage: "opsy env config-get --workspace <slug> --env <slug> [--json]",
    flags: [
      "--workspace <slug>  Workspace slug (required)",
      "--env <slug>        Environment slug (required)",
      "--json              Output as JSON",
    ],
    examples: ["opsy env config-get --workspace acme --env prod"],
  },
  "env config-set": {
    description: "Set environment config.",
    usage: "opsy env config-set --workspace <slug> --env <slug> [--config <json> | --file <path> | stdin] [--quiet] [--json]",
    flags: [
      "--workspace <slug>  Workspace slug (required)",
      "--env <slug>        Environment slug (required)",
      "--config <json>     Config as JSON string",
      "--file <path>       Read config from file",
      "--quiet             Print only the slug",
      "--json              Output as JSON",
    ],
    examples: ["opsy env config-set --workspace acme --env prod --file config.json"],
  },
  "draft list": {
    description: "List drafts for a stack.",
    usage: "opsy draft list --workspace <slug> --stack <slug> [--json]",
    flags: [
      "--workspace <slug>  Workspace slug (required)",
      "--stack <slug>      Stack slug (required)",
      "--json              Output as JSON",
    ],
    examples: ["opsy draft list --workspace acme --stack api"],
  },
  "draft get": {
    description: "Show draft details and spec.",
    usage: "opsy draft get <draft-short-id> [--json]",
    flags: ["--json              Output as JSON"],
    examples: ["opsy draft get deadbeef"],
  },
  "draft create": {
    description: "Create a new draft.",
    usage: "opsy draft create --workspace <slug> --stack <slug> [--name <name>] [--quiet] [--json]",
    flags: [
      "--workspace <slug>  Workspace slug (required)",
      "--stack <slug>      Stack slug (required)",
      "--name <name>       Draft name",
      "--quiet             Print only the short ID",
      "--json              Output as JSON",
    ],
    examples: ["opsy draft create --workspace acme --stack api"],
  },
  "draft write": {
    description: "Write YAML spec to a draft.",
    usage: "opsy draft write [draft-short-id] [--workspace <slug> --stack <slug>] [--yaml <yaml> | --file <path> | stdin] [--quiet] [--json]",
    flags: [
      "--workspace <slug>  Workspace slug (when no short ID given)",
      "--stack <slug>      Stack slug (when no short ID given)",
      "--yaml <yaml>       YAML spec as string",
      "--file <path>       Read YAML from file",
      "--quiet             Print only the short ID",
      "--json              Output as JSON",
    ],
    examples: [
      "cat spec.yaml | opsy draft write --workspace acme --stack api",
      "opsy draft write deadbeef --file spec.yaml",
    ],
  },
  "draft edit": {
    description: "Edit a draft with string replacement.",
    usage: "opsy draft edit [draft-short-id] [--workspace <slug> --stack <slug>] --old-string <text> --new-string <text> [--quiet] [--json]",
    flags: [
      "--workspace <slug>  Workspace slug (when no short ID given)",
      "--stack <slug>      Stack slug (when no short ID given)",
      "--old-string <text> String to find (required)",
      "--new-string <text> Replacement string (required)",
      "--quiet             Print only the short ID",
      "--json              Output as JSON",
    ],
    examples: ["opsy draft edit deadbeef --old-string 'v1.0' --new-string 'v2.0'"],
  },
  "draft validate": {
    description: "Validate a draft.",
    usage: "opsy draft validate <draft-short-id> [--quiet] [--json]",
    flags: [
      "--quiet             Print only ok/invalid",
      "--json              Output as JSON",
    ],
    examples: ["opsy draft validate deadbeef"],
  },
  "draft delete": {
    description: "Delete a draft.",
    usage: "opsy draft delete <draft-short-id> [--quiet] [--json]",
    flags: [
      "--quiet             Print only the short ID",
      "--json              Output as JSON",
    ],
    examples: ["opsy draft delete deadbeef"],
  },
  "revision list": {
    description: "List revisions for a stack.",
    usage: "opsy revision list --workspace <slug> --stack <slug> [--cursor <cursor>] [--limit <n>] [--json]",
    flags: [
      "--workspace <slug>  Workspace slug (required)",
      "--stack <slug>      Stack slug (required)",
      "--cursor <cursor>   Pagination cursor",
      "--limit <n>         Max results",
      "--json              Output as JSON",
    ],
    examples: ["opsy revision list --workspace acme --stack api"],
  },
  "revision get": {
    description: "Show revision details and spec.",
    usage: "opsy revision get [revision-number] --workspace <slug> --stack <slug> [--json]",
    flags: [
      "--workspace <slug>  Workspace slug (required)",
      "--stack <slug>      Stack slug (required)",
      "--json              Output as JSON",
    ],
    examples: [
      "opsy revision get 7 --workspace acme --stack api",
      "opsy revision get --workspace acme --stack api",
    ],
  },
  "revision delete": {
    description: "Delete a revision.",
    usage: "opsy revision delete <revision-number> --workspace <slug> --stack <slug> [--quiet] [--json]",
    flags: [
      "--workspace <slug>  Workspace slug (required)",
      "--stack <slug>      Stack slug (required)",
      "--quiet             Print only the revision ID",
      "--json              Output as JSON",
    ],
    examples: ["opsy revision delete 7 --workspace acme --stack api"],
  },
  "run get": {
    description: "Show run details.",
    usage: "opsy run get <run-id|short-id> [--json]",
    flags: ["--json              Output as JSON"],
    examples: ["opsy run get deadbeef"],
  },
  "run list": {
    description: "List runs for a workspace.",
    usage: "opsy run list --workspace <slug> [--stack <slug>] [--status <status>] [--exclude-status <status>] [--limit <n>] [--cursor <cursor>] [--json]",
    flags: [
      "--workspace <slug>          Workspace slug (required)",
      "--stack <slug>              Filter by stack",
      "--status <status>           Filter by status",
      "--exclude-status <status>   Exclude by status",
      "--limit <n>                 Max results",
      "--cursor <cursor>           Pagination cursor",
      "--json                      Output as JSON",
    ],
    examples: [
      "opsy run list --workspace acme",
      "opsy run list --workspace acme --stack api --status running",
    ],
  },
  "run apply": {
    description: "Queue an apply run.",
    usage: "opsy run apply --workspace <slug> --stack <slug> --env <slug> [--draft <short-id> | --revision <n>] [--preview-only] [--reason <text>] [--quiet] [--json]",
    flags: [
      "--workspace <slug>  Workspace slug (required)",
      "--stack <slug>      Stack slug (required)",
      "--env <slug>        Environment slug (required)",
      "--draft <short-id>  Draft to apply",
      "--revision <n>      Revision number to apply",
      "--preview-only      Preview changes without applying",
      "--reason <text>     Reason for the run",
      "--quiet             Print only the run ID",
      "--json              Output as JSON",
    ],
    examples: [
      "opsy run apply --workspace acme --stack api --env prod --draft deadbeef",
      "opsy run apply --workspace acme --stack api --env prod --revision 7 --preview-only",
    ],
  },
  "run wait": {
    description: "Wait for a run to finish.",
    usage: "opsy run wait <run-id|short-id> [--timeout-seconds <n>] [--quiet] [--json]",
    flags: [
      "--timeout-seconds <n>  Max wait time in seconds",
      "--quiet                Print only the final status",
      "--json                 Output as JSON",
    ],
    examples: ["opsy run wait deadbeef", "opsy run wait deadbeef --timeout-seconds 300"],
  },
  "run import": {
    description: "Import existing resources.",
    usage: "opsy run import --workspace <slug> --stack <slug> [--env <slug>] [--targets <json> | --file <path> | stdin] [--reason <text>] [--quiet] [--json]",
    flags: [
      "--workspace <slug>  Workspace slug (required)",
      "--stack <slug>      Stack slug (required)",
      "--env <slug>        Environment slug",
      "--targets <json>    Import targets as JSON",
      "--file <path>       Read targets from file",
      "--reason <text>     Reason for the import",
      "--quiet             Print only the run ID",
      "--json              Output as JSON",
    ],
    examples: [
      "opsy run import --workspace acme --stack api --file import.json",
      "cat targets.json | opsy run import --workspace acme --stack api --env prod",
    ],
  },
  "run cancel": {
    description: "Cancel a run.",
    usage: "opsy run cancel <run-id|short-id> [--force] [--quiet] [--json]",
    flags: [
      "--force             Force cancel",
      "--quiet             Print only the status",
      "--json              Output as JSON",
    ],
    examples: ["opsy run cancel deadbeef"],
  },
  "org list": {
    description: "List org variables.",
    usage: "opsy org list [--json]",
    flags: ["--json              Output as JSON"],
    examples: ["opsy org list"],
  },
  "org set": {
    description: "Set an org variable.",
    usage: "opsy org set <key> [--value <text> | --file <path> | stdin] [--sensitive] [--quiet] [--json]",
    flags: [
      "--value <text>      Variable value",
      "--file <path>       Read value from file",
      "--sensitive         Mark as sensitive",
      "--quiet             Print only the key",
      "--json              Output as JSON",
    ],
    examples: ["opsy org set AWS_REGION --value us-east-1"],
  },
  "org delete": {
    description: "Delete an org variable.",
    usage: "opsy org delete <key> [--quiet] [--json]",
    flags: [
      "--quiet             Print only the key",
      "--json              Output as JSON",
    ],
    examples: ["opsy org delete AWS_REGION"],
  },
  "org get-notes": {
    description: "Show org notes.",
    usage: "opsy org get-notes [--json]",
    flags: ["--json              Output as JSON"],
    examples: ["opsy org get-notes"],
  },
  "org set-notes": {
    description: "Set or clear org notes.",
    usage: "opsy org set-notes [--notes <text> | --file <path> | stdin | --clear] [--quiet] [--json]",
    flags: [
      "--notes <text>      Notes content",
      "--file <path>       Read notes from file",
      "--clear             Clear existing notes",
      "--quiet             Minimal output",
      "--json              Output as JSON",
    ],
    examples: [
      "opsy org set-notes --notes 'Team context goes here'",
      "opsy org set-notes --clear",
    ],
  },
};

export const GROUP_META: Record<string, { description: string; commands: string[] }> = {
  auth: {
    description: "Work with authentication.",
    commands: ["auth login", "auth whoami", "auth logout"],
  },
  workspace: {
    description: "Manage workspaces.",
    commands: ["workspace list", "workspace get", "workspace create", "workspace delete"],
  },
  stack: {
    description: "Manage stacks.",
    commands: ["stack list", "stack get", "stack create", "stack set-notes", "stack delete", "stack state"],
  },
  env: {
    description: "Manage environments.",
    commands: ["env list", "env create", "env delete", "env config-get", "env config-set"],
  },
  draft: {
    description: "Manage drafts.",
    commands: ["draft list", "draft get", "draft create", "draft write", "draft edit", "draft validate", "draft delete"],
  },
  revision: {
    description: "Manage revisions.",
    commands: ["revision list", "revision get", "revision delete"],
  },
  run: {
    description: "Manage runs.",
    commands: ["run get", "run list", "run apply", "run wait", "run import", "run cancel"],
  },
  org: {
    description: "Manage org variables and notes.",
    commands: ["org list", "org set", "org delete", "org get-notes", "org set-notes"],
  },
};

export function getUsageLine(command: string): string {
  const meta = COMMAND_META[command];
  if (!meta) return `opsy ${command} [flags]`;
  return meta.usage;
}

export function getHelpText(command?: string): string {
  if (!command) {
    return [
      "opsy — infrastructure management CLI",
      "",
      "USAGE",
      "  opsy <command> <subcommand> [flags]",
      "",
      "AUTH",
      "  auth login         Authenticate with a personal access token",
      "  auth whoami        Show the authenticated user",
      "  auth logout        Remove stored credentials",
      "",
      "WORKSPACES",
      "  workspace list     List all workspaces",
      "  workspace get      Show workspace details",
      "  workspace create   Create a new workspace",
      "  workspace delete   Delete a workspace",
      "",
      "STACKS",
      "  stack list         List stacks in a workspace",
      "  stack get          Show stack details and deployments",
      "  stack create       Create a new stack",
      "  stack set-notes    Set or clear stack notes",
      "  stack delete       Delete a stack",
      "  stack state        Show deployed stack state",
      "",
      "ENVIRONMENTS",
      "  env list           List environments in a workspace",
      "  env create         Create a new environment",
      "  env delete         Delete an environment",
      "  env config-get     Show environment config",
      "  env config-set     Set environment config",
      "",
      "DRAFTS",
      "  draft list         List drafts for a stack",
      "  draft get          Show draft details and spec",
      "  draft create       Create a new draft",
      "  draft write        Write YAML spec to a draft",
      "  draft edit         Edit a draft with string replacement",
      "  draft validate     Validate a draft",
      "  draft delete       Delete a draft",
      "",
      "REVISIONS",
      "  revision list      List revisions for a stack",
      "  revision get       Show revision details and spec",
      "  revision delete    Delete a revision",
      "",
      "RUNS",
      "  run get            Show run details",
      "  run list           List runs for a workspace",
      "  run apply          Queue an apply run",
      "  run wait           Wait for a run to finish",
      "  run import         Import existing resources",
      "  run cancel         Cancel a run",
      "",
      "ORG",
      "  org list           List org variables",
      "  org set            Set an org variable",
      "  org delete         Delete an org variable",
      "  org get-notes      Show org notes",
      "  org set-notes      Set or clear org notes",
      "",
      "FLAGS",
      "  --json             Output as JSON",
      "  --quiet            Minimal output (IDs only)",
      "  --help, -h         Show help",
    ].join("\n");
  }

  // Group-level help
  const group = GROUP_META[command];
  if (group) {
    const lines: string[] = [group.description, "", "COMMANDS"];
    for (const cmd of group.commands) {
      const meta = COMMAND_META[cmd];
      const padded = cmd.padEnd(20);
      lines.push(`  ${padded} ${meta?.description ?? ""}`);
    }
    lines.push("", `Run opsy ${command} <command> --help for more information.`);
    return lines.join("\n");
  }

  // Command-level help
  const meta = COMMAND_META[command];
  if (meta) {
    const lines: string[] = [meta.description, "", "USAGE", `  ${meta.usage}`];
    if (meta.flags && meta.flags.length > 0) {
      lines.push("", "FLAGS");
      for (const flag of meta.flags) {
        lines.push(`  ${flag}`);
      }
    }
    if (meta.examples && meta.examples.length > 0) {
      lines.push("", "EXAMPLES");
      for (const example of meta.examples) {
        lines.push(`  ${example}`);
      }
    }
    return lines.join("\n");
  }

  return `Usage: opsy ${command} [flags]`;
}
