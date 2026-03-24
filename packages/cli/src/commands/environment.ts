import { Command } from "commander";
import { addSharedHelp, defaultCliDeps, getRootFlags, handleCliError, requireArgumentValue, requireOptionValue, type CliDeps } from "./common";
import { formatTable, output } from "../output";

export function createEnvironmentCommand(deps: CliDeps = defaultCliDeps) {
  const environmentCmd = new Command("environment").description("List, get, and create environments");

  addSharedHelp(
    environmentCmd.command("list")
      .description("List environments")
      .option("--workspace <slug>", "Workspace slug")
      .action(async function (this: Command, opts: { workspace?: string }) {
        const flags = getRootFlags(this);
        try {
          const workspace = requireOptionValue(opts.workspace, "workspace");
          const token = deps.getToken(flags);
          const apiUrl = deps.getApiUrl(flags);
          const envs = await deps.apiRequest<any[]>(`/workspaces/${workspace}/environments`, { token, apiUrl });
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
      .argument("[slug]")
      .option("--workspace <slug>", "Workspace slug")
      .action(async function (this: Command, slug: string | undefined, opts: { workspace?: string }) {
        const flags = getRootFlags(this);
        try {
          const workspace = requireOptionValue(opts.workspace, "workspace");
          const envSlug = requireArgumentValue(slug, "environment slug");
          const token = deps.getToken(flags);
          const apiUrl = deps.getApiUrl(flags);
          output(await deps.apiRequest<any>(
            `/workspaces/${workspace}/environments/${envSlug}`,
            { token, apiUrl },
          ), flags);
        } catch (error) {
          handleCliError(error, deps);
        }
      }),
    ["environment", "get"],
  );

  addSharedHelp(
    environmentCmd.command("create")
      .description("Create an environment")
      .option("--workspace <slug>", "Workspace slug")
      .option("--slug <slug>", "Environment slug")
      .action(async function (this: Command, opts: { workspace?: string; slug?: string }) {
        const flags = getRootFlags(this);
        try {
          const workspace = requireOptionValue(opts.workspace, "workspace");
          const slug = requireOptionValue(opts.slug, "slug");
          const token = deps.getToken(flags);
          const apiUrl = deps.getApiUrl(flags);
          output(await deps.apiRequest<any>(`/workspaces/${workspace}/environments`, {
            method: "POST",
            body: { slug },
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
