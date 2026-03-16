import type { Command } from "commander";
import type { CommandContext } from "./helpers.js";
import { getHelpText } from "../help.js";
import { addCommonOptions, createAuthedClient, createGroupCommand, writeSuccess } from "./helpers.js";
import { UsageError } from "../errors.js";

export function registerOutputCommands(parent: Command, ctx: CommandContext) {
  const group = createGroupCommand(parent, "output", ctx)
    .description("Mutate draft outputs.");

  addCommonOptions(group.command("set"))
    .description("Set an output expression.")
    .option("--draft <short-id>", "Draft short ID")
    .option("--name <name>", "Output name")
    .option("--value <value>", "String expression")
    .configureHelp({ formatHelp: () => getHelpText("output set") + "\n" })
    .action(async (opts, cmd) => {
      const allOpts = cmd.optsWithGlobals();
      if (!opts.draft) throw new UsageError("output set requires --draft.", { command: "output set" });
      if (!opts.name) throw new UsageError("output set requires --name.", { command: "output set" });
      if (opts.value === undefined) throw new UsageError("output set requires --value.", { command: "output set" });
      const client = await createAuthedClient(allOpts, ctx);
      const result = await client.setOutput(opts.draft, opts.name, opts.value);
      writeSuccess(ctx.stdout, allOpts, result, result.summary, result.shortId);
    });

  addCommonOptions(group.command("remove"))
    .description("Remove an output.")
    .option("--draft <short-id>", "Draft short ID")
    .option("--name <name>", "Output name")
    .configureHelp({ formatHelp: () => getHelpText("output remove") + "\n" })
    .action(async (opts, cmd) => {
      const allOpts = cmd.optsWithGlobals();
      if (!opts.draft) throw new UsageError("output remove requires --draft.", { command: "output remove" });
      if (!opts.name) throw new UsageError("output remove requires --name.", { command: "output remove" });
      const client = await createAuthedClient(allOpts, ctx);
      const result = await client.removeOutput(opts.draft, opts.name);
      writeSuccess(ctx.stdout, allOpts, result, result.summary, result.shortId);
    });
}
