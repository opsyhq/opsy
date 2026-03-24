import { Command } from "commander";
import { defaultCliDeps, getRootFlags, handleCliError, type CliDeps } from "./common";
import { output } from "../output";

export function createFeedbackCommand(deps: CliDeps = defaultCliDeps) {
  const feedbackCmd = new Command("feedback").description("Submit feedback to the Opsy team");

  feedbackCmd
    .command("send")
    .description("Send feedback, bug report, or feature request")
    .requiredOption("--message <text>", "Feedback message (max 4000 chars)")
    .option("--error-context <json>", "JSON object with error/debug context")
    .option("--from-llm", "Indicate this feedback is being sent by an LLM")
    .action(async function (this: Command, opts: { message: string; errorContext?: string; fromLlm?: boolean }) {
      const flags = getRootFlags(this);
      const token = deps.getToken(flags);
      const apiUrl = deps.getApiUrl(flags);
      try {
        let metadata: Record<string, unknown> | undefined;
        if (opts.errorContext) {
          const parsed = JSON.parse(opts.errorContext);
          metadata = { errorContext: parsed };
        }
        const result = await deps.apiRequest<{ id: string }>("/feedback", {
          method: "POST",
          body: {
            message: opts.message,
            source: opts.fromLlm ? "cli_llm" : "cli",
            metadata,
          },
          token,
          apiUrl,
        });
        if (flags.json) return output(result, flags);
        deps.log(`Feedback submitted (id: ${result.id}). Thank you!`);
      } catch (error) {
        handleCliError(error, deps);
      }
    });

  return feedbackCmd;
}

export const feedbackCmd = createFeedbackCommand();
