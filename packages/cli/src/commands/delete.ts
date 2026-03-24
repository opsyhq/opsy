import { Command } from "commander";
import { addSharedHelp, defaultCliDeps, getRootFlags, handleCliError, type CliDeps } from "./common";
import { output } from "../output";

export function createDeleteCommand(deps: CliDeps = defaultCliDeps) {
  const deleteCmd = new Command("delete").description("Delete resources");

  addSharedHelp(
    deleteCmd.command("resource")
      .description("Delete one resource and immediately attempt apply")
      .argument("<slug>")
      .requiredOption("--project <slug>", "Project slug")
      .requiredOption("--env <slug>", "Environment slug")
      .option("--recursive", "Delete descendants too")
      .action(async function (this: Command, slug: string, opts: { project: string; env: string; recursive?: boolean }) {
        const flags = getRootFlags(this);
        const token = deps.getToken(flags);
        const apiUrl = deps.getApiUrl(flags);
        try {
          const query = opts.recursive ? "?recursive=true" : "";
          output(await deps.apiRequest<any>(`/projects/${opts.project}/environments/${opts.env}/resources/${slug}${query}`, {
            method: "DELETE",
            token,
            apiUrl,
          }), flags);
        } catch (error) {
          handleCliError(error, deps);
        }
      }),
    ["delete", "resource"],
  );

  return deleteCmd;
}

export const deleteCmd = createDeleteCommand();
