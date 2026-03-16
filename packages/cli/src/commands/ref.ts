import type { Command } from "commander";
import type { CommandContext } from "./helpers.js";
import { getHelpText } from "../help.js";
import { addCommonOptions, createAuthedClient, createGroupCommand, writeSuccess } from "./helpers.js";
import { UsageError } from "../errors.js";

export function registerRefCommands(parent: Command, ctx: CommandContext) {
  const group = createGroupCommand(parent, "ref", ctx)
    .description("Mutate draft imports.");

  addCommonOptions(group.command("add"))
    .description("Add an import reference alias.")
    .option("--draft <short-id>", "Draft short ID")
    .option("--name <name>", "Import alias")
    .option("--source <source>", "Strict stacks.<slug>.<output> source")
    .configureHelp({ formatHelp: () => getHelpText("ref add") + "\n" })
    .action(async (opts, cmd) => {
      const allOpts = cmd.optsWithGlobals();
      if (!opts.draft) throw new UsageError("ref add requires --draft.", { command: "ref add" });
      if (!opts.name) throw new UsageError("ref add requires --name.", { command: "ref add" });
      if (!opts.source) throw new UsageError("ref add requires --source.", { command: "ref add" });
      const client = await createAuthedClient(allOpts, ctx);
      const result = await client.addRef(opts.draft, opts.name, opts.source);
      writeSuccess(ctx.stdout, allOpts, result, result.summary, result.shortId);
    });

  addCommonOptions(group.command("remove"))
    .description("Remove an import reference alias.")
    .option("--draft <short-id>", "Draft short ID")
    .option("--name <name>", "Import alias")
    .configureHelp({ formatHelp: () => getHelpText("ref remove") + "\n" })
    .action(async (opts, cmd) => {
      const allOpts = cmd.optsWithGlobals();
      if (!opts.draft) throw new UsageError("ref remove requires --draft.", { command: "ref remove" });
      if (!opts.name) throw new UsageError("ref remove requires --name.", { command: "ref remove" });
      const client = await createAuthedClient(allOpts, ctx);
      const result = await client.removeRef(opts.draft, opts.name);
      writeSuccess(ctx.stdout, allOpts, result, result.summary, result.shortId);
    });
}
