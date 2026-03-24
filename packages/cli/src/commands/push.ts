import { Command } from "commander";
import { addSharedHelp, defaultCliDeps, getRootFlags, handleCliError, type CliDeps } from "./common";
import { output } from "../output";

export function createPushCommand(deps: CliDeps = defaultCliDeps) {
  const pushCmd = new Command("push").description("Push desired resource state through a change");
  addSharedHelp(
    pushCmd.command("resource")
      .description("Push one resource")
      .argument("<slug>")
      .requiredOption("--project <slug>", "Project slug")
      .requiredOption("--env <slug>", "Environment slug")
      .action(async function (this: Command, slug: string, opts: { project: string; env: string }) {
        const flags = getRootFlags(this);
        const token = deps.getToken(flags);
        const apiUrl = deps.getApiUrl(flags);
        try {
          output(await deps.apiRequest<any>(`/projects/${opts.project}/environments/${opts.env}/resources/${slug}/promote-current`, {
            method: "POST",
            token,
            apiUrl,
          }), flags);
        } catch (error) {
          handleCliError(error, deps);
        }
      }),
    ["push", "resource"],
  );
  return pushCmd;
}

export const pushCmd = createPushCommand();
