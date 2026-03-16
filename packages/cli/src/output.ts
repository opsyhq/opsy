import { parseRunResourceChanges } from "@opsy/contracts";
import { detail, table } from "./format.js";
import type {
  DraftDetail,
  DraftListResponse,
  DraftMutationResponse,
  DraftValidateResponse,
  EnvConfigResponse,
  EnvListItem,
  OrgNotesResponse,
  OrgVariableItem,
  RestRunSummary,
  RevisionDetail,
  RevisionListResponse,
  RunCancelResponse,
  RunGetResponse,
  RunListResponse,
  StackApplyResponse,
  StackDetail,
  StackImportResponse,
  StackListItem,
  StackStateEnv,
  WhoAmIResponse,
  WorkspaceDetail,
  WorkspaceEnvVarsResponse,
  WorkspaceListItem,
  WorkspaceTreeResponse,
} from "./schemas.js";

export function formatWhoAmI(data: WhoAmIResponse): string {
  const pairs: [string, string][] = [
    ["Email", data.user.email],
    ["Organization", data.actor.orgId],
    ["Auth", data.actor.authType],
  ];
  if (data.actor.credentialLabel) {
    pairs.push(["Credential", data.actor.credentialLabel]);
  }
  return detail(pairs);
}

export function formatAuthLogin(data: WhoAmIResponse, configPath: string): string {
  const authValue = data.actor.credentialLabel
    ? `${data.actor.authType} (${data.actor.credentialLabel})`
    : data.actor.authType;
  const pairs: [string, string][] = [
    ["Organization", data.actor.orgId],
    ["Auth", authValue],
    ["Config", configPath],
  ];
  return `Authenticated as ${data.user.email}\n\n${detail(pairs)}`;
}

export function formatWorkspaceList(items: WorkspaceListItem[]): string {
  if (items.length === 0) {
    return "No workspaces found.";
  }
  return table(
    ["Name", "Slug", "Stacks", "Envs"],
    items.map((item) => [
      item.name,
      item.slug,
      String(item.stackCount ?? 0),
      String(item.envCount ?? 0),
    ]),
  );
}

export function formatRunList(data: RunListResponse): string {
  if (data.items.length === 0) {
    return "No runs found.";
  }
  const out = table(
    ["ID", "Status", "Kind", "Stack/Env", "Queued"],
    data.items.map((item) => [
      item.shortId,
      item.status,
      item.kind,
      `${item.stackSlug}/${item.envSlug}`,
      item.queuedAt,
    ]),
  );
  if (data.nextCursor) {
    return `${out}\nnextCursor: ${data.nextCursor}`;
  }
  return out;
}

export function formatRunGet(data: RunGetResponse): string {
  const pairs: [string, string][] = [
    ["ID", data.shortId],
    ["Status", data.status],
    ["Kind", data.kind],
    ["Stack", data.stackSlug],
    ["Env", data.envSlug],
    ["Queued at", data.queuedAt],
  ];
  if (data.startedAt) pairs.push(["Started at", data.startedAt]);
  if (data.finishedAt) pairs.push(["Finished at", data.finishedAt]);
  if (data.reason) pairs.push(["Reason", data.reason]);
  if (data.draftShortId) pairs.push(["Draft", data.draftShortId]);
  if (data.revisionNumber !== null) pairs.push(["Revision", String(data.revisionNumber)]);
  if (data.requestedBy?.email) pairs.push(["Requested by", data.requestedBy.email]);
  if (data.approval) pairs.push(["Approval", data.approval.status]);
  if (data.previewResult?.changeSummary) pairs.push(["Preview", formatChangeSummary(data.previewResult.changeSummary)]);
  if (data.applyResult?.changeSummary) pairs.push(["Apply", formatChangeSummary(data.applyResult.changeSummary)]);
  if (data.error) pairs.push(["Error", data.error]);
  const lines = [detail(pairs)];
  const previewChanges = data.previewResult
    ? (data.previewResult.resourceChanges ?? parseRunResourceChanges(data.previewResult.stdout))
    : [];
  if (previewChanges.length > 0) {
    lines.push("");
    lines.push("PREVIEW");
    lines.push(...previewChanges.map((item) => `  ${item.summary}`));
  }
  return lines.join("\n");
}

export function formatDraftList(items: DraftListResponse): string {
  if (items.length === 0) {
    return "No drafts found.";
  }
  return table(
    ["ID", "Name", "Stale", "Updated"],
    items.map((item) => [
      item.shortId,
      item.name ?? "-",
      item.isStale ? "yes" : "no",
      item.updatedAt,
    ]),
  );
}

