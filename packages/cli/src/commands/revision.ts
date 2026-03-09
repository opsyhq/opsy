import type { Command } from "commander";
import type { CommandContext } from "./helpers.js";
import { getHelpText } from "../help.js";
import { addCommonOptions, createGroupCommand, write, writeSuccess, createAuthedClient, requireOpt, parsePositiveInt } from "./helpers.js";
import { formatRevisionDetail, formatRevisionList } from "../output.js";

export function registerRevisionCommands(parent: Command, ctx: CommandContext) {
  const group = createGroupCommand(parent, "revision", ctx)
    .description("Manage revisions.");

  addCommonOptions(group.command("list"))
    .description("List revisions for a stack.")
    .option("--workspace <slug>", "Workspace slug")
    .option("--stack <slug>", "Stack slug")
    .option("--cursor <cursor>", "Pagination cursor")
    .option("--limit <n>", "Max results")
    .configureHelp({ formatHelp: () => getHelpText("revision list") + "\n" })
    .action(async (opts, cmd) => {
      const allOpts = cmd.optsWithGlobals();
      const workspace = requireOpt(opts.workspace, "workspace", "revision list");
      const stack = requireOpt(opts.stack, "stack", "revision list");
      const limit = opts.limit ? parsePositiveInt(opts.limit, "--limit", "revision list") : undefined;
      const client = await createAuthedClient(allOpts, ctx);
      const revisions = await client.listRevisions(workspace, stack, {
        cursor: opts.cursor,
        limit,
      });
      writeSuccess(ctx.stdout, allOpts, revisions, formatRevisionList(revisions));
    });

  addCommonOptions(group.command("get"))
    .description("Show revision details and spec.")
    .argument("[revision-number]", "Revision number (omit for head)")
    .option("--workspace <slug>", "Workspace slug")
    .option("--stack <slug>", "Stack slug")
    .configureHelp({ formatHelp: () => getHelpText("revision get") + "\n" })
    .action(async (revisionNumber, opts, cmd) => {
      const allOpts = cmd.optsWithGlobals();
      const workspace = requireOpt(opts.workspace, "workspace", "revision get");
      const stack = requireOpt(opts.stack, "stack", "revision get");
      const client = await createAuthedClient(allOpts, ctx);
      const revision = revisionNumber === undefined
        ? await client.getHeadRevision(workspace, stack)
        : await client.getRevision(workspace, stack, parsePositiveInt(revisionNumber, "revision number", "revision get"));
      writeSuccess(ctx.stdout, allOpts, revision, formatRevisionDetail(revision));
    });

  addCommonOptions(group.command("delete"))
    .description("Delete a revision.")
    .argument("<revision-number>", "Revision number")
    .option("--workspace <slug>", "Workspace slug")
    .option("--stack <slug>", "Stack slug")
    .configureHelp({ formatHelp: () => getHelpText("revision delete") + "\n" })
    .action(async (revisionInput, opts, cmd) => {
      const allOpts = cmd.optsWithGlobals();
      const workspace = requireOpt(opts.workspace, "workspace", "revision delete");
      const stack = requireOpt(opts.stack, "stack", "revision delete");
      const revisionNumber = parsePositiveInt(revisionInput, "revision number", "revision delete");
      const client = await createAuthedClient(allOpts, ctx);
      const revision = await client.getRevision(workspace, stack, revisionNumber);
      await client.deleteRevision(workspace, stack, revision.id);
      writeSuccess(
        ctx.stdout,
        allOpts,
        { ok: true, revisionId: revision.id, revisionNumber },
        `Deleted revision ${revisionNumber}`,
        revision.id,
      );
    });
}
