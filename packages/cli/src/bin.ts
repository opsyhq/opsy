#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { Command } from "commander";
import { authCmd } from "./commands/auth";
import { renderCommandHelp } from "@opsy/contracts";
import { projectCmd } from "./commands/project";
import { environmentCmd } from "./commands/environment";
import { resourceCmd } from "./commands/resource";
import { changeCmd } from "./commands/change";
import { providerCmd } from "./commands/provider";
import { schemaCmd } from "./commands/schema";
import { feedbackCmd } from "./commands/feedback";
import { discoveryCmd } from "./commands/discovery";
import { observabilityCmd } from "./commands/observability";

function getCliVersion(): string {
  try {
    const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version?: string };
    return packageJson.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
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
program.addCommand(environmentCmd);
program.addCommand(resourceCmd);
program.addCommand(changeCmd);
program.addCommand(providerCmd);
program.addCommand(schemaCmd);
program.addCommand(discoveryCmd);
program.addCommand(observabilityCmd);
program.addCommand(feedbackCmd);
program.configureHelp({
  formatHelp: () => renderCommandHelp([]),
});

program.parse();
