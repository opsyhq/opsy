import { Command } from "commander";
import { addSharedHelp, defaultCliDeps, getRootFlags, handleCliError, type CliDeps } from "./common";
import { output } from "../output";

export function createUpdateCommand(deps: CliDeps = defaultCliDeps) {
  const updateCmd = new Command("update").description("Update resources");

  addSharedHelp(
    updateCmd.command("resource")
      .description("Update one resource and immediately attempt apply")
      .argument("<slug>")
      .requiredOption("--workspace <slug>", "Workspace slug")
      .requiredOption("--env <slug>", "Environment slug")
      .requiredOption("--inputs <json>", "Inputs JSON object")
      .option("--summary <text>", "Change summary")
      .option("--remove-input-paths <json>", "JSON array of input paths to remove")
      .option("--parent <slug>", "New parent slug")
      .option("--version <n>", "Optimistic-lock version")
      .action(async function (this: Command, slug: string, opts: { workspace: string; env: string; inputs: string; summary?: string; removeInputPaths?: string; parent?: string; version?: string }) {
        const flags = getRootFlags(this);
        const token = deps.getToken(flags);
        const apiUrl = deps.getApiUrl(flags);
        try {
          output(await deps.apiRequest<any>(`/workspaces/${opts.workspace}/environments/${opts.env}/resources/${slug}`, {
            method: "PUT",
            body: {
              inputs: JSON.parse(opts.inputs),
              summary: opts.summary,
              removeInputPaths: opts.removeInputPaths ? JSON.parse(opts.removeInputPaths) : undefined,
              parentSlug: opts.parent,
              version: opts.version ? Number(opts.version) : undefined,
            },
            token,
            apiUrl,
          }), flags);
        } catch (error) {
          handleCliError(error, deps);
        }
      }),
    ["update", "resource"],
  );

  return updateCmd;
}

export const updateCmd = createUpdateCommand();
