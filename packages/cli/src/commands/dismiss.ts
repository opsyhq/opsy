import { Command } from "commander";
import { addSharedHelp, defaultCliDeps, getRootFlags, handleCliError, type CliDeps } from "./common";
import { output } from "../output";

export function createDismissCommand(deps: CliDeps = defaultCliDeps) {
  const dismissCmd = new Command("dismiss").description("Dismiss changes");
  addSharedHelp(
    dismissCmd.command("change")
      .description("Dismiss one change")
      .argument("<shortId>")
      .action(async function (this: Command, shortId: string) {
        const flags = getRootFlags(this);
        const token = deps.getToken(flags);
        const apiUrl = deps.getApiUrl(flags);
        try {
          output(await deps.apiRequest<any>(`/changes/${shortId}/dismiss`, { method: "POST", token, apiUrl }), flags);
        } catch (error) {
          handleCliError(error, deps);
        }
      }),
    ["dismiss", "change"],
  );
  return dismissCmd;
}

export const dismissCmd = createDismissCommand();
