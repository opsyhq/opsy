import { Command } from "commander";
import type {
  ApplyChangeResponse,
  ApplyProgressView,
  ChangeDetailView,
  ChangePreviewView,
  ChangeSummaryRow,
  ExecutionStreamEvent,
  NormalizedError,
} from "@opsy/contracts";
import {
  addSharedHelp,
  buildQuery,
  defaultCliDeps,
  getRootFlags,
  handleCliError,
  parseJsonFlag,
  requireArgumentValue,
  requireOptionValue,
  requireProjectValue,
  type CliDeps,
} from "./common";
import { apiStream as defaultApiStream } from "../client";
import { renderApplyProgress, renderChangeDetail, renderChangePreview, renderChangeSummaryTable } from "../display";
import { output } from "../output";

function getExecutionErrorMessage(error: unknown): string | null {
  if (typeof error === "string") {
    return error;
  }
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return null;
}

async function fetchChangeDetailView(
  deps: CliDeps,
  shortId: string,
  flags: ReturnType<typeof getRootFlags>,
): Promise<ChangeDetailView> {
  const token = deps.getToken(flags);
  const apiUrl = deps.getApiUrl(flags);
  return deps.apiRequest<ChangeDetailView>(`/changes/${shortId}`, { token, apiUrl });
}

