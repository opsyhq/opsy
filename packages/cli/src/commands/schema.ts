import { Command } from "commander";
import { getToken, getApiUrl } from "../config";
import { apiRequest } from "../client";
import { formatTable, output } from "../output";

export const schemaCmd = new Command("schema").description("Browse resource schemas");

schemaCmd
  .command("providers")
  .description("List available providers")
  .action(async function (this: Command) {
    const flags = this.parent!.parent!.opts();
    const token = getToken(flags);
    const apiUrl = getApiUrl(flags);
    try {
      const providers = await apiRequest<any[]>("/schemas/providers", { token, apiUrl });
      if (flags.json) return output(providers, flags);
      for (const p of providers) console.log(`  ${p.name ?? p.pkg ?? p}`);
    } catch (e) {
      console.error(`Error: ${e instanceof Error ? e.message : String(e)}`);
      process.exit(1);
    }
  });

schemaCmd
  .command("types")
  .description("List resource types")
  .requiredOption("--provider <pkg>", "Provider package")
  .action(async function (this: Command, opts: { provider: string }) {
    const flags = this.parent!.parent!.opts();
    const token = getToken(flags);
    const apiUrl = getApiUrl(flags);
    try {
      const types = await apiRequest<any[]>(`/schemas/types?provider=${opts.provider}`, { token, apiUrl });
      if (flags.json) return output(types, flags);
      for (const t of types) console.log(`  ${t.token ?? t}`);
    } catch (e) {
      console.error(`Error: ${e instanceof Error ? e.message : String(e)}`);
      process.exit(1);
    }
  });

schemaCmd
  .command("describe")
  .description("Describe a resource type")
  .requiredOption("--type <token>", "Resource type token")
  .action(async function (this: Command, opts: { type: string }) {
    const flags = this.parent!.parent!.opts();
    const token = getToken(flags);
    const apiUrl = getApiUrl(flags);
    try {
      const desc = await apiRequest<any>(`/schemas/describe?type=${opts.type}`, { token, apiUrl });
      output(desc, flags);
    } catch (e) {
      console.error(`Error: ${e instanceof Error ? e.message : String(e)}`);
      process.exit(1);
    }
  });
