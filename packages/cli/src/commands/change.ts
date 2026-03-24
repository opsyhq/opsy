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

export function createChangeCommand(deps: CliDeps = defaultCliDeps) {
  const changeCmd = new Command("change").description("List, inspect, and execute changes");

  addSharedHelp(
    changeCmd.command("list")
      .description("List changes")
      .option("--workspace <slug>", "Workspace slug")
      .option("--env <slug>", "Environment slug")
      .action(async function (this: Command, opts: { workspace?: string; env?: string }) {
        const flags = getRootFlags(this);
        try {
          const workspace = requireOptionValue(opts.workspace, "workspace");
          const env = requireOptionValue(opts.env, "env");
          const token = deps.getToken(flags);
          const apiUrl = deps.getApiUrl(flags);
          const changes = await deps.apiRequest<any[]>(
            `/workspaces/${workspace}/environments/${env}/changes`,
            { token, apiUrl },
          );
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
      .argument("[shortId]")
      .action(async function (this: Command, shortId?: string) {
        const flags = getRootFlags(this);
        try {
          const changeShortId = requireArgumentValue(shortId, "change shortId");
          const token = deps.getToken(flags);
          const apiUrl = deps.getApiUrl(flags);
          output(await deps.apiRequest<any>(`/changes/${changeShortId}`, { token, apiUrl }), flags);
        } catch (error) {
          handleCliError(error, deps);
        }
      }),
    ["change", "get"],
  );

  addSharedHelp(
    changeCmd.command("create")
      .description("Create a change")
      .option("--workspace <slug>", "Workspace slug")
      .option("--env <slug>", "Environment slug")
      .option("--mutations <json>", "Mutation array")
      .option("--summary <text>", "Change summary")
      .action(async function (this: Command, opts: { workspace?: string; env?: string; mutations?: string; summary?: string }) {
        const flags = getRootFlags(this);
        try {
          const workspace = requireOptionValue(opts.workspace, "workspace");
          const env = requireOptionValue(opts.env, "env");
          const body: Record<string, unknown> = {};
          if (opts.summary) body.summary = opts.summary;
          if (opts.mutations) body.mutations = parseJsonFlag(opts.mutations, "mutations");
          const token = deps.getToken(flags);
          const apiUrl = deps.getApiUrl(flags);
          output(await deps.apiRequest<any>(
            `/workspaces/${workspace}/environments/${env}/changes`,
            {
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
      .argument("[shortId]")
      .option("--mutations <json>", "Mutation array")
      .option("--summary <text>", "Change summary override")
      .action(async function (this: Command, shortId: string | undefined, opts: { mutations?: string; summary?: string }) {
        const flags = getRootFlags(this);
        try {
          const changeShortId = requireArgumentValue(shortId, "change shortId");
          const mutations = parseJsonFlag(requireOptionValue(opts.mutations, "mutations"), "mutations");
          const token = deps.getToken(flags);
          const apiUrl = deps.getApiUrl(flags);
          output(await deps.apiRequest<any>(`/changes/${changeShortId}/mutations`, {
            method: "POST",
            body: { mutations, summary: opts.summary },
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
      .argument("[shortId]")
      .action(async function (this: Command, shortId?: string) {
        const flags = getRootFlags(this);
        try {
          const changeShortId = requireArgumentValue(shortId, "change shortId");
          const token = deps.getToken(flags);
          const apiUrl = deps.getApiUrl(flags);
          output(await deps.apiRequest<any>(`/changes/${changeShortId}/preview`, { method: "POST", token, apiUrl }), flags);
        } catch (error) {
          handleCliError(error, deps);
        }
      }),
    ["change", "preview"],
  );

  addSharedHelp(
    changeCmd.command("apply")
      .description("Apply one change")
      .argument("[shortId]")
      .action(async function (this: Command, shortId?: string) {
        const flags = getRootFlags(this);
        try {
          const changeShortId = requireArgumentValue(shortId, "change shortId");
          const token = deps.getToken(flags);
          const apiUrl = deps.getApiUrl(flags);
          const result = await deps.apiRequest<any>(`/changes/${changeShortId}/apply`, { method: "POST", token, apiUrl });
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
      .argument("[shortId]")
      .action(async function (this: Command, shortId?: string) {
        const flags = getRootFlags(this);
        try {
          const changeShortId = requireArgumentValue(shortId, "change shortId");
          const token = deps.getToken(flags);
          const apiUrl = deps.getApiUrl(flags);
          output(await deps.apiRequest<any>(`/changes/${changeShortId}/dismiss`, { method: "POST", token, apiUrl }), flags);
        } catch (error) {
          handleCliError(error, deps);
        }
      }),
    ["change", "discard"],
  );

  addSharedHelp(
    changeCmd.command("retry")
      .description("Retry one failed change")
      .argument("[shortId]")
      .action(async function (this: Command, shortId?: string) {
        const flags = getRootFlags(this);
        try {
          const changeShortId = requireArgumentValue(shortId, "change shortId");
          const token = deps.getToken(flags);
          const apiUrl = deps.getApiUrl(flags);
          output(await deps.apiRequest<any>(`/changes/${changeShortId}/retry`, { method: "POST", token, apiUrl }), flags);
        } catch (error) {
          handleCliError(error, deps);
        }
      }),
    ["change", "retry"],
  );

  return changeCmd;
}

export const changeCmd = createChangeCommand();
