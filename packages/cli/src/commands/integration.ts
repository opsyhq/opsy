import { Command } from "commander";
import { addSharedHelp, defaultCliDeps, getRootFlags, handleCliError, type CliDeps } from "./common";
import { formatTable, output } from "../output";

function parseJson(value: string) {
  return JSON.parse(value);
}

export function createIntegrationCommand(deps: CliDeps = defaultCliDeps) {
  const integrationCmd = new Command("integration").description("List, get, and create integrations");

  addSharedHelp(
    integrationCmd.command("list")
      .description("List integrations")
      .action(async function (this: Command) {
        const flags = getRootFlags(this);
        const token = deps.getToken(flags);
        const apiUrl = deps.getApiUrl(flags);
        try {
          const integrations = await deps.apiRequest<any[]>("/integrations", { token, apiUrl });
          if (flags.json) return output(integrations, flags);
          if (!integrations.length) return deps.log("No integrations found.");
          deps.log(formatTable(
            ["ID", "PROVIDER", "NAME"],
            integrations.map((integration) => [integration.id.slice(0, 8), integration.providerPkg, integration.profileName]),
          ));
        } catch (error) {
          handleCliError(error, deps);
        }
      }),
    ["integration", "list"],
  );

  addSharedHelp(
    integrationCmd.command("get")
      .description("Get one integration")
      .argument("<id>")
      .action(async function (this: Command, id: string) {
        const flags = getRootFlags(this);
        const token = deps.getToken(flags);
        const apiUrl = deps.getApiUrl(flags);
        try {
          output(await deps.apiRequest<any>(`/integrations/${id}`, { token, apiUrl }), flags);
        } catch (error) {
          handleCliError(error, deps);
        }
      }),
    ["integration", "get"],
  );

  addSharedHelp(
    integrationCmd.command("create")
      .description("Create an integration")
      .requiredOption("--provider <pkg>", "Provider package")
      .requiredOption("--name <name>", "Integration name")
      .requiredOption("--config <json>", "Provider config JSON")
      .action(async function (this: Command, opts: { provider: string; name: string; config: string }) {
        const flags = getRootFlags(this);
        const token = deps.getToken(flags);
        const apiUrl = deps.getApiUrl(flags);
        try {
          output(await deps.apiRequest<any>("/integrations", {
            method: "POST",
            body: { providerPkg: opts.provider, profileName: opts.name, config: parseJson(opts.config) },
            token,
            apiUrl,
          }), flags);
        } catch (error) {
          handleCliError(error, deps);
        }
      }),
    ["integration", "create"],
  );

  return integrationCmd;
}

export const integrationCmd = createIntegrationCommand();
