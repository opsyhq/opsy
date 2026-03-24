import { Command } from "commander";
import { addSharedHelp, defaultCliDeps, getRootFlags, handleCliError, type CliDeps } from "./common";
import { output } from "../output";

export function createRefreshCommand(deps: CliDeps = defaultCliDeps) {
  const refreshCmd = new Command("refresh").description("Refresh live resource state");
  addSharedHelp(
    refreshCmd.command("resource")
      .description("Refresh one resource")
      .argument("<slug>")
      .requiredOption("--project <slug>", "Project slug")
      .requiredOption("--env <slug>", "Environment slug")
      .action(async function (this: Command, slug: string, opts: { project: string; env: string }) {
        const flags = getRootFlags(this);
        const token = deps.getToken(flags);
        const apiUrl = deps.getApiUrl(flags);
        try {
          output(await deps.apiRequest<any>(`/projects/${opts.project}/environments/${opts.env}/resources/${slug}/sync`, {
            method: "POST",
            token,
            apiUrl,
          }), flags);
        } catch (error) {
          handleCliError(error, deps);
        }
      }),
    ["refresh", "resource"],
  );
  return refreshCmd;
}

export const refreshCmd = createRefreshCommand();