export function createChangeCommand(deps: CliDeps = defaultCliDeps) {
  const changeCmd = new Command("change").description("List, inspect, and execute changes");

  addSharedHelp(
    changeCmd.command("list")
      .description("List changes")
      .option("--project <slug>", "Project slug")
      .action(async function (this: Command, opts: { project?: string }) {
        const flags = getRootFlags(this);
        try {
          const project = requireProjectValue(this, opts.project);
          const token = deps.getToken(flags);
          const apiUrl = deps.getApiUrl(flags);
          const changes = await deps.apiRequest<ChangeSummaryRow[]>(
            `/projects/${project}/changes${flags.json ? buildQuery({ view: "raw" }) : ""}`,
            { token, apiUrl },
          );
          if (flags.json) return output(changes, flags);
          if (!changes.length) return deps.log("No changes found.");
          deps.log(renderChangeSummaryTable(changes));
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
          const path = `/changes/${changeShortId}${flags.json ? buildQuery({ view: "raw" }) : ""}`;
          const data = await deps.apiRequest<any>(path, { token, apiUrl });
          if (flags.json) return output(data, flags);
          deps.log(renderChangeDetail(data as ChangeDetailView));
        } catch (error) {
          handleCliError(error, deps);
        }
      }),
    ["change", "get"],
  );

  addSharedHelp(
    changeCmd.command("create")
      .description("Create a change")
      .option("--project <slug>", "Project slug")
      .option("--mutations <json>", "Mutation array")
      .option("--summary <text>", "Change summary")
      .action(async function (this: Command, opts: { project?: string; mutations?: string; summary?: string }) {
        const flags = getRootFlags(this);
        try {
          const project = requireProjectValue(this, opts.project);
          const body: Record<string, unknown> = {};
          if (opts.summary) body.summary = opts.summary;
          if (opts.mutations) body.mutations = parseJsonFlag(opts.mutations, "mutations");
          const token = deps.getToken(flags);
          const apiUrl = deps.getApiUrl(flags);
          const result = await deps.apiRequest<any>(
            `/projects/${project}/changes`,
            {
              method: "POST",
              body,
              token,
              apiUrl,
            });
          if (flags.json) return output(result, flags);
          if (Array.isArray(body.mutations) && result?.change?.shortId) {
            deps.log(renderChangeDetail(await fetchChangeDetailView(deps, result.change.shortId, flags)));
            return;
          }
          output(result, flags);
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
          const result = await deps.apiRequest<any>(`/changes/${changeShortId}/mutations`, {
            method: "POST",
            body: { mutations, summary: opts.summary },
            token,
            apiUrl,
          });
          if (flags.json) return output(result, flags);
          deps.log(renderChangeDetail(await fetchChangeDetailView(deps, changeShortId, flags)));
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
          const path = `/changes/${changeShortId}/preview${flags.json ? buildQuery({ view: "raw" }) : ""}`;
          const data = await deps.apiRequest<any>(path, { method: "POST", token, apiUrl });
          if (flags.json) return output(data, flags);
          deps.log(renderChangePreview(data as ChangePreviewView));
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
          if (flags.json) {
            const result = await deps.apiRequest<ApplyChangeResponse>(`/changes/${changeShortId}/apply`, { method: "POST", token, apiUrl });
            return output(result, flags);
          }
          const initial = await deps.apiRequest<ChangeDetailView>(`/changes/${changeShortId}`, { token, apiUrl });
          const opMap = new Map(initial.operations.map((operation) => [operation.slug, {
            slug: operation.slug,
            kind: operation.kind,
            status: operation.status,
            error: operation.error,
            blockedBy: operation.blockedBy,
          }]));
          const started = await deps.apiRequest<ApplyChangeResponse>(`/changes/${changeShortId}/apply`, { method: "POST", token, apiUrl });
          if (started.kind === "approval_required") {
            const result = started as { change: { shortId: string }; reviewUrl: string };
            deps.log(`Human approval required in the Opsy web UI for change ${result.change.shortId}.`);
            deps.log("The change has not been applied yet.");
            deps.log(`Ask a human to open ${result.reviewUrl} and approve it there.`);
            return;
          }
          let finalStatus = initial.change.status;
          for await (const message of (deps.apiStream ?? defaultApiStream)(`/executions/${started.executionId}/events`, {
            token,
            apiUrl,
            reconnect: true,
          })) {
            const event = JSON.parse(message.data) as ExecutionStreamEvent;
            if (event.type === "step.started") {
              const slug = String(event.payload.resourceSlug ?? "");
              const kind = String(event.payload.op ?? "unknown");
              const current = opMap.get(slug) ?? { slug, kind, status: "pending", error: null as NormalizedError | null, blockedBy: [] as string[] };
              current.kind = kind;
              current.status = "running";
              opMap.set(slug, current);
              deps.log(`- ${slug} ${kind} running`);
            } else if (event.type === "step.completed") {
              const slug = String(event.payload.resourceSlug ?? "");
              const kind = String(event.payload.op ?? "unknown");
              const blockedBy = Array.isArray(event.payload.blockedBy)
                ? event.payload.blockedBy.filter((value): value is string => typeof value === "string")
                : [];
              const errorMessage = getExecutionErrorMessage(event.payload.error);
              const error = errorMessage
                ? { message: errorMessage }
                : null;
              const current = opMap.get(slug) ?? { slug, kind, status: "pending", error: null as NormalizedError | null, blockedBy: [] as string[] };
              current.kind = kind;
              current.status = String(event.payload.status ?? "succeeded");
              current.error = error;
              current.blockedBy = blockedBy;
              opMap.set(slug, current);
              const suffix = blockedBy.length > 0 ? ` blocked by: ${blockedBy.join(", ")}` : error?.message ? ` error: ${error.message}` : "";
              deps.log(`- ${slug} ${kind} ${current.status}${suffix}`);
            } else if (event.type === "execution.completed") {
              finalStatus = "applied";
              break;
            } else if (event.type === "execution.cancelled" || event.type === "execution.failed") {
              finalStatus = "failed";
              break;
            }
          }
          const resultView: ApplyProgressView = {
            kind: "change.apply",
            change: {
              shortId: initial.change.shortId,
              status: finalStatus,
              summary: initial.change.summary,
            },
            counts: {
              pending: 0,
              running: 0,
              failed: 0,
              blocked: 0,
              succeeded: 0,
            },
            operations: [],
          };
          const final = renderApplyProgress({
            ...resultView,
            counts: {
              pending: [...opMap.values()].filter((operation) => operation.status === "pending" || operation.status === "queued").length,
              running: [...opMap.values()].filter((operation) => operation.status === "running").length,
              failed: [...opMap.values()].filter((operation) => operation.status === "failed").length,
              blocked: [...opMap.values()].filter((operation) => operation.status === "blocked").length,
              succeeded: [...opMap.values()].filter((operation) => !["pending", "queued", "running", "failed", "blocked"].includes(operation.status)).length,
            },
            operations: [...opMap.values()],
          });
          deps.log("");
          deps.log(final);
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

  addSharedHelp(
    changeCmd.command("cancel")
      .description("Cancel the active apply execution for one change")
      .argument("[shortId]")
      .option("--reason <text>", "Cancellation reason")
      .action(async function (this: Command, shortId: string | undefined, opts: { reason?: string }) {
        const flags = getRootFlags(this);
        try {
          const changeShortId = requireArgumentValue(shortId, "change shortId");
          const token = deps.getToken(flags);
          const apiUrl = deps.getApiUrl(flags);
          output(await deps.apiRequest<any>(`/changes/${changeShortId}/cancel`, {
            method: "POST",
            body: { reason: opts.reason },
            token,
            apiUrl,
          }), flags);
        } catch (error) {
          handleCliError(error, deps);
        }
      }),
    ["change", "cancel"],
  );

  return changeCmd;
}

export const changeCmd = createChangeCommand();
