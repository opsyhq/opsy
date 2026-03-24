import { Command } from "commander";
import { addSharedHelp, defaultCliDeps, getRootFlags, handleCliError, type CliDeps } from "./common";
import { formatTable, output } from "../output";

export function createProjectCommand(deps: CliDeps = defaultCliDeps) {
  const projectCmd = new Command("project").description("List, get, and create projects");

  addSharedHelp(
    projectCmd.command("list")
      .description("List projects")
      .action(async function (this: Command) {
        const flags = getRootFlags(this);
        const token = deps.getToken(flags);
        const apiUrl = deps.getApiUrl(flags);
        try {
          const projects = await deps.apiRequest<any[]>("/workspaces", { token, apiUrl });
          if (flags.json) return output(projects, flags);
          if (!projects.length) return deps.log("No projects found.");
          deps.log(formatTable(
            ["SLUG", "NAME", "CREATED"],
            projects.map((project) => [project.slug, project.name, new Date(project.createdAt).toLocaleDateString()]),
          ));
        } catch (error) {
          handleCliError(error, deps);
        }
      }),
    ["project", "list"],
  );

  addSharedHelp(
    projectCmd.command("get")
      .description("Get one project")
      .argument("<slug>")
      .action(async function (this: Command, slug: string) {
        const flags = getRootFlags(this);
        const token = deps.getToken(flags);
        const apiUrl = deps.getApiUrl(flags);
        try {
          output(await deps.apiRequest<any>(`/workspaces/${slug}`, { token, apiUrl }), flags);
        } catch (error) {
          handleCliError(error, deps);
        }
      }),
    ["project", "get"],
  );

  addSharedHelp(
    projectCmd.command("create")
      .description("Create a project")
      .requiredOption("--slug <slug>", "Project slug")
      .requiredOption("--name <name>", "Project name")
      .action(async function (this: Command, opts: { slug: string; name: string }) {
        const flags = getRootFlags(this);
        const token = deps.getToken(flags);
        const apiUrl = deps.getApiUrl(flags);
        try {
          output(await deps.apiRequest<any>("/workspaces", {
            method: "POST",
            body: opts,
            token,
            apiUrl,
          }), flags);
        } catch (error) {
          handleCliError(error, deps);
        }
      }),
    ["project", "create"],
  );

  return projectCmd;
}

export const projectCmd = createProjectCommand();
