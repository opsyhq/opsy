import { Command } from "commander";
import {
  addSharedHelp,
  defaultCliDeps,
  getRootFlags,
  handleCliError,
  parseJsonFlag,
  requireArgumentValue,
  requireOptionValue,
  type CliDeps,
} from "./common";
import { formatTable, output } from "../output";

export function createResourceCommand(deps: CliDeps = defaultCliDeps) {
  const resourceCmd = new Command("resource").description("List, inspect, and mutate resources");

  addSharedHelp(
    resourceCmd.command("list")
      .description("List resources")
      .option("--workspace <slug>", "Workspace slug")
      .option("--env <slug>", "Environment slug")
      .option("--parent <slug>", "Parent resource slug")
      .option("--detailed", "Return full resource detail objects")
      .action(async function (this: Command, opts: { workspace?: string; env?: string; parent?: string; detailed?: boolean }) {
        const flags = getRootFlags(this);
        try {
          const workspace = requireOptionValue(opts.workspace, "workspace");
          const env = requireOptionValue(opts.env, "env");
          const token = deps.getToken(flags);
          const apiUrl = deps.getApiUrl(flags);
          const path = `/workspaces/${workspace}/environments/${env}/resources${opts.parent ? `?parent=${opts.parent}` : ""}`;
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
      .argument("[slug]")
      .option("--workspace <slug>", "Workspace slug")
      .option("--env <slug>", "Environment slug")
      .option("--live", "Include live resource comparison")
      .action(async function (this: Command, slug: string | undefined, opts: { workspace?: string; env?: string; live?: boolean }) {
        const flags = getRootFlags(this);
        try {
          const workspace = requireOptionValue(opts.workspace, "workspace");
          const env = requireOptionValue(opts.env, "env");
          const resourceSlug = requireArgumentValue(slug, "resource slug");
          const token = deps.getToken(flags);
          const apiUrl = deps.getApiUrl(flags);
          if (!opts.live) {
            return output(await deps.apiRequest<any>(`/workspaces/${workspace}/environments/${env}/resources/${resourceSlug}`, { token, apiUrl }), flags);
          }
          return output(await deps.apiRequest<any>(`/workspaces/${workspace}/environments/${env}/resources/${resourceSlug}/live`, { token, apiUrl }), flags);
        } catch (error) {
          handleCliError(error, deps);
        }
      }),
    ["resource", "get"],
  );

  addSharedHelp(
    resourceCmd.command("create")
      .description("Create one resource and immediately attempt apply")
      .option("--workspace <slug>", "Workspace slug")
      .option("--env <slug>", "Environment slug")
      .option("--slug <slug>", "Resource slug")
      .option("--type <type>", "Resource token")
      .option("--inputs <json>", "Inputs JSON object")
      .option("--parent <slug>", "Parent resource slug")
      .option("--summary <text>", "Change summary")
      .action(async function (
        this: Command,
        opts: { workspace?: string; env?: string; slug?: string; type?: string; inputs?: string; parent?: string; summary?: string },
      ) {
        const flags = getRootFlags(this);
        try {
          const workspace = requireOptionValue(opts.workspace, "workspace");
          const env = requireOptionValue(opts.env, "env");
          const resourceSlug = requireOptionValue(opts.slug, "slug");
          const type = requireOptionValue(opts.type, "type");
          const inputs = parseJsonFlag(requireOptionValue(opts.inputs, "inputs"), "inputs");
          const token = deps.getToken(flags);
          const apiUrl = deps.getApiUrl(flags);
          output(await deps.apiRequest<any>(`/workspaces/${workspace}/environments/${env}/resources`, {
            method: "POST",
            body: {
              slug: resourceSlug,
              type,
              inputs,
              parent: opts.parent,
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
      .argument("[slug]")
      .option("--workspace <slug>", "Workspace slug")
      .option("--env <slug>", "Environment slug")
      .option("--inputs <json>", "Inputs JSON object")
      .option("--summary <text>", "Change summary")
      .option("--remove-input-paths <json>", "JSON array of input paths to remove")
      .option("--parent <slug>", "New parent slug")
      .option("--version <n>", "Optimistic-lock version")
      .action(async function (
        this: Command,
        slug: string | undefined,
        opts: { workspace?: string; env?: string; inputs?: string; summary?: string; removeInputPaths?: string; parent?: string; version?: string },
      ) {
        const flags = getRootFlags(this);
        try {
          const workspace = requireOptionValue(opts.workspace, "workspace");
          const env = requireOptionValue(opts.env, "env");
          const resourceSlug = requireArgumentValue(slug, "resource slug");
          const inputs = parseJsonFlag(requireOptionValue(opts.inputs, "inputs"), "inputs");
          const token = deps.getToken(flags);
          const apiUrl = deps.getApiUrl(flags);
          output(await deps.apiRequest<any>(
            `/workspaces/${workspace}/environments/${env}/resources/${resourceSlug}`,
            {
              method: "PUT",
              body: {
                inputs,
                summary: opts.summary,
                removeInputPaths: opts.removeInputPaths ? parseJsonFlag(opts.removeInputPaths, "remove-input-paths") : undefined,
                parent: opts.parent,
                version: opts.version ? Number(opts.version) : undefined,
              },
              token,
              apiUrl,
            }),
            flags,
          );
        } catch (error) {
          handleCliError(error, deps);
        }
      }),
    ["resource", "update"],
  );

  addSharedHelp(
    resourceCmd.command("delete")
      .description("Delete one resource and immediately attempt apply")
      .argument("[slug]")
      .option("--workspace <slug>", "Workspace slug")
      .option("--env <slug>", "Environment slug")
      .option("--recursive", "Delete descendants too")
      .action(async function (this: Command, slug: string | undefined, opts: { workspace?: string; env?: string; recursive?: boolean }) {
        const flags = getRootFlags(this);
        try {
          const workspace = requireOptionValue(opts.workspace, "workspace");
          const env = requireOptionValue(opts.env, "env");
          const resourceSlug = requireArgumentValue(slug, "resource slug");
          const token = deps.getToken(flags);
          const apiUrl = deps.getApiUrl(flags);
          const query = opts.recursive ? "?recursive=true" : "";
          output(await deps.apiRequest<any>(
            `/workspaces/${workspace}/environments/${env}/resources/${resourceSlug}${query}`,
            {
              method: "DELETE",
              token,
              apiUrl,
            }),
            flags,
          );
        } catch (error) {
          handleCliError(error, deps);
        }
      }),
    ["resource", "delete"],
  );

  addSharedHelp(
    resourceCmd.command("diff")
      .description("Diff one resource")
      .argument("[slug]")
      .option("--workspace <slug>", "Workspace slug")
      .option("--env <slug>", "Environment slug")
      .action(async function (this: Command, slug: string | undefined, opts: { workspace?: string; env?: string }) {
        const flags = getRootFlags(this);
        try {
          const workspace = requireOptionValue(opts.workspace, "workspace");
          const env = requireOptionValue(opts.env, "env");
          const resourceSlug = requireArgumentValue(slug, "resource slug");
          const token = deps.getToken(flags);
          const apiUrl = deps.getApiUrl(flags);
          output(await deps.apiRequest<any>(
            `/workspaces/${workspace}/environments/${env}/resources/${resourceSlug}/diff`,
            { token, apiUrl },
          ), flags);
        } catch (error) {
          handleCliError(error, deps);
        }
      }),
    ["resource", "diff"],
  );

  addSharedHelp(
    resourceCmd.command("refresh")
      .description("Refresh one resource")
      .argument("[slug]")
      .option("--workspace <slug>", "Workspace slug")
      .option("--env <slug>", "Environment slug")
      .action(async function (this: Command, slug: string | undefined, opts: { workspace?: string; env?: string }) {
        const flags = getRootFlags(this);
        try {
          const workspace = requireOptionValue(opts.workspace, "workspace");
          const env = requireOptionValue(opts.env, "env");
          const resourceSlug = requireArgumentValue(slug, "resource slug");
          const token = deps.getToken(flags);
          const apiUrl = deps.getApiUrl(flags);
          output(await deps.apiRequest<any>(
            `/workspaces/${workspace}/environments/${env}/resources/${resourceSlug}/sync`,
            {
              method: "POST",
              token,
              apiUrl,
            }),
            flags,
          );
        } catch (error) {
          handleCliError(error, deps);
        }
      }),
    ["resource", "refresh"],
  );

  addSharedHelp(
    resourceCmd.command("accept-live")
      .description("Accept live state for one resource")
      .argument("[slug]")
      .option("--workspace <slug>", "Workspace slug")
      .option("--env <slug>", "Environment slug")
      .action(async function (this: Command, slug: string | undefined, opts: { workspace?: string; env?: string }) {
        const flags = getRootFlags(this);
        try {
          const workspace = requireOptionValue(opts.workspace, "workspace");
          const env = requireOptionValue(opts.env, "env");
          const resourceSlug = requireArgumentValue(slug, "resource slug");
          const token = deps.getToken(flags);
          const apiUrl = deps.getApiUrl(flags);
          output(await deps.apiRequest<any>(
            `/workspaces/${workspace}/environments/${env}/resources/${resourceSlug}/accept-live`,
            {
              method: "POST",
              token,
              apiUrl,
            }),
            flags,
          );
        } catch (error) {
          handleCliError(error, deps);
        }
      }),
    ["resource", "accept-live"],
  );

  addSharedHelp(
    resourceCmd.command("reconcile")
      .description("Promote desired state through a change")
      .argument("[slug]")
      .option("--workspace <slug>", "Workspace slug")
      .option("--env <slug>", "Environment slug")
      .action(async function (this: Command, slug: string | undefined, opts: { workspace?: string; env?: string }) {
        const flags = getRootFlags(this);
        try {
          const workspace = requireOptionValue(opts.workspace, "workspace");
          const env = requireOptionValue(opts.env, "env");
          const resourceSlug = requireArgumentValue(slug, "resource slug");
          const token = deps.getToken(flags);
          const apiUrl = deps.getApiUrl(flags);
          output(await deps.apiRequest<any>(
            `/workspaces/${workspace}/environments/${env}/resources/${resourceSlug}/promote-current`,
            {
              method: "POST",
              token,
              apiUrl,
            }),
            flags,
          );
        } catch (error) {
          handleCliError(error, deps);
        }
      }),
    ["resource", "reconcile"],
  );

  addSharedHelp(
    resourceCmd.command("restore")
      .description("Restore one resource from an operation snapshot")
      .argument("[slug]")
      .option("--workspace <slug>", "Workspace slug")
      .option("--env <slug>", "Environment slug")
      .option("--operation <id>", "Operation id")
      .action(async function (this: Command, slug: string | undefined, opts: { workspace?: string; env?: string; operation?: string }) {
        const flags = getRootFlags(this);
        try {
          const workspace = requireOptionValue(opts.workspace, "workspace");
          const env = requireOptionValue(opts.env, "env");
          const resourceSlug = requireArgumentValue(slug, "resource slug");
          const operation = requireOptionValue(opts.operation, "operation");
          const token = deps.getToken(flags);
          const apiUrl = deps.getApiUrl(flags);
          output(await deps.apiRequest<any>(
            `/workspaces/${workspace}/environments/${env}/resources/${resourceSlug}/restore`,
            {
              method: "POST",
              body: { operationId: operation },
              token,
              apiUrl,
            }),
            flags,
          );
        } catch (error) {
          handleCliError(error, deps);
        }
      }),
    ["resource", "restore"],
  );

  addSharedHelp(
    resourceCmd.command("history")
      .description("List history for one resource")
      .argument("[slug]")
      .option("--workspace <slug>", "Workspace slug")
      .option("--env <slug>", "Environment slug")
      .action(async function (this: Command, slug: string | undefined, opts: { workspace?: string; env?: string }) {
        const flags = getRootFlags(this);
        try {
          const workspace = requireOptionValue(opts.workspace, "workspace");
          const env = requireOptionValue(opts.env, "env");
          const resourceSlug = requireArgumentValue(slug, "resource slug");
          const token = deps.getToken(flags);
          const apiUrl = deps.getApiUrl(flags);
          output(await deps.apiRequest<any>(
            `/workspaces/${workspace}/environments/${env}/resources/${resourceSlug}/history`,
            { token, apiUrl },
          ), flags);
        } catch (error) {
          handleCliError(error, deps);
        }
      }),
    ["resource", "history"],
  );

  return resourceCmd;
}

export const resourceCmd = createResourceCommand();
