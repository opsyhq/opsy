#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { Command } from "commander";
import { authCmd } from "./commands/auth";
import { renderCommandHelp } from "@opsy/contracts";
import { listCmd } from "./commands/list";
import { getCmd } from "./commands/get";
import { createCmd } from "./commands/create";
import { updateCmd } from "./commands/update";
import { deleteCmd } from "./commands/delete";
import { applyCmd } from "./commands/apply";
import { planCmd } from "./commands/plan";
import { dismissCmd } from "./commands/dismiss";
import { appendCmd } from "./commands/append";
import { retryCmd } from "./commands/retry";
import { refreshCmd } from "./commands/refresh";
import { diffCmd } from "./commands/diff";
import { acceptCmd } from "./commands/accept";
import { pushCmd } from "./commands/push";
import { restoreCmd } from "./commands/restore";
import { historyCmd } from "./commands/history";
import { feedbackCmd } from "./commands/feedback";
import { discoverCmd } from "./commands/discover";
import { observeCmd } from "./commands/observe";

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
program.addCommand(listCmd);
program.addCommand(getCmd);
program.addCommand(createCmd);
program.addCommand(updateCmd);
program.addCommand(deleteCmd);
program.addCommand(applyCmd);
program.addCommand(planCmd);
program.addCommand(dismissCmd);
program.addCommand(appendCmd);
program.addCommand(retryCmd);
program.addCommand(refreshCmd);
program.addCommand(diffCmd);
program.addCommand(acceptCmd);
program.addCommand(pushCmd);
program.addCommand(restoreCmd);
program.addCommand(historyCmd);
program.addCommand(discoverCmd);
program.addCommand(observeCmd);
program.addCommand(feedbackCmd);
program.configureHelp({
  formatHelp: () => renderCommandHelp([]),
});

program.parse();
