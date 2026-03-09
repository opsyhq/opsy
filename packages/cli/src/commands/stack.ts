import type { Command } from "commander";
import type { CommandContext } from "./helpers.js";
import { getHelpText } from "../help.js";
import { addCommonOptions, createGroupCommand, write, writeSuccess, createAuthedClient, requireOpt, resolveTextInput } from "./helpers.js";
import { formatStackDetail, formatStackList, formatStackState } from "../output.js";

export function registerStackCommands(parent: Command, ctx: CommandContext) {
  const group = createGroupCommand(parent, "stack", ctx)
    .description("Manage stacks.");

  addCommonOptions(group.command("list"))
    .description("List stacks in a workspace.")
    .option("--workspace <slug>", "Workspace slug")
    .configureHelp({ formatHelp: () => getHelpText("stack list") + "\n" })
    .action(async (opts, cmd) => {
      const allOpts = cmd.optsWithGlobals();
      const workspace = requireOpt(opts.workspace, "workspace", "stack list");
      const client = await createAuthedClient(allOpts, ctx);
      const items = await client.listStacks(workspace);
      writeSuccess(ctx.stdout, allOpts, items, formatStackList(items));
    });

  addCommonOptions(group.command("get"))
    .description("Show stack details and deployments.")
    .argument("<slug>", "Stack slug")
    .option("--workspace <slug>", "Workspace slug")
    .configureHelp({ formatHelp: () => getHelpText("stack get") + "\n" })
    .action(async (slug, opts, cmd) => {
      const allOpts = cmd.optsWithGlobals();
      const workspace = requireOpt(opts.workspace, "workspace", "stack get");
      const client = await createAuthedClient(allOpts, ctx);
      const data = await client.getStack(workspace, slug);
      writeSuccess(ctx.stdout, allOpts, data, formatStackDetail(data));
    });

  addCommonOptions(group.command("create"))
    .description("Create a new stack.")
    .option("--workspace <slug>", "Workspace slug")
    .option("--slug <slug>", "Stack slug")
    .option("--yaml <yaml>", "Initial YAML spec")
    .configureHelp({ formatHelp: () => getHelpText("stack create") + "\n" })
    .action(async (opts, cmd) => {
      const allOpts = cmd.optsWithGlobals();
      const workspace = requireOpt(opts.workspace, "workspace", "stack create");
      const slug = requireOpt(opts.slug, "slug", "stack create");
      const client = await createAuthedClient(allOpts, ctx);
      const data = await client.createStack(workspace, { slug, ...(opts.yaml ? { yaml: opts.yaml } : {}) });
      writeSuccess(ctx.stdout, allOpts, data, `Stack created (${data.slug})`, data.slug);
    });

  addCommonOptions(group.command("set-notes"))
    .description("Set or clear stack notes.")
    .option("--workspace <slug>", "Workspace slug")
    .option("--stack <slug>", "Stack slug")
    .option("--notes <text>", "Notes content")
    .option("--file <path>", "Read notes from file")
    .option("--clear", "Clear existing notes")
    .configureHelp({ formatHelp: () => getHelpText("stack set-notes") + "\n" })
    .action(async (opts, cmd) => {
      const allOpts = cmd.optsWithGlobals();
      const workspace = requireOpt(opts.workspace, "workspace", "stack set-notes");
      const stack = requireOpt(opts.stack, "stack", "stack set-notes");
      const client = await createAuthedClient(allOpts, ctx);

      if (opts.clear) {
        const data = await client.setStackNotes(workspace, stack, null);
        writeSuccess(ctx.stdout, allOpts, data, `Stack notes cleared (${stack})`, stack);
        return;
      }

      const notes = await resolveTextInput(opts, ctx, {
        valueFlag: "notes",
        fileFlag: "file",
        description: "stack notes",
        allowEmpty: false,
      });
      const data = await client.setStackNotes(workspace, stack, notes);
      writeSuccess(ctx.stdout, allOpts, data, `Stack notes updated (${stack})`, stack);
    });

  addCommonOptions(group.command("delete"))
    .description("Delete a stack.")
    .argument("<slug>", "Stack slug")
    .option("--workspace <slug>", "Workspace slug")
    .configureHelp({ formatHelp: () => getHelpText("stack delete") + "\n" })
    .action(async (slug, opts, cmd) => {
      const allOpts = cmd.optsWithGlobals();
      const workspace = requireOpt(opts.workspace, "workspace", "stack delete");
      const client = await createAuthedClient(allOpts, ctx);
      await client.deleteStack(workspace, slug);
      writeSuccess(ctx.stdout, allOpts, { ok: true, slug }, `Deleted stack ${slug}`, slug);
    });

  addCommonOptions(group.command("state"))
    .description("Show deployed stack state.")
    .argument("<slug>", "Stack slug")
    .option("--workspace <slug>", "Workspace slug")
    .configureHelp({ formatHelp: () => getHelpText("stack state") + "\n" })
    .action(async (slug, opts, cmd) => {
      const allOpts = cmd.optsWithGlobals();
      const workspace = requireOpt(opts.workspace, "workspace", "stack state");
      const client = await createAuthedClient(allOpts, ctx);
      const data = await client.getStackState(workspace, slug);
      writeSuccess(ctx.stdout, allOpts, data, formatStackState(data));
    });
}
