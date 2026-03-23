#!/usr/bin/env node
import { Command } from "commander";
import { authCmd } from "./commands/auth";
import { projectCmd } from "./commands/project";
import { envCmd } from "./commands/env";
import { resourceCmd } from "./commands/resource";
import { changeCmd } from "./commands/change";
import { schemaCmd } from "./commands/schema";
import { providerCmd } from "./commands/provider";
import { feedbackCmd } from "./commands/feedback";
import { discoverCmd } from "./commands/discover";
import { observeCmd } from "./commands/observe";

const program = new Command()
  .name("opsy")
  .description("Opsy CLI — Agent-to-Infrastructure control plane")
  .version("0.0.1")
  .option("--token <pat>", "Personal Access Token (env: OPSY_TOKEN)")
  .option("--api-url <url>", "API URL (env: OPSY_API_URL)")
  .option("--json", "Output JSON")
  .option("--quiet", "Minimal output");

program.addCommand(authCmd);
program.addCommand(projectCmd);
program.addCommand(envCmd);
program.addCommand(resourceCmd);
program.addCommand(changeCmd);
program.addCommand(schemaCmd);
program.addCommand(discoverCmd);
program.addCommand(observeCmd);
program.addCommand(providerCmd);
program.addCommand(feedbackCmd);

program.parse();
