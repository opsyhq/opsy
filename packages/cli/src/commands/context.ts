import { Command } from "commander";
import { getProject, loadConfig, saveConfig } from "../config";
import { getRootFlags, requireOptionValue } from "./common";
import { output } from "../output";

function saveContext(project: string) {
  const config = loadConfig();
  saveConfig({
    ...config,
    project,
  });
}

function clearContext() {
  const config = loadConfig();
  saveConfig({
    ...config,
    project: undefined,
  });
}

export function createContextCommand() {
  const contextCmd = new Command("context").description("Show and manage the default project context");

  contextCmd.command("use")
    .description("Set the default project context")
    .requiredOption("--project <slug>", "Project slug")
    .action((opts: { project: string }) => {
      const project = requireOptionValue(opts.project, "project");
      saveContext(project);
      console.log(`Context set to project=${project}`);
    });

  contextCmd.command("show")
    .description("Show the current project context")
    .action(function (this: Command) {
      const flags = getRootFlags(this);
      const context = {
        project: getProject(flags) ?? null,
      };
      if (flags.json) {
        output(context, flags);
        return;
      }
      if (!context.project) {
        console.log("No default context selected.");
        return;
      }
      console.log(`Project: ${context.project}`);
    });

  contextCmd.command("clear")
    .description("Clear the saved project context")
    .action(() => {
      clearContext();
      console.log("Context cleared.");
    });

  return contextCmd;
}

export const contextCmd = createContextCommand();
