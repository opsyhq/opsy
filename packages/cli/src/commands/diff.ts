import { Command } from "commander";
import { addSharedHelp, defaultCliDeps, getRootFlags, handleCliError, type CliDeps } from "./common";
import { output } from "../output";

export function createDiffCommand(deps: CliDeps = defaultCliDeps) {
  const diffCmd = new Command("diff").description("Diff stored and live resource state");
  addSharedHelp(
    diffCmd.command("resource")
      .description("Diff one resource")
      .argument("<slug>")
      .requiredOption("--project <slug>", "Project slug")
      .requiredOption("--env <slug>", "Environment slug")
      .action(async function (this: Command, slug: string, opts: { project: string; env: string }) {
        const flags = getRootFlags(this);
        const token = deps.getToken(flags);
        const apiUrl = deps.getApiUrl(flags);
        try {
          output(await deps.apiRequest<any>(`/projects/${opts.project}/environments/${opts.env}/resources/${slug}/diff`, { token, apiUrl }), flags);
        } catch (error) {
          handleCliError(error, deps);
        }
      }),
    ["diff", "resource"],
  );
  return diffCmd;
}

export const diffCmd = createDiffCommand();
