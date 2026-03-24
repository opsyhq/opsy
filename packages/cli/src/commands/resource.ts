import { Command } from "commander";
import { addSharedHelp, defaultCliDeps, getRootFlags, handleCliError, type CliDeps } from "./common";
import { formatTable, output } from "../output";

function parseJson(value: string) {
  return JSON.parse(value);
}

export function createResourceCommand(deps: CliDeps = defaultCliDeps) {
  const resourceCmd = new Command("resource").description("List, inspect, and mutate resources");

  addSharedHelp(
    resourceCmd.command("list")
      .description("List resources")
      .requiredOption("--workspace <slug>", "Project slug")
      .requiredOption("--env <slug>", "Environment slug")
      .option("--parent <slug>", "Parent resource slug")
      .option("--detailed", "Return full resource detail objects")
      .action(async function (this: Command, opts: { workspace: string; env: string; parent?: string; detailed?: boolean }) {
        const flags = getRootFlags(this);
        const token = deps.getToken(flags);
        const apiUrl = deps.getApiUrl(flags);
        const path = `/workspaces/${opts.workspace}/environments/${opts.env}/resources${opts.parent ? `?parent=${opts.parent}` : ""}`;
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
    ["resource", "list"],
  );

  addSharedHelp(
    resourceCmd.command("get")
      .description("Get one resource")
      .argument("<slug>")
      .requiredOption("--workspace <slug>", "Project slug")
      .requiredOption("--env <slug>", "Environment slug")
      .option("--live", "Include live resource comparison")
      .action(async function (this: Command, slug: string, opts: { workspace: string; env: string; live?: boolean }) {
        const flags = getRootFlags(this);
        const token = deps.getToken(flags);
        const apiUrl = deps.getApiUrl(flags);
        try {
          if (!opts.live) {
            return output(await deps.apiRequest<any>(`/workspaces/${opts.workspace}/environments/${opts.env}/resources/${slug}`, { token, apiUrl }), flags);
          }
          return output(await deps.apiRequest<any>(`/workspaces/${opts.workspace}/environments/${opts.env}/resources/${slug}/live`, { token, apiUrl }), flags);
        } catch (error) {
          handleCliError(error, deps);
        }
      }),
    ["resource", "get"],
  );

  addSharedHelp(
    resourceCmd.command("create")
      .description("Create one resource and immediately attempt apply")
      .requiredOption("--workspace <slug>", "Project slug")
      .requiredOption("--env <slug>", "Environment slug")
      .requiredOption("--slug <slug>", "Resource slug")
      .requiredOption("--type <type>", "Resource token")
      .requiredOption("--inputs <json>", "Inputs JSON object")
      .option("--parent <slug>", "Parent resource slug")
      .option("--summary <text>", "Change summary")
      .action(async function (this: Command, opts: { workspace: string; env: string; slug: string; type: string; inputs: string; parent?: string; summary?: string }) {
        const flags = getRootFlags(this);
        const token = deps.getToken(flags);
        const apiUrl = deps.getApiUrl(flags);
        try {
          output(await deps.apiRequest<any>(`/workspaces/${opts.workspace}/environments/${opts.env}/resources`, {
            method: "POST",
            body: {
              slug: opts.slug,
              type: opts.type,
              inputs: parseJson(opts.inputs),
              parentSlug: opts.parent,
              summary: opts.summary,
            },
            token,
            apiUrl,
          }), flags);
        } catch (error) {
          handleCliError(error, deps);
        }
      }),
    ["resource", "create"],
  );

  addSharedHelp(
    resourceCmd.command("update")
      .description("Update one resource and immediately attempt apply")
      .argument("<slug>")
      .requiredOption("--workspace <slug>", "Project slug")
      .requiredOption("--env <slug>", "Environment slug")
      .requiredOption("--inputs <json>", "Inputs JSON object")
      .option("--summary <text>", "Change summary")
      .option("--remove-input-paths <json>", "JSON array of input paths to remove")
      .option("--parent <slug>", "New parent slug")
      .option("--version <n>", "Optimistic-lock version")
      .action(async function (
        this: Command,
        slug: string,
        opts: { workspace: string; env: string; inputs: string; summary?: string; removeInputPaths?: string; parent?: string; version?: string },
      ) {
        const flags = getRootFlags(this);
        const token = deps.getToken(flags);
        const apiUrl = deps.getApiUrl(flags);
        try {
          output(await deps.apiRequest<any>(`/workspaces/${opts.workspace}/environments/${opts.env}/resources/${slug}`, {
            method: "PUT",
            body: {
              inputs: parseJson(opts.inputs),
              summary: opts.summary,
              removeInputPaths: opts.removeInputPaths ? parseJson(opts.removeInputPaths) : undefined,
              parentSlug: opts.parent,
              version: opts.version ? Number(opts.version) : undefined,
            },
            token,
            apiUrl,
          }), flags);
        } catch (error) {
          handleCliError(error, deps);
        }
      }),
    ["resource", "update"],
  );

  addSharedHelp(
    resourceCmd.command("delete")
      .description("Delete one resource and immediately attempt apply")
      .argument("<slug>")
      .requiredOption("--workspace <slug>", "Project slug")
      .requiredOption("--env <slug>", "Environment slug")
      .option("--recursive", "Delete descendants too")
      .action(async function (this: Command, slug: string, opts: { workspace: string; env: string; recursive?: boolean }) {
        const flags = getRootFlags(this);
        const token = deps.getToken(flags);
        const apiUrl = deps.getApiUrl(flags);
        try {
          const query = opts.recursive ? "?recursive=true" : "";
          output(await deps.apiRequest<any>(`/workspaces/${opts.workspace}/environments/${opts.env}/resources/${slug}${query}`, {
            method: "DELETE",
            token,
            apiUrl,
          }), flags);
        } catch (error) {
          handleCliError(error, deps);
        }
      }),
    ["resource", "delete"],
  );

  addSharedHelp(
    resourceCmd.command("diff")
      .description("Diff one resource")
      .argument("<slug>")
      .requiredOption("--workspace <slug>", "Project slug")
      .requiredOption("--env <slug>", "Environment slug")
      .action(async function (this: Command, slug: string, opts: { workspace: string; env: string }) {
        const flags = getRootFlags(this);
        const token = deps.getToken(flags);
        const apiUrl = deps.getApiUrl(flags);
        try {
          output(await deps.apiRequest<any>(`/workspaces/${opts.workspace}/environments/${opts.env}/resources/${slug}/diff`, { token, apiUrl }), flags);
        } catch (error) {
          handleCliError(error, deps);
        }
      }),
    ["resource", "diff"],
  );

  addSharedHelp(
    resourceCmd.command("refresh")
      .description("Refresh one resource")
      .argument("<slug>")
      .requiredOption("--workspace <slug>", "Project slug")
      .requiredOption("--env <slug>", "Environment slug")
      .action(async function (this: Command, slug: string, opts: { workspace: string; env: string }) {
        const flags = getRootFlags(this);
        const token = deps.getToken(flags);
        const apiUrl = deps.getApiUrl(flags);
        try {
          output(await deps.apiRequest<any>(`/workspaces/${opts.workspace}/environments/${opts.env}/resources/${slug}/sync`, {
            method: "POST",
            token,
            apiUrl,
          }), flags);
        } catch (error) {
          handleCliError(error, deps);
        }
      }),
    ["resource", "refresh"],
  );

  addSharedHelp(
    resourceCmd.command("accept-live")
      .description("Accept live state for one resource")
      .argument("<slug>")
      .requiredOption("--workspace <slug>", "Project slug")
      .requiredOption("--env <slug>", "Environment slug")
      .action(async function (this: Command, slug: string, opts: { workspace: string; env: string }) {
        const flags = getRootFlags(this);
        const token = deps.getToken(flags);
        const apiUrl = deps.getApiUrl(flags);
        try {
          output(await deps.apiRequest<any>(`/workspaces/${opts.workspace}/environments/${opts.env}/resources/${slug}/accept-live`, {
            method: "POST",
            token,
            apiUrl,
          }), flags);
        } catch (error) {
          handleCliError(error, deps);
        }
      }),
    ["resource", "accept-live"],
  );

  addSharedHelp(
    resourceCmd.command("reconcile")
      .description("Promote desired state through a change")
      .argument("<slug>")
      .requiredOption("--workspace <slug>", "Project slug")
      .requiredOption("--env <slug>", "Environment slug")
      .action(async function (this: Command, slug: string, opts: { workspace: string; env: string }) {
        const flags = getRootFlags(this);
        const token = deps.getToken(flags);
        const apiUrl = deps.getApiUrl(flags);
        try {
          output(await deps.apiRequest<any>(`/workspaces/${opts.workspace}/environments/${opts.env}/resources/${slug}/promote-current`, {
            method: "POST",
            token,
            apiUrl,
          }), flags);
        } catch (error) {
          handleCliError(error, deps);
        }
      }),
    ["resource", "reconcile"],
  );

  addSharedHelp(
    resourceCmd.command("restore")
      .description("Restore one resource from an operation snapshot")
      .argument("<slug>")
      .requiredOption("--workspace <slug>", "Project slug")
      .requiredOption("--env <slug>", "Environment slug")
      .requiredOption("--operation <id>", "Operation id")
      .action(async function (this: Command, slug: string, opts: { workspace: string; env: string; operation: string }) {
        const flags = getRootFlags(this);
        const token = deps.getToken(flags);
        const apiUrl = deps.getApiUrl(flags);
        try {
          output(await deps.apiRequest<any>(`/workspaces/${opts.workspace}/environments/${opts.env}/resources/${slug}/restore`, {
            method: "POST",
            body: { operationId: opts.operation },
            token,
            apiUrl,
          }), flags);
        } catch (error) {
          handleCliError(error, deps);
        }
      }),
    ["resource", "restore"],
  );

  addSharedHelp(
    resourceCmd.command("history")
      .description("List history for one resource")
      .argument("<slug>")
      .requiredOption("--workspace <slug>", "Project slug")
      .requiredOption("--env <slug>", "Environment slug")
      .action(async function (this: Command, slug: string, opts: { workspace: string; env: string }) {
        const flags = getRootFlags(this);
        const token = deps.getToken(flags);
        const apiUrl = deps.getApiUrl(flags);
        try {
          output(await deps.apiRequest<any>(`/workspaces/${opts.workspace}/environments/${opts.env}/resources/${slug}/history`, { token, apiUrl }), flags);
        } catch (error) {
          handleCliError(error, deps);
        }
      }),
    ["resource", "history"],
  );

  return resourceCmd;
}

export const resourceCmd = createResourceCommand();
