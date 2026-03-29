#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { Command, CommanderError } from "commander";
import { authCmd } from "./commands/auth";
import { normalizeCommandPath, parseCommandString, renderCommandErrorMessage, renderCommandHelp } from "@opsy/contracts";
import { projectCmd } from "./commands/project";
import { resourceCmd } from "./commands/resource";
import { changeCmd } from "./commands/change";
import { executionCmd } from "./commands/execution";
import { integrationCmd } from "./commands/integration";
import { schemaCmd } from "./commands/schema";
import { feedbackCmd } from "./commands/feedback";

import { observabilityCmd } from "./commands/observability";
import { contextCmd } from "./commands/context";

function getCliVersion(): string {
  try {
    const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version?: string };
    return packageJson.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

function mapCommanderMessage(message: string, commandPath: string[]): string {
  if (message.includes("required option '--project")) {
    return "Missing --project.";
  }
  if (message.includes("missing required argument 'slug'")) {
    if (commandPath[0] === "resource") {
      return "Missing resource slug.";
    }
    if (commandPath[0] === "project") {
      return "Missing project slug.";
    }
  }
  if (message.includes("missing required argument 'shortId'")) {
    return "Missing change shortId.";
  }
  if (message.includes("missing required argument 'executionId'")) {
    return "Missing execution id.";
  }
  return message.replace(/^error:\s*/i, "");
}

const program = new Command()
  .name("opsy")
  .description("Opsy CLI — Agent-to-Infrastructure control plane")
  .version(getCliVersion())
  .option("--token <pat>", "Personal Access Token (env: OPSY_TOKEN)")
  .option("--api-url <url>", "API URL (env: OPSY_API_URL)")
  .option("--json", "Output JSON")
  .option("--quiet", "Minimal output");

program.addCommand(authCmd);
program.addCommand(projectCmd);
program.addCommand(resourceCmd);
program.addCommand(changeCmd);
program.addCommand(executionCmd);
program.addCommand(integrationCmd);
program.addCommand(schemaCmd);

program.addCommand(observabilityCmd);
program.addCommand(feedbackCmd);
program.addCommand(contextCmd);
program.configureHelp({
  formatHelp: () => renderCommandHelp([]),
});
program.configureOutput({
  writeErr: () => {},
  outputError: () => {},
});

program.exitOverride();

async function main() {
  try {
    await program.parseAsync(process.argv);
  } catch (error) {
    if (error instanceof CommanderError) {
      if (error.code === "commander.helpDisplayed" || error.code === "commander.version") {
        return;
      }

      const parsed = parseCommandString(process.argv.slice(2).join(" "));
      const commandPath = normalizeCommandPath(parsed.positionals);
      const message = renderCommandErrorMessage(mapCommanderMessage(error.message, commandPath));
      console.error(`Error: ${message}`);
      process.exit(error.exitCode ?? 1);
    }

    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error: ${message}`);
    process.exit(1);
  }
}

void main();
