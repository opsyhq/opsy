import { Command } from "commander";
import { getToken, getApiUrl } from "../config";
import { apiRequest } from "../client";
import { formatTable, output } from "../output";

export const providerCmd = new Command("provider").description("Manage provider profiles");

providerCmd
  .command("list")
  .description("List provider profiles")
  .action(async function (this: Command) {
    const flags = this.parent!.parent!.opts();
    const token = getToken(flags);
    const apiUrl = getApiUrl(flags);
    try {
      const profiles = await apiRequest<any[]>("/providers", { token, apiUrl });
      if (flags.json) return output(profiles, flags);
      if (!profiles.length) return console.log("No provider profiles.");
      console.log(formatTable(
        ["ID", "PROVIDER", "PROFILE"],
        profiles.map((p) => [p.id.slice(0, 8), p.providerPkg, p.profileName]),
      ));
    } catch (e) {
      console.error(`Error: ${e instanceof Error ? e.message : String(e)}`);
      process.exit(1);
    }
  });

providerCmd
  .command("get <id>")
  .description("Get provider profile")
  .action(async function (this: Command, id: string) {
    const flags = this.parent!.parent!.opts();
    const token = getToken(flags);
    const apiUrl = getApiUrl(flags);
    try {
      const profile = await apiRequest<any>(`/providers/${id}`, { token, apiUrl });
      output(profile, flags);
    } catch (e) {
      console.error(`Error: ${e instanceof Error ? e.message : String(e)}`);
      process.exit(1);
    }
  });

providerCmd
  .command("create")
  .description("Create provider profile")
  .requiredOption("--provider <pkg>", "Provider package (aws, gcp, cloudflare)")
  .requiredOption("--name <name>", "Profile name")
  .requiredOption("--config <json>", "Config JSON")
  .action(async function (this: Command, opts: { provider: string; name: string; config: string }) {
    const flags = this.parent!.parent!.opts();
    const token = getToken(flags);
    const apiUrl = getApiUrl(flags);
    try {
      const config = JSON.parse(opts.config);
      const profile = await apiRequest<any>("/providers", {
        method: "POST",
        body: { providerPkg: opts.provider, profileName: opts.name, config },
        token,
        apiUrl,
      });
      if (flags.json) return output(profile, flags);
      console.log(`Provider profile created: ${profile.id}`);
    } catch (e) {
      console.error(`Error: ${e instanceof Error ? e.message : String(e)}`);
      process.exit(1);
    }
  });
