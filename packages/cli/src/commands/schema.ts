import { Command } from "commander";
import { addSharedHelp, defaultCliDeps, getRootFlags, handleCliError, type CliDeps } from "./common";
import { formatTable, output } from "../output";

export function createSchemaCommand(deps: CliDeps = defaultCliDeps) {
  const schemaCmd = new Command("schema").description("List and inspect resource schemas");

  addSharedHelp(
    schemaCmd.command("list")
      .description("List resource schemas for a provider")
      .requiredOption("--provider <pkg>", "Provider package")
      .option("--query <text>", "Filter query")
      .action(async function (this: Command, opts: { provider: string; query?: string }) {
        const flags = getRootFlags(this);
        const token = deps.getToken(flags);
        const apiUrl = deps.getApiUrl(flags);
        try {
          const result = await deps.apiRequest<any>(
            `/schemas/types?provider=${encodeURIComponent(opts.provider)}${opts.query ? `&query=${encodeURIComponent(opts.query)}` : ""}`,
            { token, apiUrl },
          );
          if (flags.json) return output(result, flags);
          if (!result.types.length) return deps.log("No schemas found.");
          deps.log(formatTable(
            ["TOKEN", "NAME"],
            result.types.map((type: any) => [type.token ?? type.type ?? type.pulumiType ?? "-", type.name ?? "-"]),
          ));
        } catch (error) {
          handleCliError(error, deps);
        }
      }),
    ["schema", "list"],
  );

  addSharedHelp(
    schemaCmd.command("get")
      .description("Get one resource schema")
      .argument("<token>")
      .action(async function (this: Command, tokenArg: string) {
        const flags = getRootFlags(this);
        const token = deps.getToken(flags);
        const apiUrl = deps.getApiUrl(flags);
        try {
          output(await deps.apiRequest<any>(`/schemas/describe?type=${encodeURIComponent(tokenArg)}`, { token, apiUrl }), flags);
        } catch (error) {
          handleCliError(error, deps);
        }
      }),
    ["schema", "get"],
  );

  return schemaCmd;
}

export const schemaCmd = createSchemaCommand();
