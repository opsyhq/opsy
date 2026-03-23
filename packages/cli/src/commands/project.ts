import { Command } from "commander";
import { getToken, getApiUrl } from "../config";
import { apiRequest } from "../client";
import { formatTable, output } from "../output";

export const projectCmd = new Command("project").description("Manage workspaces/projects");

projectCmd
  .command("list")
  .description("List projects")
  .action(async function (this: Command) {
    const flags = this.parent!.parent!.opts();
    const token = getToken(flags);
    const apiUrl = getApiUrl(flags);
    try {
      const projects = await apiRequest<any[]>("/projects", { token, apiUrl });
      if (flags.json) return output(projects, flags);
      if (!projects.length) return console.log("No projects found.");
      console.log(formatTable(
        ["SLUG", "NAME", "CREATED"],
        projects.map((p) => [p.slug, p.name, new Date(p.createdAt).toLocaleDateString()]),
      ));
    } catch (e) {
      console.error(`Error: ${e instanceof Error ? e.message : String(e)}`);
      process.exit(1);
    }
  });

projectCmd
  .command("get <slug>")
  .description("Get project details")
  .action(async function (this: Command, slug: string) {
    const flags = this.parent!.parent!.opts();
    const token = getToken(flags);
    const apiUrl = getApiUrl(flags);
    try {
      const project = await apiRequest<any>(`/projects/${slug}`, { token, apiUrl });
      output(project, flags);
    } catch (e) {
      console.error(`Error: ${e instanceof Error ? e.message : String(e)}`);
      process.exit(1);
    }
  });

projectCmd
  .command("create")
  .description("Create a project")
  .requiredOption("--slug <slug>", "Project slug")
  .requiredOption("--name <name>", "Project name")
  .action(async function (this: Command, opts: { slug: string; name: string }) {
    const flags = this.parent!.parent!.opts();
    const token = getToken(flags);
    const apiUrl = getApiUrl(flags);
    try {
      const project = await apiRequest<any>("/projects", { method: "POST", body: { slug: opts.slug, name: opts.name }, token, apiUrl });
      if (flags.json) return output(project, flags);
      console.log(`Project created: ${project.slug}`);
    } catch (e) {
      console.error(`Error: ${e instanceof Error ? e.message : String(e)}`);
      process.exit(1);
    }
  });
