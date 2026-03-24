import { Command } from "commander";
import { addSharedHelp, defaultCliDeps, getRootFlags, handleCliError, type CliDeps } from "./common";
import { formatTable, output } from "../output";

function parseJson(value: string) {
  return JSON.parse(value);
}

export function createChangeCommand(deps: CliDeps = defaultCliDeps) {
  const changeCmd = new Command("change").description("List, inspect, and execute changes");

  addSharedHelp(
    changeCmd.command("list")
      .description("List changes")
      .requiredOption("--workspace <slug>", "Project slug")
      .requiredOption("--env <slug>", "Environment slug")
      .action(async function (this: Command, opts: { workspace: string; env: string }) {
        const flags = getRootFlags(this);
        const token = deps.getToken(flags);
        const apiUrl = deps.getApiUrl(flags);
        try {
          const changes = await deps.apiRequest<any[]>(`/workspaces/${opts.workspace}/environments/${opts.env}/changes`, { token, apiUrl });
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
    ["change", "list"],
  );

  addSharedHelp(
    changeCmd.command("get")
      .description("Get one change")
      .argument("<shortId>")
      .action(async function (this: Command, shortId: string) {
        const flags = getRootFlags(this);
        const token = deps.getToken(flags);
        const apiUrl = deps.getApiUrl(flags);
        try {
          output(await deps.apiRequest<any>(`/changes/${shortId}`, { token, apiUrl }), flags);
        } catch (error) {
          handleCliError(error, deps);
        }
      }),
    ["change", "get"],
  );

  addSharedHelp(
    changeCmd.command("create")
      .description("Create a change")
      .requiredOption("--workspace <slug>", "Project slug")
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
    ["change", "create"],
  );

  addSharedHelp(
    changeCmd.command("append")
      .description("Append mutations to one change")
      .argument("<shortId>")
      .requiredOption("--mutations <json>", "Mutation array")
      .option("--summary <text>", "Change summary override")
      .action(async function (this: Command, shortId: string, opts: { mutations: string; summary?: string }) {
        const flags = getRootFlags(this);
        const token = deps.getToken(flags);
        const apiUrl = deps.getApiUrl(flags);
        try {
          output(await deps.apiRequest<any>(`/changes/${shortId}/mutations`, {
            method: "POST",
            body: { mutations: parseJson(opts.mutations), summary: opts.summary },
            token,
            apiUrl,
          }), flags);
        } catch (error) {
          handleCliError(error, deps);
        }
      }),
    ["change", "append"],
  );

  addSharedHelp(
    changeCmd.command("preview")
      .description("Preview one change")
      .argument("<shortId>")
      .action(async function (this: Command, shortId: string) {
        const flags = getRootFlags(this);
        const token = deps.getToken(flags);
        const apiUrl = deps.getApiUrl(flags);
        try {
          output(await deps.apiRequest<any>(`/changes/${shortId}/preview`, { method: "POST", token, apiUrl }), flags);
        } catch (error) {
          handleCliError(error, deps);
        }
      }),
    ["change", "preview"],
  );

  addSharedHelp(
    changeCmd.command("apply")
      .description("Apply one change")
      .argument("<shortId>")
      .action(async function (this: Command, shortId: string) {
        const flags = getRootFlags(this);
        const token = deps.getToken(flags);
        const apiUrl = deps.getApiUrl(flags);
        try {
          const result = await deps.apiRequest<any>(`/changes/${shortId}/apply`, { method: "POST", token, apiUrl });
          if (flags.json) return output(result, flags);
          if (result.approvalRequired) {
            deps.log(`Manual approval required for change ${result.change.shortId}.`);
            deps.log(`Review: ${result.reviewUrl}`);
            return;
          }
          output(result, flags);
        } catch (error) {
          handleCliError(error, deps);
        }
      }),
    ["change", "apply"],
  );

  addSharedHelp(
    changeCmd.command("discard")
      .description("Discard one change")
      .argument("<shortId>")
      .action(async function (this: Command, shortId: string) {
        const flags = getRootFlags(this);
        const token = deps.getToken(flags);
        const apiUrl = deps.getApiUrl(flags);
        try {
          output(await deps.apiRequest<any>(`/changes/${shortId}/dismiss`, { method: "POST", token, apiUrl }), flags);
        } catch (error) {
          handleCliError(error, deps);
        }
      }),
    ["change", "discard"],
  );

  addSharedHelp(
    changeCmd.command("retry")
      .description("Retry one failed change")
      .argument("<shortId>")
      .action(async function (this: Command, shortId: string) {
        const flags = getRootFlags(this);
        const token = deps.getToken(flags);
        const apiUrl = deps.getApiUrl(flags);
        try {
          output(await deps.apiRequest<any>(`/changes/${shortId}/retry`, { method: "POST", token, apiUrl }), flags);
        } catch (error) {
          handleCliError(error, deps);
        }
      }),
    ["change", "retry"],
  );

  return changeCmd;
}

export const changeCmd = createChangeCommand();
