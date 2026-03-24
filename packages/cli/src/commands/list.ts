import { Command } from "commander";
import { addSharedHelp, defaultCliDeps, getRootFlags, handleCliError, type CliDeps } from "./common";
import { formatTable, output } from "../output";

export function createListCommand(deps: CliDeps = defaultCliDeps) {
  const listCmd = new Command("list").description("List resources and other nouns");

  addSharedHelp(
    listCmd.command("resources")
      .description("List resources")
      .requiredOption("--project <slug>", "Project slug")
      .requiredOption("--env <slug>", "Environment slug")
      .option("--parent <slug>", "Parent resource slug")
      .option("--detailed", "Return full resource detail objects")
      .action(async function (this: Command, opts: { project: string; env: string; parent?: string; detailed?: boolean }) {
        const flags = getRootFlags(this);
        const token = deps.getToken(flags);
        const apiUrl = deps.getApiUrl(flags);
        const path = `/projects/${opts.project}/environments/${opts.env}/resources${opts.parent ? `?parent=${opts.parent}` : ""}`;
        try {
          const resources = await deps.apiRequest<any[]>(path, { token, apiUrl });
          if (flags.json || opts.detailed) return output(resources, flags);
          if (!resources.length) return deps.log("No resources found.");
          deps.log(formatTable(
            ["SLUG", "KIND", "TYPE", "STATUS"],
            resources.map((resource) => [resource.slug, resource.kind, resource.type, resource.status]),
          ));
        } catch (error) {
          handleCliError(error, deps);
        }
      }),
    ["list", "resources"],
  );

  addSharedHelp(
    listCmd.command("changes")
      .description("List changes")
      .requiredOption("--project <slug>", "Project slug")
      .requiredOption("--env <slug>", "Environment slug")
      .action(async function (this: Command, opts: { project: string; env: string }) {
        const flags = getRootFlags(this);
        const token = deps.getToken(flags);
        const apiUrl = deps.getApiUrl(flags);
        try {
          const changes = await deps.apiRequest<any[]>(`/projects/${opts.project}/environments/${opts.env}/changes`, { token, apiUrl });
          if (flags.json) return output(changes, flags);
          if (!changes.length) return deps.log("No changes found.");
          deps.log(formatTable(
            ["SHORT-ID", "STATUS", "SUMMARY", "CREATED"],
            changes.map((change) => [change.shortId, change.status, change.summary ?? "-", new Date(change.createdAt).toLocaleDateString()]),
          ));
        } catch (error) {
          handleCliError(error, deps);
        }
      }),
    ["list", "changes"],
  );

  addSharedHelp(
    listCmd.command("projects")
      .description("List projects")
      .action(async function (this: Command) {
        const flags = getRootFlags(this);
        const token = deps.getToken(flags);
        const apiUrl = deps.getApiUrl(flags);
        try {
          const projects = await deps.apiRequest<any[]>("/projects", { token, apiUrl });
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
    ["list", "projects"],
  );

  addSharedHelp(
    listCmd.command("envs")
      .description("List environments")
      .requiredOption("--project <slug>", "Project slug")
      .action(async function (this: Command, opts: { project: string }) {
        const flags = getRootFlags(this);
        const token = deps.getToken(flags);
        const apiUrl = deps.getApiUrl(flags);
        try {
          const envs = await deps.apiRequest<any[]>(`/projects/${opts.project}/environments`, { token, apiUrl });
          if (flags.json) return output(envs, flags);
          if (!envs.length) return deps.log("No environments found.");
          deps.log(formatTable(
            ["SLUG", "AUTO-APPLY", "CREATED"],
            envs.map((env) => [env.slug, env.autoApplyPolicy ?? "disabled", new Date(env.createdAt).toLocaleDateString()]),
          ));
        } catch (error) {
          handleCliError(error, deps);
        }
      }),
    ["list", "envs"],
  );

  addSharedHelp(
    listCmd.command("providers")
      .description("List provider profiles")
      .action(async function (this: Command) {
        const flags = getRootFlags(this);
        const token = deps.getToken(flags);
        const apiUrl = deps.getApiUrl(flags);
        try {
          const providers = await deps.apiRequest<any[]>("/providers", { token, apiUrl });
          if (flags.json) return output(providers, flags);
          if (!providers.length) return deps.log("No provider profiles.");
          deps.log(formatTable(
            ["ID", "PROVIDER", "PROFILE"],
            providers.map((provider) => [provider.id.slice(0, 8), provider.providerPkg, provider.profileName]),
          ));
        } catch (error) {
          handleCliError(error, deps);
        }
      }),
    ["list", "providers"],
  );

  addSharedHelp(
    listCmd.command("schemas")
      .description("List resource schemas for a provider")
      .requiredOption("--provider <pkg>", "Provider package")
      .option("--query <text>", "Filter query")
      .action(async function (this: Command, opts: { provider: string; query?: string }) {
        const flags = getRootFlags(this);
        const token = deps.getToken(flags);
        const apiUrl = deps.getApiUrl(flags);
        try {
          const result = await deps.apiRequest<any>(`/schemas/types?provider=${encodeURIComponent(opts.provider)}${opts.query ? `&query=${encodeURIComponent(opts.query)}` : ""}`, { token, apiUrl });
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
    ["list", "schemas"],
  );

  return listCmd;
}

export const listCmd = createListCommand();
