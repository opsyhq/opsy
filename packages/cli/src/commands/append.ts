import { Command } from "commander";
import { addSharedHelp, defaultCliDeps, getRootFlags, handleCliError, type CliDeps } from "./common";
import { output } from "../output";

export function createAppendCommand(deps: CliDeps = defaultCliDeps) {
  const appendCmd = new Command("append").description("Append mutations to changes");
  addSharedHelp(
    appendCmd.command("change")
      .description("Append mutations to one change")
      .argument("<shortId>")
      .requiredOption("--mutations <json>", "Mutation array")
      .option("--summary <text>", "Change summary override")
      .action(async function (this: Command, shortId: string, opts: { mutations: string; summary?: string }) {
        const flags = getRootFlags(this);
        const token = deps.getToken(flags);
        const apiUrl = deps.getApiUrl(flags);
        try {
          output(await deps.apiRequest<any>(`/changes/${shortId}/mutations`, {
            method: "POST",
            body: { mutations: JSON.parse(opts.mutations), summary: opts.summary },
            token,
            apiUrl,
          }), flags);
        } catch (error) {
          handleCliError(error, deps);
        }
      }),
    ["append", "change"],
  );
  return appendCmd;
}

export const appendCmd = createAppendCommand();
