import { Command } from "commander";
import { DISCOVERY_PROVIDERS, getUnsupportedDiscoveryProviderMessage } from "../catalog";
import { getApiUrl, getEnv, getToken, getWorkspace } from "../config";
import { apiRequest } from "../client";
import { formatTable, output } from "../output";

type GlobalFlags = {
  token?: string;
  apiUrl?: string;
  workspace?: string;
  env?: string;
  json?: boolean;
  quiet?: boolean;
};

type DiscoveryDeps = {
  apiRequest: typeof apiRequest;
  getToken: typeof getToken;
  getApiUrl: typeof getApiUrl;
  log: (message?: string) => void;
  error: (message?: string) => void;
  exit: (code: number) => never;
};

type DiscoveryTypeRow = {
  providerType: string;
  pulumiType: string | undefined;
};

type DiscoveryResourceRow = {
  displayName: string;
  providerId: string;
  providerType: string;
  location: string | null;
  scope: Record<string, string | null> | null;
  pulumiType: string | undefined;
  importId?: string;
};

type DiscoveryProviderCommandConfig = {
  id: string;
  label: string;
  typeHelp: string;
  inspectFlag: string;
  inspectFlagDescription: string;
};

const defaultDeps: DiscoveryDeps = {
  apiRequest,
  getToken,
  getApiUrl,
  log: (message?: string) => console.log(message),
  error: (message?: string) => console.error(message),
  exit: (code: number) => process.exit(code),
};

const discoveryProviderConfigs: DiscoveryProviderCommandConfig[] = [
  {
    id: "aws",
    label: "AWS",
    typeHelp: "Filter by AWS discovery type or Pulumi token",
    inspectFlag: "cloud-id",
    inspectFlagDescription: "AWS cloud ID",
  },
  {
    id: "cloudflare",
    label: "Cloudflare",
    typeHelp: "Filter by Cloudflare discovery type or Pulumi token",
    inspectFlag: "provider-id",
    inspectFlagDescription: "Cloudflare provider ID",
  },
];

export function formatSupportedDiscoveryProviders(): string {
  return `Supported discovery providers:\n${DISCOVERY_PROVIDERS.map((provider) => `  ${provider.id}`).join("\n")}`;
}

function getRootFlags(command: Command): GlobalFlags {
  let current = command;
  while (current.parent) current = current.parent;
  return current.opts<GlobalFlags>();
}

