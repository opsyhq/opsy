import { Command } from "commander";
import {
  addSharedHelp,
  defaultCliDeps,
  getRootFlags,
  handleCliError,
  requireArgumentValue,
  type CliDeps,
} from "./common";
import { output } from "../output";

export function createExecutionCommand(deps: CliDeps = defaultCliDeps) {
  const executionCmd = new Command("execution").description("Inspect and control executions");

  addSharedHelp(
    executionCmd.command("cancel")
      .description("Cancel one running execution")
      .argument("[executionId]")
      .option("--reason <text>", "Cancellation reason")
      .action(async function (this: Command, executionId: string | undefined, opts: { reason?: string }) {
        const flags = getRootFlags(this);
        try {
          const id = requireArgumentValue(executionId, "execution id");
          const token = deps.getToken(flags);
          const apiUrl = deps.getApiUrl(flags);
          output(await deps.apiRequest<any>(`/executions/${id}/cancel`, {
            method: "POST",
            body: { reason: opts.reason },
            token,
            apiUrl,
          }), flags);
        } catch (error) {
          handleCliError(error, deps);
        }
      }),
    ["execution", "cancel"],
  );

  return executionCmd;
}

export const executionCmd = createExecutionCommand();
