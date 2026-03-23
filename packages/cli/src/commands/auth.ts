import { Command } from "commander";
import { loadConfig, saveConfig } from "../config";

export const authCmd = new Command("auth").description("Authentication");

authCmd
  .command("login")
  .description("Store API token for CLI access")
  .requiredOption("--token <token>", "Personal Access Token")
  .option("--api-url <url>", "API URL")
  .action((opts: { token: string; apiUrl?: string }) => {
    const config = loadConfig();
    config.token = opts.token;
    if (opts.apiUrl) config.apiUrl = opts.apiUrl;
    saveConfig(config);
    console.log("Credentials saved to ~/.opsy/config.json");
  });

authCmd
  .command("logout")
  .description("Clear stored credentials")
  .action(() => {
    saveConfig({});
    console.log("Credentials cleared.");
  });

authCmd
  .command("whoami")
  .description("Show current user")
  .action(async function (this: Command) {
    const { getToken, getApiUrl } = await import("../config.js");
    const { apiRequest } = await import("../client.js");
    const root = this.parent!.parent!;
    const flags = root.opts();
    const token = getToken(flags);
    const apiUrl = getApiUrl(flags);
    try {
      const res = await apiRequest<any>("/auth/whoami", { token, apiUrl });
      if (flags.json) {
        console.log(JSON.stringify(res, null, 2));
      } else {
        console.log(`User: ${res.user?.firstName ?? ""} ${res.user?.lastName ?? ""} (${res.actor?.userId})`);
        console.log(`Org:  ${res.actor?.orgId}`);
        console.log(`Auth: ${res.actor?.authType}`);
      }
    } catch (e) {
      console.error(`Error: ${e instanceof Error ? e.message : String(e)}`);
      process.exit(1);
    }
  });
