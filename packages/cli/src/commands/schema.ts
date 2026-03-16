import type { Command } from "commander";
import type { CommandContext } from "./helpers.js";
import { getHelpText } from "../help.js";
import { addCommonOptions, createAuthedClient, createGroupCommand, writeSuccess } from "./helpers.js";
import type { SchemaGetResponse, SchemaScaffoldResponse, SchemaSearchResponse } from "../schemas.js";

function formatSchemaSearch(result: SchemaSearchResponse): string {
  if (result.items.length === 0) return result.summary;
  const lines = [result.summary];
  for (const item of result.items) {
    lines.push(`${item.token}  ${item.summary}`);
    if (item.keyProps.length > 0) {
      lines.push(`  ${item.keyProps.join(" | ")}`);
    }
  }
  return lines.join("\n");
}

function formatSchemaGet(result: SchemaGetResponse): string {
  const lines = [result.token];
  if (result.summary) lines.push(result.summary);
  if (result.requiredInputs.length > 0) {
    lines.push("", "Required");
    for (const field of result.requiredInputs) lines.push(`- ${field.name}: ${field.typeHint}`);
  }
  if (result.commonOptionalInputs.length > 0) {
    lines.push("", "Common optional");
    for (const field of result.commonOptionalInputs) lines.push(`- ${field.name}: ${field.typeHint}`);
  }
  return lines.join("\n");
}

function formatSchemaScaffold(result: SchemaScaffoldResponse): string {
  const lines = [result.token, "", "Minimal props", JSON.stringify(result.minimalProps, null, 2)];
  if (result.notes.length > 0) {
    lines.push("", "Notes");
    for (const note of result.notes) lines.push(`- ${note}`);
  }
  return lines.join("\n");
}

export function registerSchemaCommands(parent: Command, ctx: CommandContext) {
  const group = createGroupCommand(parent, "schema", ctx)
    .description("Search and inspect resource schemas.");

  addCommonOptions(group.command("search"))
    .description("Search resource type tokens.")
    .argument("<query...>", "Search text")
    .configureHelp({ formatHelp: () => getHelpText("schema search") + "\n" })
    .action(async (queryParts, opts, cmd) => {
      const allOpts = cmd.optsWithGlobals();
      const client = await createAuthedClient(allOpts, ctx);
      const result = await client.searchSchemas((queryParts as string[]).join(" "));
      writeSuccess(ctx.stdout, allOpts, result, formatSchemaSearch(result));
    });

  addCommonOptions(group.command("get"))
    .description("Show a compact resource schema.")
    .argument("<token>", "Exact Pulumi token")
    .configureHelp({ formatHelp: () => getHelpText("schema get") + "\n" })
    .action(async (token, opts, cmd) => {
      const allOpts = cmd.optsWithGlobals();
      const client = await createAuthedClient(allOpts, ctx);
      const result = await client.getSchema(token);
      writeSuccess(ctx.stdout, allOpts, result, formatSchemaGet(result));
    });

  addCommonOptions(group.command("scaffold"))
    .description("Generate a starter scaffold for a resource token.")
    .argument("<token>", "Exact Pulumi token")
    .configureHelp({ formatHelp: () => getHelpText("schema scaffold") + "\n" })
    .action(async (token, opts, cmd) => {
      const allOpts = cmd.optsWithGlobals();
      const client = await createAuthedClient(allOpts, ctx);
      const result = await client.getSchemaScaffold(token);
      writeSuccess(ctx.stdout, allOpts, result, formatSchemaScaffold(result));
    });
}
