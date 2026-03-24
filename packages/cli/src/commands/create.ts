import { Command } from "commander";
import { addSharedHelp, defaultCliDeps, getRootFlags, handleCliError, type CliDeps } from "./common";
import { output } from "../output";

function parseJson(value: string) {
  return JSON.parse(value);
}

export function createCreateCommand(deps: CliDeps = defaultCliDeps) {
  const createCmd = new Command("create").description("Create resources and other nouns");

  addSharedHelp(
    createCmd.command("resource")
      .description("Create one resource and immediately attempt apply")
      .requiredOption("--workspace <slug>", "Workspace slug")
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
    ["create", "resource"],
  );

  addSharedHelp(
    createCmd.command("change")
      .description("Create a change")
      .requiredOption("--workspace <slug>", "Workspace slug")
      .requiredOption("--env <slug>", "Environment slug")
      .option("--mutations <json>", "Mutation array")
      .option("--summary <text>", "Change summary")
      .action(async function (this: Command, opts: { workspace: string; env: string; mutations?: string; summary?: string }) {
        const flags = getRootFlags(this);
        const token = deps.getToken(flags);
        const apiUrl = deps.getApiUrl(flags);
        try {
          const body: Record<string, unknown> = {};
          if (opts.summary) body.summary = opts.summary;
          if (opts.mutations) body.mutations = parseJson(opts.mutations);
          output(await deps.apiRequest<any>(`/workspaces/${opts.workspace}/environments/${opts.env}/changes`, {
            method: "POST",
            body,
            token,
            apiUrl,
          }), flags);
        } catch (error) {
          handleCliError(error, deps);
        }
      }),
    ["create", "change"],
  );

  addSharedHelp(
    createCmd.command("workspace")
      .description("Create a workspace")
      .requiredOption("--slug <slug>", "Workspace slug")
      .requiredOption("--name <name>", "Workspace name")
      .action(async function (this: Command, opts: { slug: string; name: string }) {
        const flags = getRootFlags(this);
        const token = deps.getToken(flags);
        const apiUrl = deps.getApiUrl(flags);
        try {
          output(await deps.apiRequest<any>("/workspaces", { method: "POST", body: opts, token, apiUrl }), flags);
        } catch (error) {
          handleCliError(error, deps);
        }
      }),
    ["create", "workspace"],
  );

  addSharedHelp(
    createCmd.command("env")
      .description("Create an environment")
      .requiredOption("--workspace <slug>", "Workspace slug")
      .requiredOption("--slug <slug>", "Environment slug")
      .action(async function (this: Command, opts: { workspace: string; slug: string }) {
        const flags = getRootFlags(this);
        const token = deps.getToken(flags);
        const apiUrl = deps.getApiUrl(flags);
        try {
          output(await deps.apiRequest<any>(`/workspaces/${opts.workspace}/environments`, {
            method: "POST",
            body: { slug: opts.slug },
            token,
            apiUrl,
          }), flags);
        } catch (error) {
          handleCliError(error, deps);
        }
      }),
    ["create", "env"],
  );

  addSharedHelp(
    createCmd.command("provider")
      .description("Create a provider profile")
      .requiredOption("--provider <pkg>", "Provider package")
      .requiredOption("--name <name>", "Profile name")
      .requiredOption("--config <json>", "Provider config JSON")
      .action(async function (this: Command, opts: { provider: string; name: string; config: string }) {
        const flags = getRootFlags(this);
        const token = deps.getToken(flags);
        const apiUrl = deps.getApiUrl(flags);
        try {
          output(await deps.apiRequest<any>("/providers", {
            method: "POST",
            body: { providerPkg: opts.provider, profileName: opts.name, config: parseJson(opts.config) },
            token,
            apiUrl,
          }), flags);
        } catch (error) {
          handleCliError(error, deps);
        }
      }),
    ["create", "provider"],
  );

  return createCmd;
}

export const createCmd = createCreateCommand();