export function formatDraftDetail(data: DraftDetail): string {
  const pairs: [string, string][] = [
    ["ID", data.shortId],
    ["Name", data.name ?? "-"],
    ["Stale", data.isStale ? "yes" : "no"],
    ["Spec hash", data.specHash],
    ["Created at", data.createdAt],
    ["Updated at", data.updatedAt],
  ];
  if (data.baseRevision) {
    pairs.push(["Base revision", String(data.baseRevision.revisionNumber)]);
  }
  return `${detail(pairs)}\n\nspec\n${data.spec}`;
}

export function formatDraftCreate(data: { draftId: string; shortId: string }): string {
  return `Draft created (${data.shortId})`;
}

export function formatDraftMutation(data: DraftMutationResponse): string {
  const lines = [`Draft updated (${data.shortId})`];
  if (data.validationSummary) {
    lines.push(`  ${data.validationSummary}`);
  }
  for (const warning of data.warnings) {
    lines.push(`  warning: ${warning}`);
  }
  return lines.join("\n");
}

export function formatDraftValidate(data: DraftValidateResponse): string {
  const lines = [data.ok ? "Valid" : "Invalid"];
  for (const warning of data.warnings) {
    lines.push(`  warning: ${warning}`);
  }
  return lines.join("\n");
}

export function formatRevisionList(data: RevisionListResponse): string {
  if (data.items.length === 0) {
    return "No revisions found.";
  }
  const out = table(
    ["Revision", "Run", "Created"],
    data.items.map((item) => [
      String(item.revisionNumber),
      item.runId ?? "-",
      item.createdAt,
    ]),
  );
  if (data.nextCursor) {
    return `${out}\nnextCursor: ${data.nextCursor}`;
  }
  return out;
}

export function formatRevisionDetail(data: RevisionDetail): string {
  const pairs: [string, string][] = [
    ["Revision", String(data.revisionNumber)],
    ["ID", data.id],
    ["Spec hash", data.specHash],
    ["Run ID", data.runId ?? "-"],
    ["Created at", data.createdAt],
  ];
  if (data.baseRevision) {
    pairs.push(["Base revision", String(data.baseRevision.revisionNumber)]);
  }
  return `${detail(pairs)}\n\nspec\n${data.spec}`;
}

export function formatRestRun(data: RestRunSummary | RunCancelResponse): string {
  const pairs: [string, string][] = [
    ["ID", data.shortId],
    ["Status", data.status],
    ["Kind", data.kind],
  ];
  if ("reason" in data && data.reason) pairs.push(["Reason", data.reason]);
  if (data.startedAt) pairs.push(["Started at", data.startedAt]);
  if (data.finishedAt) pairs.push(["Finished at", data.finishedAt]);
  return detail(pairs);
}

export function formatRunWait(data: { status: string; runId: string; run?: { shortId: string; status: string; kind: string } | null }): string {
  const pairs: [string, string][] = [
    ["Status", data.status],
    ["Run ID", data.runId],
  ];
  if (data.run) {
    pairs.push(["Short ID", data.run.shortId]);
    pairs.push(["Run status", data.run.status]);
    pairs.push(["Kind", data.run.kind]);
  }
  return detail(pairs);
}

export function formatRunApply(data: StackApplyResponse): string {
  const pairs: [string, string][] = [
    ["Status", data.status],
    ["Run ID", data.runId],
    ["Short ID", data.run.shortId],
    ["Kind", data.run.kind],
  ];
  if (data.previewResult?.changeSummary) {
    pairs.push(["Preview", formatChangeSummary(data.previewResult.changeSummary)]);
  }
  const lines = ["Run queued", "", detail(pairs)];
  if (data.previewResult?.resourceChanges && data.previewResult.resourceChanges.length > 0) {
    lines.push("");
    lines.push("PREVIEW");
    lines.push(...data.previewResult.resourceChanges.map((item) => `  ${item.summary}`));
  }
  return lines.join("\n");
}

export function formatRunImport(data: StackImportResponse): string {
  const pairs: [string, string][] = [
    ["Status", data.status],
    ["Run ID", data.runId],
    ["Short ID", data.run.shortId],
    ["Kind", data.run.kind],
    ["Imported", String(data.importedCount)],
  ];
  return detail(pairs);
}

export function formatOrgList(items: OrgVariableItem[]): string {
  if (items.length === 0) {
    return "No org variables found.";
  }
  return table(
    ["Key", "Sensitive", "Updated"],
    items.map((item) => [
      item.key,
      item.sensitive ? "yes" : "no",
      item.updatedAt,
    ]),
  );
}

