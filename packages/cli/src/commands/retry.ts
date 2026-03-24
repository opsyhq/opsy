import { Command } from "commander";
import { addSharedHelp, defaultCliDeps, getRootFlags, handleCliError, type CliDeps } from "./common";
import { output } from "../output";

export function createRetryCommand(deps: CliDeps = defaultCliDeps) {
  const retryCmd = new Command("retry").description("Retry failed changes");
  addSharedHelp(
    retryCmd.command("change")
      .description("Retry one failed change")
      .argument("<shortId>")
      .action(async function (this: Command, shortId: string) {
        const flags = getRootFlags(this);
        const token = deps.getToken(flags);
        const apiUrl = deps.getApiUrl(flags);
        try {
          output(await deps.apiRequest<any>(`/changes/${shortId}/retry`, { method: "POST", token, apiUrl }), flags);
        } catch (error) {
          handleCliError(error, deps);
        }
      }),
    ["retry", "change"],
  );
  return retryCmd;
}

export const retryCmd = createRetryCommand();
