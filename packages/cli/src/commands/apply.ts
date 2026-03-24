import { Command } from "commander";
import { addSharedHelp, defaultCliDeps, getRootFlags, handleCliError, type CliDeps } from "./common";
import { output } from "../output";

export function createApplyCommand(deps: CliDeps = defaultCliDeps) {
  const applyCmd = new Command("apply").description("Apply changes");

  addSharedHelp(
    applyCmd.command("change")
      .description("Apply one change")
      .argument("<shortId>")
      .action(async function (this: Command, shortId: string) {
        const flags = getRootFlags(this);
        const token = deps.getToken(flags);
        const apiUrl = deps.getApiUrl(flags);
        try {
          const result = await deps.apiRequest<any>(`/changes/${shortId}/apply`, { method: "POST", token, apiUrl });
          if (flags.json) return output(result, flags);
          if (result.approvalRequired) {
            deps.log(`Manual approval required for change ${result.change.shortId}.`);
            deps.log(`Review: ${result.reviewUrl}`);
            return;
          }
          output(result, flags);
        } catch (error) {
          handleCliError(error, deps);
        }
      }),
    ["apply", "change"],
  );

  return applyCmd;
}

export const applyCmd = createApplyCommand();