export function formatOrgVariable(data: OrgVariableItem): string {
  const pairs: [string, string][] = [
    ["Key", data.key],
    ["Sensitive", data.sensitive ? "yes" : "no"],
  ];
  if ("value" in data && typeof data.value === "string") {
    pairs.push(["Value", data.value]);
  }
  pairs.push(["Updated at", data.updatedAt]);
  return detail(pairs);
}

export function formatOrgNotes(data: OrgNotesResponse): string {
  return `Updated at: ${data.updatedAt}\n\n${data.content}`;
}

export function formatWorkspaceDetail(data: WorkspaceDetail): string {
  const pairs: [string, string][] = [
    ["Slug", data.slug],
    ["Name", data.name],
    ["Created at", data.createdAt],
    ["Updated at", data.updatedAt],
  ];
  if (data.notes) pairs.push(["Notes", data.notes]);
  return detail(pairs);
}

export function formatWorkspaceTree(data: WorkspaceTreeResponse): string {
  return data.tree;
}

export function formatWorkspaceEnvVars(data: WorkspaceEnvVarsResponse): string {
  if (data.variables.length === 0) {
    return `No variables found for ${data.workspaceSlug}/${data.envSlug}.`;
  }

  return table(
    ["Key", "Sensitive", "Value"],
    data.variables.map((item) => [
      item.key,
      item.sensitive ? "yes" : "no",
      item.sensitive ? "[redacted]" : item.value,
    ]),
  );
}

export function formatStackList(items: StackListItem[]): string {
  if (items.length === 0) {
    return "No stacks found.";
  }
  return table(
    ["Slug", "Head Rev", "Drafts", "Deployments"],
    items.map((item) => [
      item.slug,
      item.headRevisionNumber !== null ? String(item.headRevisionNumber) : "-",
      String(item.draftCount),
      item.deployments.map((d) => d.envSlug).join(",") || "-",
    ]),
  );
}

export function formatStackDetail(data: StackDetail): string {
  const pairs: [string, string][] = [
    ["Slug", data.slug],
    ["Head revision", data.headRevision ? String(data.headRevision.revisionNumber) : "-"],
    ["Drafts", String(data.draftCount)],
    ["Created at", data.createdAt],
    ["Updated at", data.updatedAt],
  ];
  if (data.notes) pairs.push(["Notes", data.notes]);

  const lines = [detail(pairs)];

  if (data.deployments.length > 0) {
    lines.push("");
    lines.push(table(
      ["Env", "Revision", "Last applied", "Active run"],
      data.deployments.map((d) => [
        d.envSlug,
        d.currentRevisionNumber !== null ? String(d.currentRevisionNumber) : "-",
        d.lastAppliedAt ?? "-",
        d.activeRunStatus ?? "-",
      ]),
    ));
  }

  return lines.join("\n");
}

export function formatStackState(envs: StackStateEnv[]): string {
  if (envs.length === 0) {
    return "No state found.";
  }

  const sections: string[] = [];
  for (const env of envs) {
    const header = `${env.envSlug}  (revision ${env.currentRevisionNumber ?? "-"}, run ${env.runId})`;
    if (env.resources.length === 0) {
      sections.push(`${header}\n  No resources.`);
      continue;
    }
    const resourceTable = table(
      ["Type", "Name", "URN"],
      env.resources.map((r) => [r.type, r.name, r.urn]),
    );
    sections.push(`${header}\n${resourceTable}`);
  }
  return sections.join("\n\n");
}

export function formatEnvList(items: EnvListItem[]): string {
  if (items.length === 0) {
    return "No environments found.";
  }
  return table(
    ["Slug", "Providers", "Vars", "Secrets"],
    items.map((item) => [
      item.slug,
      item.bindings.map((b) => b.providerPkg).join(",") || "-",
      String(item.variableCount),
      String(item.secretCount),
    ]),
  );
}

export function formatEnvConfig(data: EnvConfigResponse): string {
  const sections: string[] = [];

  if (data.bindings.length > 0) {
    sections.push("PROVIDERS");
    sections.push(table(
      ["Package", "Profile"],
      data.bindings.map((b) => [
        b.binding.providerPkg,
        b.profile?.profileName ?? "-",
      ]),
    ));
  }

  if (data.variables.length > 0) {
    if (sections.length > 0) sections.push("");
    sections.push("VARIABLES");
    sections.push(table(
      ["Key", "Sensitive", "Updated"],
      data.variables.map((v) => [
        v.key,
        v.sensitive ? "yes" : "no",
        v.updatedAt,
      ]),
    ));
  }

  if (sections.length === 0) {
    return "No config.";
  }

  return sections.join("\n");
}

export function stringifyJson(data: unknown): string {
  return `${JSON.stringify(data, null, 2)}\n`;
}

function formatChangeSummary(summary: Record<string, number>): string {
  return Object.entries(summary)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join(",");
}
