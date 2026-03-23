import { Command } from "commander";
import { getToken, getApiUrl } from "../config";
import { apiRequest } from "../client";
import { formatTable, output } from "../output";

export const envCmd = new Command("env").description("Manage environments");

envCmd
  .command("list")
  .description("List environments")
  .requiredOption("--project <slug>", "Project slug")
  .action(async function (this: Command, opts: { project: string }) {
    const flags = this.parent!.parent!.opts();
    const token = getToken(flags);
    const apiUrl = getApiUrl(flags);
    try {
      const envs = await apiRequest<any[]>(`/projects/${opts.project}/environments`, { token, apiUrl });
      if (flags.json) return output(envs, flags);
      if (!envs.length) return console.log("No environments found.");
      console.log(formatTable(
        ["SLUG", "AUTO-APPLY", "CREATED"],
        envs.map((e) => [e.slug, e.autoApply ? "yes" : "no", new Date(e.createdAt).toLocaleDateString()]),
      ));
    } catch (e) {
      console.error(`Error: ${e instanceof Error ? e.message : String(e)}`);
      process.exit(1);
    }
  });

envCmd
  .command("get")
  .description("Get environment details")
  .requiredOption("--project <slug>", "Project slug")
  .requiredOption("--env <slug>", "Environment slug")
  .action(async function (this: Command, opts: { project: string; env: string }) {
    const flags = this.parent!.parent!.opts();
    const token = getToken(flags);
    const apiUrl = getApiUrl(flags);
    try {
      const env = await apiRequest<any>(`/projects/${opts.project}/environments/${opts.env}`, { token, apiUrl });
      output(env, flags);
    } catch (e) {
      console.error(`Error: ${e instanceof Error ? e.message : String(e)}`);
      process.exit(1);
    }
  });

envCmd
  .command("create")
  .description("Create an environment")
  .requiredOption("--project <slug>", "Project slug")
  .requiredOption("--slug <slug>", "Environment slug")
  .action(async function (this: Command, opts: { project: string; slug: string }) {
    const flags = this.parent!.parent!.opts();
    const token = getToken(flags);
    const apiUrl = getApiUrl(flags);
    try {
      const env = await apiRequest<any>(`/projects/${opts.project}/environments`, { method: "POST", body: { slug: opts.slug }, token, apiUrl });
      if (flags.json) return output(env, flags);
      console.log(`Environment created: ${env.slug}`);
    } catch (e) {
      console.error(`Error: ${e instanceof Error ? e.message : String(e)}`);
      process.exit(1);
    }
  });
