import { Command, CommanderError } from "commander";
import { CliError, EXIT_CODE, UsageError, toErrorPayload } from "./errors.js";
import { stringifyJson } from "./output.js";
import { getHelpText, getUsageLine } from "./help.js";
import { registerAuthCommands } from "./commands/auth.js";
import { registerWorkspaceCommands } from "./commands/workspace.js";
import { registerStackCommands } from "./commands/stack.js";
import { registerEnvCommands } from "./commands/env.js";
import { registerDraftCommands } from "./commands/draft.js";
import { registerRevisionCommands } from "./commands/revision.js";
import { registerRunCommands } from "./commands/run.js";
import { registerOrgCommands } from "./commands/org.js";
import { buildContext, write, type CommandContext, type RunCliOptions } from "./commands/helpers.js";

export type { CliIO, RunCliOptions, CommandContext } from "./commands/helpers.js";

function buildProgram(context: CommandContext): Command {
  const program = new Command("opsy")
    .description("opsy — infrastructure management CLI")
    .exitOverride()
    .enablePositionalOptions()
    .configureOutput({
      writeOut: (str) => context.stdout.write(str),
      writeErr: (str) => context.stderr.write(str),
      outputError: () => {},  // suppress; we handle errors in the catch block
    })
    .showHelpAfterError(false)
    .option("--json", "Output as JSON")
    .option("--quiet", "Minimal output (IDs only)")
    .option("--token <pat>", "Override auth token")
    .option("--api-url <url>", "Override API URL")
    .configureHelp({ formatHelp: () => getHelpText() + "\n" })
    .allowExcessArguments(true)
    .action(() => {
      if (program.args.length > 0) {
        throw new UsageError(`unknown command "${program.args.join(" ")}"`);
      }
      write(context.stdout, getHelpText() + "\n");
    });

  registerAuthCommands(program, context);
  registerWorkspaceCommands(program, context);
  registerStackCommands(program, context);
  registerEnvCommands(program, context);
  registerDraftCommands(program, context);
  registerRevisionCommands(program, context);
  registerRunCommands(program, context);
  registerOrgCommands(program, context);

  return program;
}

export async function runCli(argv: string[], options: RunCliOptions = {}): Promise<number> {
  const context = buildContext(options);
  const program = buildProgram(context);

  try {
    await program.parseAsync(argv, { from: "user" });
    return EXIT_CODE.OK;
  } catch (error) {
    if (error instanceof CommanderError) {
      if (error.exitCode === 0) return EXIT_CODE.OK;
      // Strip Commander's "error: " prefix to avoid "Error: error: ..."
      const msg = error.message.replace(/^error:\s*/i, "");
      const asJson = argv.includes("--json");
      if (asJson) {
        write(context.stderr, stringifyJson(toErrorPayload(new UsageError(msg))));
      } else {
        write(context.stderr, `Error: ${msg}\n\n`);
        write(context.stderr, `Run opsy --help for a list of commands.\n`);
      }
      return EXIT_CODE.USAGE;
    }

    const payload = toErrorPayload(error);
    const asJson = argv.includes("--json");

    if (asJson) {
      write(context.stderr, stringifyJson(payload));
    } else if (error instanceof UsageError) {
      if (error.command) {
        write(context.stderr, `Error: ${error.message}\n\n`);
        write(context.stderr, `Usage: ${getUsageLine(error.command)}\n\n`);
        write(context.stderr, `Run opsy ${error.command} --help for more information.\n`);
      } else {
        write(context.stderr, `Error: ${error.message}\n\n`);
        write(context.stderr, `Run opsy --help for a list of commands.\n`);
      }
    } else if (error instanceof CliError) {
      write(context.stderr, `${error.message}\n`);
    } else {
      write(context.stderr, `${payload.message}\n`);
    }

    return error instanceof CliError ? error.exitCode : EXIT_CODE.FAILURE;
  }
}

export { getHelpText, getUsageLine } from "./help.js";
