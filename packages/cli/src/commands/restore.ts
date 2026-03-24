import { Command } from "commander";
import { addSharedHelp, defaultCliDeps, getRootFlags, handleCliError, type CliDeps } from "./common";
import { output } from "../output";

export function createRestoreCommand(deps: CliDeps = defaultCliDeps) {
  const restoreCmd = new Command("restore").description("Restore resource state");
  addSharedHelp(
    restoreCmd.command("resource")
      .description("Restore one resource from an operation snapshot")
      .argument("<slug>")
      .requiredOption("--workspace <slug>", "Workspace slug")
      .requiredOption("--env <slug>", "Environment slug")
      .requiredOption("--operation <id>", "Operation id")
      .action(async function (this: Command, slug: string, opts: { workspace: string; env: string; operation: string }) {
        const flags = getRootFlags(this);
        const token = deps.getToken(flags);
        const apiUrl = deps.getApiUrl(flags);
        try {
          output(await deps.apiRequest<any>(`/workspaces/${opts.workspace}/environments/${opts.env}/resources/${slug}/restore`, {
            method: "POST",
            body: { operationId: opts.operation },
            token,
            apiUrl,
          }), flags);
        } catch (error) {
          handleCliError(error, deps);
        }
      }),
    ["restore", "resource"],
  );
  return restoreCmd;
}

export const restoreCmd = createRestoreCommand();
