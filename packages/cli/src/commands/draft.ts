import type { Command } from "commander";
import type { CommandContext } from "./helpers.js";
import { getHelpText } from "../help.js";
import {
  addCommonOptions,
  createGroupCommand,
  write,
  writeSuccess,
  createAuthedClient,
  requireOpt,
  resolveTextInput,
  writeDraftWithScope,
  editDraftWithScope,
} from "./helpers.js";
import { UsageError } from "../errors.js";
import {
  formatDraftCreate,
  formatDraftDetail,
  formatDraftList,
  formatDraftMutation,
  formatDraftValidate,
} from "../output.js";

export function registerDraftCommands(parent: Command, ctx: CommandContext) {
  const group = createGroupCommand(parent, "draft", ctx)
    .description("Manage drafts.");

  addCommonOptions(group.command("list"))
    .description("List drafts for a stack.")
    .option("--workspace <slug>", "Workspace slug")
    .option("--stack <slug>", "Stack slug")
    .configureHelp({ formatHelp: () => getHelpText("draft list") + "\n" })
    .action(async (opts, cmd) => {
      const allOpts = cmd.optsWithGlobals();
      const workspace = requireOpt(opts.workspace, "workspace", "draft list");
      const stack = requireOpt(opts.stack, "stack", "draft list");
      const client = await createAuthedClient(allOpts, ctx);
      const drafts = await client.listDrafts(workspace, stack);
      writeSuccess(ctx.stdout, allOpts, drafts, formatDraftList(drafts));
    });

  addCommonOptions(group.command("get"))
    .description("Show draft details and spec.")
    .argument("<short-id>", "Draft short ID")
    .configureHelp({ formatHelp: () => getHelpText("draft get") + "\n" })
    .action(async (shortId, opts, cmd) => {
      const allOpts = cmd.optsWithGlobals();
      const client = await createAuthedClient(allOpts, ctx);
      const draft = await client.getDraft(shortId);
      writeSuccess(ctx.stdout, allOpts, draft, formatDraftDetail(draft));
    });

  addCommonOptions(group.command("create"))
    .description("Create a new draft.")
    .option("--workspace <slug>", "Workspace slug")
    .option("--stack <slug>", "Stack slug")
    .option("--name <name>", "Draft name")
    .configureHelp({ formatHelp: () => getHelpText("draft create") + "\n" })
    .action(async (opts, cmd) => {
      const allOpts = cmd.optsWithGlobals();
      const workspace = requireOpt(opts.workspace, "workspace", "draft create");
      const stack = requireOpt(opts.stack, "stack", "draft create");
      const client = await createAuthedClient(allOpts, ctx);
      const created = await client.createDraft(workspace, stack, opts.name);
      writeSuccess(ctx.stdout, allOpts, created, formatDraftCreate(created), created.shortId);
    });

  addCommonOptions(group.command("write"))
    .description("Write YAML spec to a draft.")
    .argument("[short-id]", "Draft short ID")
    .option("--workspace <slug>", "Workspace slug")
    .option("--stack <slug>", "Stack slug")
    .option("--yaml <yaml>", "YAML spec as string")
    .option("--file <path>", "Read YAML from file")
    .configureHelp({ formatHelp: () => getHelpText("draft write") + "\n" })
    .action(async (shortId, opts, cmd) => {
      const allOpts = cmd.optsWithGlobals();

      const yaml = await resolveTextInput(opts, ctx, {
        valueFlag: "yaml",
        fileFlag: "file",
        description: "draft YAML",
        allowEmpty: false,
      });
      const client = await createAuthedClient(allOpts, ctx);
      const updated = shortId
        ? await client.writeDraft(shortId, yaml)
        : await writeDraftWithScope(client, opts, yaml);

      writeSuccess(ctx.stdout, allOpts, updated, formatDraftMutation(updated), updated.shortId);
    });

  addCommonOptions(group.command("edit"))
    .description("Edit a draft with string replacement.")
    .argument("[short-id]", "Draft short ID")
    .option("--workspace <slug>", "Workspace slug")
    .option("--stack <slug>", "Stack slug")
    .option("--old-string <text>", "String to find")
    .option("--new-string <text>", "Replacement string")
    .configureHelp({ formatHelp: () => getHelpText("draft edit") + "\n" })
    .action(async (shortId, opts, cmd) => {
      const allOpts = cmd.optsWithGlobals();
      const oldString = requireOpt(opts.oldString, "old-string", "draft edit");

      if (opts.newString === undefined) {
        throw new UsageError("draft edit requires --new-string.", { command: "draft edit" });
      }

      const client = await createAuthedClient(allOpts, ctx);
      const updated = shortId
        ? await client.editDraft(shortId, oldString, opts.newString)
        : await editDraftWithScope(client, opts, oldString, opts.newString);

      writeSuccess(ctx.stdout, allOpts, updated, formatDraftMutation(updated), updated.shortId);
    });

  addCommonOptions(group.command("validate"))
    .description("Validate a draft.")
    .argument("<short-id>", "Draft short ID")
    .configureHelp({ formatHelp: () => getHelpText("draft validate") + "\n" })
    .action(async (shortId, opts, cmd) => {
      const allOpts = cmd.optsWithGlobals();
      const client = await createAuthedClient(allOpts, ctx);
      const result = await client.validateDraft(shortId);
      writeSuccess(ctx.stdout, allOpts, result, formatDraftValidate(result), result.ok ? "ok" : "invalid");
    });

  addCommonOptions(group.command("delete"))
    .description("Delete a draft.")
    .argument("<short-id>", "Draft short ID")
    .configureHelp({ formatHelp: () => getHelpText("draft delete") + "\n" })
    .action(async (shortId, opts, cmd) => {
      const allOpts = cmd.optsWithGlobals();
      const client = await createAuthedClient(allOpts, ctx);
      await client.deleteDraft(shortId);
      writeSuccess(ctx.stdout, allOpts, { ok: true, shortId }, `Deleted draft ${shortId}`, shortId);
    });
}
