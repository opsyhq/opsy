import { Command } from "commander";
import { getToken, getApiUrl } from "../config";
import { apiRequest } from "../client";
import { output } from "../output";

export const feedbackCmd = new Command("feedback").description("Submit feedback to the Opsy team");

feedbackCmd
  .command("send")
  .description("Send feedback, bug report, or feature request")
  .requiredOption("--message <text>", "Feedback message (max 4000 chars)")
  .option("--from-llm", "Indicate this feedback is being sent by an LLM")
  .action(async function (this: Command, opts: { message: string; fromLlm?: boolean }) {
    const flags = this.parent!.parent!.opts();
    const token = getToken(flags);
    const apiUrl = getApiUrl(flags);
    try {
      const result = await apiRequest<{ id: string }>("/feedback", {
        method: "POST",
        body: {
          message: opts.message,
          source: opts.fromLlm ? "cli_llm" : "cli",
        },
        token,
        apiUrl,
      });
      if (flags.json) return output(result, flags);
      console.log(`Feedback submitted (id: ${result.id}). Thank you!`);
    } catch (e) {
      console.error(`Error: ${e instanceof Error ? e.message : String(e)}`);
      process.exit(1);
    }
  });
