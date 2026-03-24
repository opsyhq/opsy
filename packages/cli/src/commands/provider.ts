import { Command } from "commander";
import { addSharedHelp, defaultCliDeps, getRootFlags, handleCliError, type CliDeps } from "./common";
import { formatTable, output } from "../output";

function parseJson(value: string) {
  return JSON.parse(value);
}

export function createProviderCommand(deps: CliDeps = defaultCliDeps) {
  const providerCmd = new Command("provider").description("List, get, and create provider profiles");

  addSharedHelp(
    providerCmd.command("list")
      .description("List provider profiles")
      .action(async function (this: Command) {
        const flags = getRootFlags(this);
        const token = deps.getToken(flags);
        const apiUrl = deps.getApiUrl(flags);
        try {
          const providers = await deps.apiRequest<any[]>("/providers", { token, apiUrl });
          if (flags.json) return output(providers, flags);
          if (!providers.length) return deps.log("No provider profiles.");
          deps.log(formatTable(
            ["ID", "PROVIDER", "PROFILE"],
            providers.map((provider) => [provider.id.slice(0, 8), provider.providerPkg, provider.profileName]),
          ));
        } catch (error) {
          handleCliError(error, deps);
        }
      }),
    ["provider", "list"],
  );

  addSharedHelp(
    providerCmd.command("get")
      .description("Get one provider profile")
      .argument("<id>")
      .action(async function (this: Command, id: string) {
        const flags = getRootFlags(this);
        const token = deps.getToken(flags);
        const apiUrl = deps.getApiUrl(flags);
        try {
          output(await deps.apiRequest<any>(`/providers/${id}`, { token, apiUrl }), flags);
        } catch (error) {
          handleCliError(error, deps);
        }
      }),
    ["provider", "get"],
  );

  addSharedHelp(
    providerCmd.command("create")
      .description("Create a provider profile")
      .requiredOption("--provider <pkg>", "Provider package")
      .requiredOption("--name <name>", "Profile name")
      .requiredOption("--config <json>", "Provider config JSON")
      .action(async function (this: Command, opts: { provider: string; name: string; config: string }) {
        const flags = getRootFlags(this);
        const token = deps.getToken(flags);
        const apiUrl = deps.getApiUrl(flags);
        try {
          output(await deps.apiRequest<any>("/providers", {
            method: "POST",
            body: { providerPkg: opts.provider, profileName: opts.name, config: parseJson(opts.config) },
            token,
            apiUrl,
          }), flags);
        } catch (error) {
          handleCliError(error, deps);
        }
      }),
    ["provider", "create"],
  );

  return providerCmd;
}

export const providerCmd = createProviderCommand();
