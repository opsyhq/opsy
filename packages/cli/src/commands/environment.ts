import { Command } from "commander";
import { addSharedHelp, defaultCliDeps, getRootFlags, handleCliError, type CliDeps } from "./common";
import { formatTable, output } from "../output";

export function createEnvironmentCommand(deps: CliDeps = defaultCliDeps) {
  const environmentCmd = new Command("environment").description("List, get, and create environments");

  addSharedHelp(
    environmentCmd.command("list")
      .description("List environments")
      .requiredOption("--workspace <slug>", "Project slug")
      .action(async function (this: Command, opts: { workspace: string }) {
        const flags = getRootFlags(this);
        const token = deps.getToken(flags);
        const apiUrl = deps.getApiUrl(flags);
        try {
          const envs = await deps.apiRequest<any[]>(`/workspaces/${opts.workspace}/environments`, { token, apiUrl });
          if (flags.json) return output(envs, flags);
          if (!envs.length) return deps.log("No environments found.");
          deps.log(formatTable(
            ["SLUG", "AUTO-APPLY", "CREATED"],
            envs.map((env) => [env.slug, env.autoApplyPolicy ?? "disabled", new Date(env.createdAt).toLocaleDateString()]),
          ));
        } catch (error) {
          handleCliError(error, deps);
        }
      }),
    ["environment", "list"],
  );

  addSharedHelp(
    environmentCmd.command("get")
      .description("Get one environment")
      .argument("<slug>")
      .requiredOption("--workspace <slug>", "Project slug")
      .action(async function (this: Command, slug: string, opts: { workspace: string }) {
        const flags = getRootFlags(this);
        const token = deps.getToken(flags);
        const apiUrl = deps.getApiUrl(flags);
        try {
          output(await deps.apiRequest<any>(`/workspaces/${opts.workspace}/environments/${slug}`, { token, apiUrl }), flags);
        } catch (error) {
          handleCliError(error, deps);
        }
      }),
    ["environment", "get"],
  );

  addSharedHelp(
    environmentCmd.command("create")
      .description("Create an environment")
      .requiredOption("--workspace <slug>", "Project slug")
      .requiredOption("--slug <slug>", "Environment slug")
      .action(async function (this: Command, opts: { workspace: string; slug: string }) {
        const flags = getRootFlags(this);
        const token = deps.getToken(flags);
        const apiUrl = deps.getApiUrl(flags);
        try {
          output(await deps.apiRequest<any>(`/workspaces/${opts.workspace}/environments`, {
            method: "POST",
            body: { slug: opts.slug },
            token,
            apiUrl,
          }), flags);
        } catch (error) {
          handleCliError(error, deps);
        }
      }),
    ["environment", "create"],
  );

  return environmentCmd;
}

export const environmentCmd = createEnvironmentCommand();
