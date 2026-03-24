import { Command } from "commander";
import { addSharedHelp, defaultCliDeps, getRootFlags, handleCliError, type CliDeps } from "./common";
import { output } from "../output";

export function createAcceptCommand(deps: CliDeps = defaultCliDeps) {
  const acceptCmd = new Command("accept").description("Accept recorded live state");
  addSharedHelp(
    acceptCmd.command("resource")
      .description("Accept live state for one resource")
      .argument("<slug>")
      .requiredOption("--workspace <slug>", "Workspace slug")
      .requiredOption("--env <slug>", "Environment slug")
      .action(async function (this: Command, slug: string, opts: { workspace: string; env: string }) {
        const flags = getRootFlags(this);
        const token = deps.getToken(flags);
        const apiUrl = deps.getApiUrl(flags);
        try {
          output(await deps.apiRequest<any>(`/workspaces/${opts.workspace}/environments/${opts.env}/resources/${slug}/accept-live`, {
            method: "POST",
            token,
            apiUrl,
          }), flags);
        } catch (error) {
          handleCliError(error, deps);
        }
      }),
    ["accept", "resource"],
  );
  return acceptCmd;
}

export const acceptCmd = createAcceptCommand();
