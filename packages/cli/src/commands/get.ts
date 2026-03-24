import { Command } from "commander";
import { addSharedHelp, defaultCliDeps, getRootFlags, handleCliError, type CliDeps } from "./common";
import { output } from "../output";

export function createGetCommand(deps: CliDeps = defaultCliDeps) {
  const getCmd = new Command("get").description("Get one resource and other nouns");

  addSharedHelp(
    getCmd.command("resource")
      .description("Get one resource")
      .argument("<slug>")
      .requiredOption("--workspace <slug>", "Workspace slug")
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
    ["get", "resource"],
  );

  addSharedHelp(
    getCmd.command("change")
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
    ["get", "change"],
  );

  addSharedHelp(
    getCmd.command("workspace")
      .description("Get one workspace")
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
    ["get", "workspace"],
  );

  addSharedHelp(
    getCmd.command("env")
      .description("Get one environment")
      .argument("<slug>")
      .requiredOption("--workspace <slug>", "Workspace slug")
      .action(async function (this: Command, slug: string, opts: { workspace: string }) {
        const flags = getRootFlags(this);
        const token = deps.getToken(flags);
        const apiUrl = deps.getApiUrl(flags);
        try {
          output(await deps.apiRequest<any>(`/workspaces/${opts.workspace}/environments/${slug}`, { token, apiUrl }), flags);
        } catch (error) {
          handleCliError(error, deps);
        }
      }),
    ["get", "env"],
  );

  addSharedHelp(
    getCmd.command("provider")
      .description("Get one provider profile")
      .argument("<id>")
      .action(async function (this: Command, id: string) {
        const flags = getRootFlags(this);
        const token = deps.getToken(flags);
        const apiUrl = deps.getApiUrl(flags);
        try {
          output(await deps.apiRequest<any>(`/providers/${id}`, { token, apiUrl }), flags);
        } catch (error) {
          handleCliError(error, deps);
        }
      }),
    ["get", "provider"],
  );

  addSharedHelp(
    getCmd.command("schema")
      .description("Get one resource schema")
      .argument("<token>")
      .action(async function (this: Command, tokenArg: string) {
        const flags = getRootFlags(this);
        const token = deps.getToken(flags);
        const apiUrl = deps.getApiUrl(flags);
        try {
          output(await deps.apiRequest<any>(`/schemas/describe/${encodeURIComponent(tokenArg)}`, { token, apiUrl }), flags);
        } catch (error) {
          handleCliError(error, deps);
        }
      }),
    ["get", "schema"],
  );

  return getCmd;
}

export const getCmd = createGetCommand();
