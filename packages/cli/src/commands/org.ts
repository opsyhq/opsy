import type { Command } from "commander";
import type { CommandContext } from "./helpers.js";
import { getHelpText } from "../help.js";
import {
  addCommonOptions,
  createGroupCommand,
  write,
  writeSuccess,
  createAuthedClient,
  resolveTextInput,
  resolveOptionalTextInput,
  clearOrgNotesIfPresent,
} from "./helpers.js";
import { ApiError, UsageError } from "../errors.js";
import { formatOrgList, formatOrgNotes, formatOrgVariable } from "../output.js";

export function registerOrgCommands(parent: Command, ctx: CommandContext) {
  const group = createGroupCommand(parent, "org", ctx)
    .description("Manage org variables and notes.");

  addCommonOptions(group.command("list"))
    .description("List org variables.")
    .configureHelp({ formatHelp: () => getHelpText("org list") + "\n" })
    .action(async (opts, cmd) => {
      const allOpts = cmd.optsWithGlobals();
      const client = await createAuthedClient(allOpts, ctx);
      const items = await client.listOrgVariables();
      writeSuccess(ctx.stdout, allOpts, items, formatOrgList(items));
    });

  addCommonOptions(group.command("set"))
    .description("Set an org variable.")
    .argument("<key>", "Variable key")
    .option("--value <text>", "Variable value")
    .option("--file <path>", "Read value from file")
    .option("--sensitive", "Mark as sensitive")
    .configureHelp({ formatHelp: () => getHelpText("org set") + "\n" })
    .action(async (key, opts, cmd) => {
      const allOpts = cmd.optsWithGlobals();
      const value = await resolveTextInput(opts, ctx, {
        valueFlag: "value",
        fileFlag: "file",
        description: "org variable value",
        allowEmpty: true,
      });
      const client = await createAuthedClient(allOpts, ctx);
      const item = await client.setOrgVariable(key, value, opts.sensitive);
      writeSuccess(ctx.stdout, allOpts, item, formatOrgVariable(item), item.key);
    });

  addCommonOptions(group.command("delete"))
    .description("Delete an org variable.")
    .argument("<key>", "Variable key")
    .configureHelp({ formatHelp: () => getHelpText("org delete") + "\n" })
    .action(async (key, opts, cmd) => {
      const allOpts = cmd.optsWithGlobals();
      const client = await createAuthedClient(allOpts, ctx);
      await client.deleteOrgVariable(key);
      writeSuccess(ctx.stdout, allOpts, { ok: true, key }, `Deleted variable ${key}`, key);
    });

  addCommonOptions(group.command("get-notes"))
    .description("Show org notes.")
    .configureHelp({ formatHelp: () => getHelpText("org get-notes") + "\n" })
    .action(async (opts, cmd) => {
      const allOpts = cmd.optsWithGlobals();
      const client = await createAuthedClient(allOpts, ctx);

      try {
        const notes = await client.getOrgNotes();
        writeSuccess(ctx.stdout, allOpts, notes, formatOrgNotes(notes));
      } catch (error) {
        if (error instanceof ApiError && error.apiCode === "NOT_FOUND") {
          const payload = { content: null };
          writeSuccess(ctx.stdout, allOpts, payload, "No org notes found.");
          return;
        }
        throw error;
      }
    });

  addCommonOptions(group.command("set-notes"))
    .description("Set or clear org notes.")
    .option("--notes <text>", "Notes content")
    .option("--file <path>", "Read notes from file")
    .option("--clear", "Clear existing notes")
    .configureHelp({ formatHelp: () => getHelpText("org set-notes") + "\n" })
    .action(async (opts, cmd) => {
      const allOpts = cmd.optsWithGlobals();

      if (opts.clear && (opts.notes !== undefined || opts.file !== undefined)) {
        throw new UsageError("org set-notes accepts either --clear or note content, not both.", { command: "org set-notes" });
      }
      const client = await createAuthedClient(allOpts, ctx);

      if (opts.clear) {
        await clearOrgNotesIfPresent(client);
        writeSuccess(ctx.stdout, allOpts, { ok: true, cleared: true }, "Org notes cleared.", "cleared");
        return;
      }

      const notes = await resolveOptionalTextInput(opts, ctx, {
        valueFlag: "notes",
        fileFlag: "file",
        description: "org notes",
        allowEmpty: true,
      });

      if (notes === undefined) {
        throw new UsageError("org set-notes requires --notes, --file, stdin, or --clear.", { command: "org set-notes" });
      }

      if (notes.length === 0) {
        await clearOrgNotesIfPresent(client);
        writeSuccess(ctx.stdout, allOpts, { ok: true, cleared: true }, "Org notes cleared.", "cleared");
        return;
      }

      const saved = await client.setOrgNotes(notes);
      writeSuccess(ctx.stdout, allOpts, saved, formatOrgNotes(saved), "saved");
    });
}
