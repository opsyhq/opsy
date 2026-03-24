import { Command } from "commander";
import { addSharedHelp, defaultCliDeps, getRootFlags, handleCliError, type CliDeps } from "./common";
import { output } from "../output";

export function createPlanCommand(deps: CliDeps = defaultCliDeps) {
  const planCmd = new Command("plan").description("Preview changes");
  addSharedHelp(
    planCmd.command("change")
      .description("Preview one change")
      .argument("<shortId>")
      .action(async function (this: Command, shortId: string) {
        const flags = getRootFlags(this);
        const token = deps.getToken(flags);
        const apiUrl = deps.getApiUrl(flags);
        try {
          output(await deps.apiRequest<any>(`/changes/${shortId}/preview`, { method: "POST", token, apiUrl }), flags);
        } catch (error) {
          handleCliError(error, deps);
        }
      }),
    ["plan", "change"],
  );
  return planCmd;
}

export const planCmd = createPlanCommand();
