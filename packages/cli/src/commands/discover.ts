import { Command } from "commander";
import { DISCOVERY_PROVIDERS, getUnsupportedDiscoveryProviderMessage } from "../catalog";
import { getToken, getApiUrl } from "../config";
import { apiRequest } from "../client";
import { formatTable, output } from "../output";

type GlobalFlags = {
  token?: string;
  apiUrl?: string;
  json?: boolean;
  quiet?: boolean;
};

type DiscoverDeps = {
  apiRequest: typeof apiRequest;
  getToken: typeof getToken;
  getApiUrl: typeof getApiUrl;
  log: (message?: string) => void;
  error: (message?: string) => void;
  exit: (code: number) => never;
};

const defaultDeps: DiscoverDeps = {
  apiRequest,
  getToken,
  getApiUrl,
  log: (message?: string) => console.log(message),
  error: (message?: string) => console.error(message),
  exit: (code: number) => process.exit(code),
};

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

function handleCliError(error: unknown, deps: DiscoverDeps): never {
  deps.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
  return deps.exit(1);
}

export function createDiscoverCommand(deps: DiscoverDeps = defaultDeps) {
  const discoverCmd = new Command("discover")
    .description("Provider-scoped resource discovery")
    .argument("[provider]")
    .argument("[args...]");

  discoverCmd.action((provider?: string) => {
    if (!provider) {
      deps.log(formatSupportedDiscoveryProviders());
      deps.log('Use "opsy discover aws --help" for AWS discovery commands.');
      return;
    }

    deps.error(`Error: ${getUnsupportedDiscoveryProviderMessage(provider)}`);
    deps.exit(1);
  });

  const awsCmd = new Command("aws")
    .description("Discover existing AWS resources");

  awsCmd.action(function () {
    deps.log(this.helpInformation());
  });

  awsCmd
    .command("types")
    .description("List AWS resource types that support discovery")
    .requiredOption("--workspace <slug>", "Workspace slug")
    .requiredOption("--env <slug>", "Environment slug")
    .option("--query <text>", "Filter by resource type")
    .action(async function (this: Command, opts: { workspace: string; env: string; query?: string }) {
      const flags = getRootFlags(this);
      const token = deps.getToken(flags);
      const apiUrl = deps.getApiUrl(flags);
      const path = `/workspaces/${opts.workspace}/environments/${opts.env}/discover/aws/types${buildQuery({ query: opts.query })}`;

      try {
        const types = await deps.apiRequest<Array<{ reType: string; pulumiType: string }>>(path, { token, apiUrl });
        if (flags.json) return output(types, flags);
        if (!types.length) {
          deps.log("No AWS discovery types found.");
          return;
        }
        deps.log(formatTable(
          ["AWS TYPE", "PULUMI TYPE"],
          types.map((type) => [type.reType, type.pulumiType]),
        ));
      } catch (error) {
        handleCliError(error, deps);
      }
    });

  awsCmd
    .command("list")
    .description("List existing AWS resources")
    .requiredOption("--workspace <slug>", "Workspace slug")
    .requiredOption("--env <slug>", "Environment slug")
    .option("--type <reType>", "Filter by AWS Resource Explorer type")
    .option("--region <region>", "Filter by AWS region")
    .option("--profile <profileId>", "Use a specific AWS provider profile")
    .action(async function (this: Command, opts: { workspace: string; env: string; type?: string; region?: string; profile?: string }) {
      const flags = getRootFlags(this);
      const token = deps.getToken(flags);
      const apiUrl = deps.getApiUrl(flags);
      const path = `/workspaces/${opts.workspace}/environments/${opts.env}/discover/aws${buildQuery({
        type: opts.type,
        region: opts.region,
        profileId: opts.profile,
      })}`;

      try {
        const resources = await deps.apiRequest<Array<{ name: string; cloudId: string; reType: string; region: string; service: string }>>(path, { token, apiUrl });
        if (flags.json) return output(resources, flags);
        if (!resources.length) {
          deps.log("No AWS resources found.");
          return;
        }
        deps.log(formatTable(
          ["NAME", "CLOUD ID", "TYPE", "REGION", "SERVICE"],
          resources.map((resource) => [resource.name, resource.cloudId, resource.reType, resource.region, resource.service]),
        ));
      } catch (error) {
        handleCliError(error, deps);
      }
    });

  awsCmd
    .command("inspect")
    .description("Inspect a single AWS resource")
    .requiredOption("--workspace <slug>", "Workspace slug")
    .requiredOption("--env <slug>", "Environment slug")
    .requiredOption("--cloud-id <id>", "AWS cloud ID")
    .requiredOption("--type <type>", "Pulumi token or AWS Resource Explorer type")
    .option("--profile <profileId>", "Use a specific AWS provider profile")
    .action(async function (this: Command, opts: { workspace: string; env: string; cloudId: string; type: string; profile?: string }) {
      const flags = getRootFlags(this);
      const token = deps.getToken(flags);
      const apiUrl = deps.getApiUrl(flags);
      const path = `/workspaces/${opts.workspace}/environments/${opts.env}/discover/aws/inspect${buildQuery({
        cloudId: opts.cloudId,
        type: opts.type,
        profileId: opts.profile,
      })}`;

      try {
        const detail = await deps.apiRequest<unknown>(path, { token, apiUrl });
        output(detail, flags);
      } catch (error) {
        handleCliError(error, deps);
      }
    });

  awsCmd
    .command("import")
    .description("Import discovered AWS resources")
    .requiredOption("--workspace <slug>", "Workspace slug")
    .requiredOption("--env <slug>", "Environment slug")
    .requiredOption("--items <json>", "JSON array of {cloudId, type, slug}")
    .action(async function (this: Command, opts: { workspace: string; env: string; items: string }) {
      const flags = getRootFlags(this);
      const token = deps.getToken(flags);
      const apiUrl = deps.getApiUrl(flags);

      try {
        const items = JSON.parse(opts.items);
        const result = await deps.apiRequest<any>(
          `/workspaces/${opts.workspace}/environments/${opts.env}/discover/aws/import`,
          { method: "POST", body: { items }, token, apiUrl },
        );
        if (flags.json) return output(result, flags);
        deps.log(`Change ${result.change.shortId} created with ${result.operations.length} AWS import operation(s).`);
      } catch (error) {
        handleCliError(error, deps);
      }
    });

  discoverCmd.addCommand(awsCmd);

  return discoverCmd;
}

export const discoverCmd = createDiscoverCommand();
