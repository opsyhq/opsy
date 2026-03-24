import { Command } from "commander";
import { addSharedHelp, defaultCliDeps, getRootFlags, handleCliError, type CliDeps } from "./common";
import { formatTable, output } from "../output";

export function createWorkspaceCommand(deps: CliDeps = defaultCliDeps) {
  const workspaceCmd = new Command("workspace").description("List, get, and create workspaces");

  addSharedHelp(
    workspaceCmd.command("list")
      .description("List workspaces")
      .action(async function (this: Command) {
        const flags = getRootFlags(this);
        const token = deps.getToken(flags);
        const apiUrl = deps.getApiUrl(flags);
        try {
          const workspaces = await deps.apiRequest<any[]>("/workspaces", { token, apiUrl });
          if (flags.json) return output(workspaces, flags);
          if (!workspaces.length) return deps.log("No workspaces found.");
          deps.log(formatTable(
            ["SLUG", "NAME", "CREATED"],
            workspaces.map((workspace) => [workspace.slug, workspace.name, new Date(workspace.createdAt).toLocaleDateString()]),
          ));
        } catch (error) {
          handleCliError(error, deps);
        }
      }),
    ["workspace", "list"],
  );

  addSharedHelp(
    workspaceCmd.command("get")
      .description("Get one workspace")
      .argument("[slug]")
      .action(async function (this: Command, slug?: string) {
        const flags = getRootFlags(this);
        try {
          if (!slug) {
            throw new Error("Missing workspace slug.");
          }
          const token = deps.getToken(flags);
          const apiUrl = deps.getApiUrl(flags);
          output(await deps.apiRequest<any>(`/workspaces/${slug}`, { token, apiUrl }), flags);
        } catch (error) {
          handleCliError(error, deps);
        }
      }),
    ["workspace", "get"],
  );

  addSharedHelp(
    workspaceCmd.command("create")
      .description("Create a workspace")
      .option("--slug <slug>", "Workspace slug")
      .option("--name <name>", "Workspace name")
      .action(async function (this: Command, opts: { slug?: string; name?: string }) {
        const flags = getRootFlags(this);
        try {
          if (!opts.slug) {
            throw new Error("Missing --slug.");
          }
          if (!opts.name) {
            throw new Error("Missing --name.");
          }
          const token = deps.getToken(flags);
          const apiUrl = deps.getApiUrl(flags);
          output(await deps.apiRequest<any>("/workspaces", {
            method: "POST",
            body: { slug: opts.slug, name: opts.name },
            token,
            apiUrl,
          }), flags);
        } catch (error) {
          handleCliError(error, deps);
        }
      }),
    ["workspace", "create"],
  );

  return workspaceCmd;
}

export const workspaceCmd = createWorkspaceCommand();
