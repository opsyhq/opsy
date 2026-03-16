import type { Command } from "commander";
import type { CommandContext } from "./helpers.js";
import { getHelpText } from "../help.js";
import {
  addCommonOptions,
  createAuthedClient,
  createGroupCommand,
  readInputSource,
  writeSuccess,
} from "./helpers.js";
import { UsageError } from "../errors.js";
import { hasReadableStdin } from "./helpers.js";

async function readJsonPayload(
  opts: { file?: string },
  ctx: CommandContext,
  label: string,
  options?: { optional?: boolean },
): Promise<unknown | undefined> {
  const hasStdin = hasReadableStdin(ctx.stdin);
  if (opts.file && hasStdin && opts.file !== "-") {
    throw new UsageError(`Use either --file or stdin for ${label}, not both.`);
  }

  if (!opts.file && !hasStdin) {
    if (options?.optional) return undefined;
    throw new UsageError(`Provide ${label} via --file or stdin.`);
  }

  const raw = await readInputSource(ctx, opts.file);
  try {
    return JSON.parse(raw);
  } catch {
    throw new UsageError(`${label} must be valid JSON.`);
  }
}

export function registerResourceCommands(parent: Command, ctx: CommandContext) {
  const group = createGroupCommand(parent, "resource", ctx)
    .description("Mutate draft resources.");

  addCommonOptions(group.command("add"))
    .description("Add a resource to a draft.")
    .option("--draft <short-id>", "Draft short ID")
    .option("--name <name>", "Resource name")
    .option("--type <token>", "Pulumi type token")
    .option("--file <path>", "Read initial props JSON from file")
    .configureHelp({ formatHelp: () => getHelpText("resource add") + "\n" })
    .action(async (opts, cmd) => {
      const allOpts = cmd.optsWithGlobals();
      if (!opts.draft) throw new UsageError("resource add requires --draft.", { command: "resource add" });
      if (!opts.name) throw new UsageError("resource add requires --name.", { command: "resource add" });
      if (!opts.type) throw new UsageError("resource add requires --type.", { command: "resource add" });
      const properties = await readJsonPayload({ file: opts.file }, ctx, "initial props JSON", { optional: true });
      const client = await createAuthedClient(allOpts, ctx);
      const result = await client.addResource(opts.draft, {
        name: opts.name,
        type: opts.type,
        ...(properties && typeof properties === "object" && !Array.isArray(properties) ? { properties: properties as Record<string, unknown> } : {}),
      });
      writeSuccess(ctx.stdout, allOpts, result, result.summary, result.shortId);
    });

  addCommonOptions(group.command("remove"))
    .description("Remove a resource from a draft.")
    .option("--draft <short-id>", "Draft short ID")
    .option("--name <name>", "Resource name")
    .configureHelp({ formatHelp: () => getHelpText("resource remove") + "\n" })
    .action(async (opts, cmd) => {
      const allOpts = cmd.optsWithGlobals();
      if (!opts.draft) throw new UsageError("resource remove requires --draft.", { command: "resource remove" });
      if (!opts.name) throw new UsageError("resource remove requires --name.", { command: "resource remove" });
      const client = await createAuthedClient(allOpts, ctx);
      const result = await client.removeResource(opts.draft, opts.name);
      writeSuccess(ctx.stdout, allOpts, result, result.summary, result.shortId);
    });

  addCommonOptions(group.command("set-props"))
    .description("Recursively merge properties into a resource.")
    .option("--draft <short-id>", "Draft short ID")
    .option("--name <name>", "Resource name")
    .option("--file <path>", "Read props JSON from file")
    .configureHelp({ formatHelp: () => getHelpText("resource set-props") + "\n" })
    .action(async (opts, cmd) => {
      const allOpts = cmd.optsWithGlobals();
      if (!opts.draft) throw new UsageError("resource set-props requires --draft.", { command: "resource set-props" });
      if (!opts.name) throw new UsageError("resource set-props requires --name.", { command: "resource set-props" });
      const properties = await readJsonPayload({ file: opts.file }, ctx, "properties JSON");
      if (!properties || typeof properties !== "object" || Array.isArray(properties)) {
        throw new UsageError("resource set-props requires a JSON object via --file or stdin.", { command: "resource set-props" });
      }
      const client = await createAuthedClient(allOpts, ctx);
      const result = await client.setResourceProps(opts.draft, opts.name, properties as Record<string, unknown>);
      writeSuccess(ctx.stdout, allOpts, result, result.summary, result.shortId);
    });

  addCommonOptions(group.command("set-prop"))
    .description("Set one property by JSON Pointer.")
    .option("--draft <short-id>", "Draft short ID")
    .option("--name <name>", "Resource name")
    .option("--prop <pointer>", "RFC 6901 JSON Pointer")
    .option("--value-json <json>", "JSON value to assign")
    .configureHelp({ formatHelp: () => getHelpText("resource set-prop") + "\n" })
    .action(async (opts, cmd) => {
      const allOpts = cmd.optsWithGlobals();
      if (!opts.draft) throw new UsageError("resource set-prop requires --draft.", { command: "resource set-prop" });
      if (!opts.name) throw new UsageError("resource set-prop requires --name.", { command: "resource set-prop" });
      if (!opts.prop) throw new UsageError("resource set-prop requires --prop.", { command: "resource set-prop" });
      if (!opts.valueJson) throw new UsageError("resource set-prop requires --value-json.", { command: "resource set-prop" });
      let value: unknown;
      try {
        value = JSON.parse(opts.valueJson);
      } catch {
        throw new UsageError("--value-json must be valid JSON.", { command: "resource set-prop" });
      }
      const client = await createAuthedClient(allOpts, ctx);
      const result = await client.setResourceProp(opts.draft, opts.name, opts.prop, value);
      writeSuccess(ctx.stdout, allOpts, result, result.summary, result.shortId);
    });
}
