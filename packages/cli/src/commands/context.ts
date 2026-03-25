import { Command } from "commander";
import { getEnv, getWorkspace, loadConfig, saveConfig } from "../config";
import { getRootFlags, requireOptionValue } from "./common";
import { output } from "../output";

function saveContext(workspace: string, env: string) {
  const config = loadConfig();
  saveConfig({
    ...config,
    workspace,
    env,
  });
}

function clearContext() {
  const config = loadConfig();
  saveConfig({
    ...config,
    workspace: undefined,
    env: undefined,
  });
}

export function createContextCommand() {
  const contextCmd = new Command("context").description("Show and manage the default workspace and environment context");

  contextCmd.command("use")
    .description("Set the default workspace and environment context")
    .requiredOption("--workspace <slug>", "Workspace slug")
    .requiredOption("--env <slug>", "Environment slug")
    .action((opts: { workspace: string; env: string }) => {
      const workspace = requireOptionValue(opts.workspace, "workspace");
      const env = requireOptionValue(opts.env, "env");
      saveContext(workspace, env);
      console.log(`Context set to workspace=${workspace} env=${env}`);
    });

  contextCmd.command("show")
    .description("Show the current workspace and environment context")
    .action(function (this: Command) {
      const flags = getRootFlags(this);
      const context = {
        workspace: getWorkspace(flags) ?? null,
        env: getEnv(flags) ?? null,
      };
      if (flags.json) {
        output(context, flags);
        return;
      }
      if (!context.workspace && !context.env) {
        console.log("No default context selected.");
        return;
      }
      console.log(`Workspace: ${context.workspace ?? "-"}`);
      console.log(`Env: ${context.env ?? "-"}`);
    });

  contextCmd.command("clear")
    .description("Clear the saved workspace and environment context")
    .action(() => {
      clearContext();
      console.log("Context cleared.");
    });

  return contextCmd;
}

export const contextCmd = createContextCommand();