function buildQuery(params: Record<string, string | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

function handleCliError(error: unknown, deps: DiscoveryDeps): never {
  deps.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
  return deps.exit(1);
}

function requireWorkspaceValue(command: Command, value?: string): string {
  const resolved = getWorkspace({ workspace: value ?? getRootFlags(command).workspace });
  if (!resolved) {
    throw new Error("Missing --workspace.");
  }
  return resolved;
}

function requireEnvValue(command: Command, value?: string): string {
  const resolved = getEnv({ env: value ?? getRootFlags(command).env });
  if (!resolved) {
    throw new Error("Missing --env.");
  }
  return resolved;
}

function formatScope(scope: Record<string, string | null> | null): string {
  if (!scope) return "global";
  const parts = Object.entries(scope)
    .filter(([, value]) => typeof value === "string" && value.length > 0)
    .map(([key, value]) => `${key}:${value}`);
  return parts.length > 0 ? parts.join(", ") : "global";
}

function getInspectOptionValue(opts: Record<string, string>, flagName: string): string | undefined {
  const camelKey = flagName.replace(/-([a-z])/g, (_, char) => char.toUpperCase());
  return opts[camelKey] ?? opts.providerId ?? opts.cloudId;
}

function addProviderDiscoveryCommands(
  discoveryCmd: Command,
  deps: DiscoveryDeps,
  config: DiscoveryProviderCommandConfig,
) {
  const providerCmd = new Command(config.id)
    .description(`Discover existing ${config.label} resources`);

  providerCmd.action(function () {
    deps.log(this.helpInformation());
  });

  providerCmd
    .command("types")
    .description(`List ${config.label} resource types that support discovery`)
    .option("--workspace <slug>", "Workspace slug")
    .option("--env <slug>", "Environment slug")
    .option("--query <text>", "Filter by resource type")
    .action(async function (this: Command, opts: { workspace?: string; env?: string; query?: string }) {
      const flags = getRootFlags(this);
      const token = deps.getToken(flags);
      const apiUrl = deps.getApiUrl(flags);

      try {
        const workspace = requireWorkspaceValue(this, opts.workspace);
        const env = requireEnvValue(this, opts.env);
        const path = `/workspaces/${workspace}/environments/${env}/discover/${config.id}/types${buildQuery({ query: opts.query })}`;
        const types = await deps.apiRequest<DiscoveryTypeRow[]>(path, { token, apiUrl });
        if (flags.json) return output(types, flags);
        if (!types.length) {
          deps.log(`No ${config.label} discovery types found.`);
          return;
        }
        deps.log(formatTable(
          ["TYPE", "PULUMI TYPE"],
          types.map((type) => [type.providerType, type.pulumiType ?? "-"]),
        ));
      } catch (error) {
        handleCliError(error, deps);
      }
    });

  providerCmd
    .command("list")
    .description(`List existing ${config.label} resources`)
    .option("--workspace <slug>", "Workspace slug")
    .option("--env <slug>", "Environment slug")
    .option("--type <type>", config.typeHelp)
    .option("--location <location>", "Filter by discovery location")
    .option("--region <region>", "AWS-only alias for --location")
    .option("--profile <profileId>", `Use a specific ${config.label} provider profile`)
    .action(async function (
      this: Command,
      opts: { workspace?: string; env?: string; type?: string; location?: string; region?: string; profile?: string },
    ) {
      const flags = getRootFlags(this);
      const token = deps.getToken(flags);
      const apiUrl = deps.getApiUrl(flags);

      try {
        const workspace = requireWorkspaceValue(this, opts.workspace);
        const env = requireEnvValue(this, opts.env);
        const location = opts.location ?? opts.region;
        const path = `/workspaces/${workspace}/environments/${env}/discover/${config.id}${buildQuery({
          type: opts.type,
          location,
          profileId: opts.profile,
        })}`;
        const resources = await deps.apiRequest<DiscoveryResourceRow[]>(path, { token, apiUrl });
        if (flags.json) return output(resources, flags);
        if (!resources.length) {
          deps.log(`No ${config.label} resources found.`);
          return;
        }
        deps.log(formatTable(
          ["NAME", "PROVIDER ID", "TYPE", "LOCATION", "SCOPE"],
          resources.map((resource) => [
            resource.displayName,
            resource.providerId,
            resource.providerType,
            resource.location ?? "global",
            formatScope(resource.scope),
          ]),
        ));
      } catch (error) {
        handleCliError(error, deps);
      }
    });

  providerCmd
    .command("inspect")
    .description(`Inspect a single ${config.label} resource`)
    .option("--workspace <slug>", "Workspace slug")
    .option("--env <slug>", "Environment slug")
    .requiredOption(`--${config.inspectFlag} <id>`, config.inspectFlagDescription)
    .requiredOption("--type <type>", "Pulumi token or discovery type")
    .option("--profile <profileId>", `Use a specific ${config.label} provider profile`)
    .action(async function (
      this: Command,
      opts: { workspace?: string; env?: string; type: string; profile?: string } & Record<string, string | undefined>,
    ) {
      const flags = getRootFlags(this);
      const token = deps.getToken(flags);
      const apiUrl = deps.getApiUrl(flags);

      try {
        const workspace = requireWorkspaceValue(this, opts.workspace);
        const env = requireEnvValue(this, opts.env);
        const providerId = getInspectOptionValue(opts as Record<string, string>, config.inspectFlag);
        const path = `/workspaces/${workspace}/environments/${env}/discover/${config.id}/inspect${buildQuery({
          providerId,
          type: opts.type,
          profileId: opts.profile,
        })}`;
        const detail = await deps.apiRequest<unknown>(path, { token, apiUrl });
        output(detail, flags);
      } catch (error) {
        handleCliError(error, deps);
      }
    });

  providerCmd
    .command("import")
    .description(`Import discovered ${config.label} resources`)
    .option("--workspace <slug>", "Workspace slug")
    .option("--env <slug>", "Environment slug")
    .requiredOption("--items <json>", "JSON array of {providerId, type, slug, importId?}")
    .action(async function (this: Command, opts: { workspace?: string; env?: string; items: string }) {
      const flags = getRootFlags(this);
      const token = deps.getToken(flags);
      const apiUrl = deps.getApiUrl(flags);

      try {
        const workspace = requireWorkspaceValue(this, opts.workspace);
        const env = requireEnvValue(this, opts.env);
        const items = JSON.parse(opts.items);
        const result = await deps.apiRequest<any>(
          `/workspaces/${workspace}/environments/${env}/discover/${config.id}/import`,
          { method: "POST", body: { items }, token, apiUrl },
        );
        if (flags.json) return output(result, flags);
        deps.log(`Change ${result.change.shortId} created with ${result.operations.length} ${config.label} import operation(s).`);
      } catch (error) {
        handleCliError(error, deps);
      }
    });

  discoveryCmd.addCommand(providerCmd);
}

export function createDiscoveryCommand(deps: DiscoveryDeps = defaultDeps) {
  const discoveryCmd = new Command("discovery")
    .description("Provider-scoped resource discovery")
    .argument("[provider]")
    .argument("[args...]");

  discoveryCmd.action((provider?: string) => {
    if (!provider) {
      deps.log(formatSupportedDiscoveryProviders());
      deps.log('Use "opsy discovery <provider> --help" for provider-specific discovery commands.');
      return;
    }

    deps.error(`Error: ${getUnsupportedDiscoveryProviderMessage(provider)}`);
    deps.exit(1);
  });

  for (const config of discoveryProviderConfigs) {
    addProviderDiscoveryCommands(discoveryCmd, deps, config);
  }

  return discoveryCmd;
}

export const discoveryCmd = createDiscoveryCommand();
