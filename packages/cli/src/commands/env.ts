import type { Command } from "commander";
import type { CommandContext } from "./helpers.js";
import { getHelpText } from "../help.js";
import { addCommonOptions, createGroupCommand, write, writeSuccess, createAuthedClient, requireOpt, resolveTextInput } from "./helpers.js";
import { UsageError } from "../errors.js";
import { formatEnvConfig, formatEnvList } from "../output.js";

export function registerEnvCommands(parent: Command, ctx: CommandContext) {
  const group = createGroupCommand(parent, "env", ctx)
    .description("Manage environments.");

  addCommonOptions(group.command("list"))
    .description("List environments in a workspace.")
    .option("--workspace <slug>", "Workspace slug")
    .configureHelp({ formatHelp: () => getHelpText("env list") + "\n" })
    .action(async (opts, cmd) => {
      const allOpts = cmd.optsWithGlobals();
      const workspace = requireOpt(opts.workspace, "workspace", "env list");
      const client = await createAuthedClient(allOpts, ctx);
      const items = await client.listEnvs(workspace);
      writeSuccess(ctx.stdout, allOpts, items, formatEnvList(items));
    });

  addCommonOptions(group.command("create"))
    .description("Create a new environment.")
    .option("--workspace <slug>", "Workspace slug")
    .option("--slug <slug>", "Environment slug")
    .configureHelp({ formatHelp: () => getHelpText("env create") + "\n" })
    .action(async (opts, cmd) => {
      const allOpts = cmd.optsWithGlobals();
      const workspace = requireOpt(opts.workspace, "workspace", "env create");
      const slug = requireOpt(opts.slug, "slug", "env create");
      const client = await createAuthedClient(allOpts, ctx);
      const data = await client.createEnv(workspace, slug);
      writeSuccess(ctx.stdout, allOpts, data, `Environment created (${data.slug})`, data.slug);
    });

  addCommonOptions(group.command("delete"))
    .description("Delete an environment.")
    .option("--workspace <slug>", "Workspace slug")
    .option("--env <slug>", "Environment slug")
    .configureHelp({ formatHelp: () => getHelpText("env delete") + "\n" })
    .action(async (opts, cmd) => {
      const allOpts = cmd.optsWithGlobals();
      const workspace = requireOpt(opts.workspace, "workspace", "env delete");
      const env = requireOpt(opts.env, "env", "env delete");
      const client = await createAuthedClient(allOpts, ctx);
      await client.deleteEnv(workspace, env);
      writeSuccess(ctx.stdout, allOpts, { ok: true, slug: env }, `Deleted environment ${env}`, env);
    });

  addCommonOptions(group.command("config-get"))
    .description("Show environment config.")
    .option("--workspace <slug>", "Workspace slug")
    .option("--env <slug>", "Environment slug")
    .configureHelp({ formatHelp: () => getHelpText("env config-get") + "\n" })
    .action(async (opts, cmd) => {
      const allOpts = cmd.optsWithGlobals();
      const workspace = requireOpt(opts.workspace, "workspace", "env config-get");
      const env = requireOpt(opts.env, "env", "env config-get");
      const client = await createAuthedClient(allOpts, ctx);
      const data = await client.getEnvConfig(workspace, env);
      writeSuccess(ctx.stdout, allOpts, data, formatEnvConfig(data));
    });

  addCommonOptions(group.command("config-set"))
    .description("Set environment config.")
    .option("--workspace <slug>", "Workspace slug")
    .option("--env <slug>", "Environment slug")
    .option("--config <json>", "Config as JSON string")
    .option("--file <path>", "Read config from file")
    .configureHelp({ formatHelp: () => getHelpText("env config-set") + "\n" })
    .action(async (opts, cmd) => {
      const allOpts = cmd.optsWithGlobals();
      const workspace = requireOpt(opts.workspace, "workspace", "env config-set");
      const env = requireOpt(opts.env, "env", "env config-set");

      const configJson = await resolveTextInput(opts, ctx, {
        valueFlag: "config",
        fileFlag: "file",
        description: "env config JSON",
        allowEmpty: false,
      });

      let config: unknown;
      try {
        config = JSON.parse(configJson);
      } catch {
        throw new UsageError("env config-set requires valid JSON.", { command: "env config-set" });
      }

      const client = await createAuthedClient(allOpts, ctx);
      await client.setEnvConfig(workspace, env, config as Parameters<typeof client.setEnvConfig>[2]);
      writeSuccess(ctx.stdout, allOpts, { ok: true }, `Environment config updated (${env})`, env);
    });
}
