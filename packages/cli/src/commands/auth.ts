import type { Command } from "commander";
import type { CommandContext } from "./helpers.js";
import { getHelpText } from "../help.js";
import { addCommonOptions, createGroupCommand, write, writeSuccess, createAuthedClient, requireOpt } from "./helpers.js";
import { resolveApiUrl, type CliConfig } from "../config.js";
import { createApiClient } from "../client.js";
import { formatAuthLogin, formatWhoAmI, stringifyJson } from "../output.js";
import { EXIT_CODE } from "../errors.js";

export function registerAuthCommands(parent: Command, ctx: CommandContext) {
  const group = createGroupCommand(parent, "auth", ctx)
    .description("Work with authentication.");

  addCommonOptions(group.command("login"))
    .description("Authenticate with a personal access token.")
    .configureHelp({ formatHelp: () => getHelpText("auth login") + "\n" })
    .action(async (opts, cmd) => {
      const allOpts = cmd.optsWithGlobals();
      const token = requireOpt(allOpts.token, "token", "auth login");
      const currentConfig = await ctx.store.load();
      const resolvedApiUrl = resolveApiUrl(currentConfig, ctx.env, allOpts.apiUrl);
      const client = createApiClient({
        apiUrl: resolvedApiUrl.value,
        token,
        fetchImpl: ctx.fetchImpl,
      });
      const whoami = await client.getWhoAmI();

      const nextConfig: CliConfig = {
        version: 1,
        token,
        ...(resolvedApiUrl.source !== "default" || currentConfig.apiUrl
          ? { apiUrl: resolvedApiUrl.value }
          : {}),
      };
      await ctx.store.save(nextConfig);

      if (allOpts.json) {
        write(
          ctx.stdout,
          stringifyJson({
            ok: true,
            apiUrl: resolvedApiUrl.value,
            storage: {
              kind: "file",
              path: ctx.store.getPath(),
            },
            whoami,
          }),
        );
        return;
      }

      write(
        ctx.stdout,
        `${formatAuthLogin(whoami, ctx.store.getPath())}\n`,
      );
    });

  addCommonOptions(group.command("whoami"))
    .description("Show the authenticated user.")
    .configureHelp({ formatHelp: () => getHelpText("auth whoami") + "\n" })
    .action(async (opts, cmd) => {
      const allOpts = cmd.optsWithGlobals();
      const client = await createAuthedClient(allOpts, ctx);
      const whoami = await client.getWhoAmI();
      writeSuccess(ctx.stdout, allOpts, whoami, formatWhoAmI(whoami));
    });

  addCommonOptions(group.command("logout"))
    .description("Remove stored credentials.")
    .configureHelp({ formatHelp: () => getHelpText("auth logout") + "\n" })
    .action(async (opts, cmd) => {
      const allOpts = cmd.optsWithGlobals();
      const currentConfig = await ctx.store.load();
      const hadToken = Boolean(currentConfig.token);

      if (currentConfig.apiUrl) {
        await ctx.store.save({ version: 1, apiUrl: currentConfig.apiUrl });
      } else {
        await ctx.store.clear();
      }

      const payload = { ok: true, removedToken: hadToken };
      writeSuccess(ctx.stdout, allOpts, payload, hadToken ? "Logged out." : "No stored token.");
    });
}
