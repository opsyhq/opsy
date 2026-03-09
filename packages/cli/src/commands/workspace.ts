import type { Command } from "commander";
import type { CommandContext } from "./helpers.js";
import { getHelpText } from "../help.js";
import { addCommonOptions, createGroupCommand, write, writeSuccess, createAuthedClient, requireOpt } from "./helpers.js";
import { formatWorkspaceDetail, formatWorkspaceList } from "../output.js";

export function registerWorkspaceCommands(parent: Command, ctx: CommandContext) {
  const group = createGroupCommand(parent, "workspace", ctx)
    .description("Manage workspaces.");

  addCommonOptions(group.command("list"))
    .description("List all workspaces.")
    .configureHelp({ formatHelp: () => getHelpText("workspace list") + "\n" })
    .action(async (opts, cmd) => {
      const allOpts = cmd.optsWithGlobals();
      const client = await createAuthedClient(allOpts, ctx);
      const items = await client.listWorkspaces();
      writeSuccess(ctx.stdout, allOpts, items, formatWorkspaceList(items));
    });

  addCommonOptions(group.command("get"))
    .description("Show workspace details.")
    .argument("<slug>", "Workspace slug")
    .configureHelp({ formatHelp: () => getHelpText("workspace get") + "\n" })
    .action(async (slug, opts, cmd) => {
      const allOpts = cmd.optsWithGlobals();
      const client = await createAuthedClient(allOpts, ctx);
      const data = await client.getWorkspace(slug);
      writeSuccess(ctx.stdout, allOpts, data, formatWorkspaceDetail(data));
    });

  addCommonOptions(group.command("create"))
    .description("Create a new workspace.")
    .option("--slug <slug>", "Workspace slug")
    .option("--name <name>", "Workspace display name")
    .configureHelp({ formatHelp: () => getHelpText("workspace create") + "\n" })
    .action(async (opts, cmd) => {
      const allOpts = cmd.optsWithGlobals();
      const slug = requireOpt(opts.slug, "slug", "workspace create");
      const name = requireOpt(opts.name, "name", "workspace create");
      const client = await createAuthedClient(allOpts, ctx);
      const data = await client.createWorkspace({ slug, name });
      writeSuccess(ctx.stdout, allOpts, data, `Workspace created (${data.slug})`, data.slug);
    });

  addCommonOptions(group.command("delete"))
    .description("Delete a workspace.")
    .argument("<slug>", "Workspace slug")
    .configureHelp({ formatHelp: () => getHelpText("workspace delete") + "\n" })
    .action(async (slug, opts, cmd) => {
      const allOpts = cmd.optsWithGlobals();
      const client = await createAuthedClient(allOpts, ctx);
      await client.deleteWorkspace(slug);
      writeSuccess(ctx.stdout, allOpts, { ok: true, slug }, `Deleted workspace ${slug}`, slug);
    });
}
