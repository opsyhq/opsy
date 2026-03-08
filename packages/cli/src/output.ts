import type {
  DraftDetail,
  DraftListResponse,
  DraftMutationResponse,
  DraftValidateResponse,
  OrgNotesResponse,
  OrgVariableItem,
  RestRunSummary,
  RevisionDetail,
  RevisionListResponse,
  RunCancelResponse,
  RunGetResponse,
  RunListResponse,
  RunWaitResponse,
  StackApplyResponse,
  StackImportResponse,
  WhoAmIResponse,
  WorkspaceListItem,
} from "./schemas.js";

export function formatWhoAmI(data: WhoAmIResponse): string {
  const parts = [
    data.user.email,
    `org=${data.actor.orgId}`,
    `auth=${data.actor.authType}`,
  ];

  if (data.actor.credentialLabel) {
    parts.push(`credential=${data.actor.credentialLabel}`);
  }

  return parts.join(" ");
}

export function formatWorkspaceList(items: WorkspaceListItem[]): string {
  if (items.length === 0) {
    return "No workspaces found.";
  }

  return items
    .map((item) => [item.slug, item.name, `stacks=${item.stackCount ?? 0}`, `envs=${item.envCount ?? 0}`].join("\t"))
    .join("\n");
}

export function formatRunList(data: RunListResponse): string {
  if (data.items.length === 0) {
    return "No runs found.";
  }

  const lines = data.items.map((item) =>
    [item.shortId, item.status, item.kind, `${item.stackSlug}/${item.envSlug}`, item.queuedAt].join("\t"),
  );

  if (data.nextCursor) {
    lines.push(`nextCursor\t${data.nextCursor}`);
  }

  return lines.join("\n");
}

export function formatRunGet(data: RunGetResponse): string {
  const lines = baseRunLines(data);

  if (data.reason) {
    lines.push(`reason\t${data.reason}`);
  }
  if (data.startedAt) {
    lines.push(`startedAt\t${data.startedAt}`);
  }
  if (data.finishedAt) {
    lines.push(`finishedAt\t${data.finishedAt}`);
  }
  if (data.revisionNumber !== null) {
    lines.push(`revision\t${data.revisionNumber}`);
  }
  if (data.draftShortId) {
    lines.push(`draft\t${data.draftShortId}`);
  }
  if (data.requestedBy?.email) {
    lines.push(`requestedBy\t${data.requestedBy.email}`);
  }
  if (data.approval) {
    lines.push(`approval\t${data.approval.status}`);
  }
  if (data.previewResult?.changeSummary) {
    lines.push(`preview\t${formatChangeSummary(data.previewResult.changeSummary)}`);
  }
  if (data.applyResult?.changeSummary) {
    lines.push(`apply\t${formatChangeSummary(data.applyResult.changeSummary)}`);
  }
  if (data.error) {
    lines.push(`error\t${data.error}`);
  }

  return lines.join("\n");
}

export function formatDraftList(items: DraftListResponse): string {
  if (items.length === 0) {
    return "No drafts found.";
  }

  return items
    .map((item) => [
      item.shortId,
      item.name ?? "-",
      `stale=${item.isStale ? "true" : "false"}`,
      item.updatedAt,
    ].join("\t"))
    .join("\n");
}

export function formatDraftDetail(data: DraftDetail): string {
  const lines = [
    `id\t${data.id}`,
    `shortId\t${data.shortId}`,
    `name\t${data.name ?? ""}`,
    `specHash\t${data.specHash}`,
    `stale\t${data.isStale ? "true" : "false"}`,
    `createdAt\t${data.createdAt}`,
    `updatedAt\t${data.updatedAt}`,
  ];

  if (data.baseRevision) {
    lines.push(`baseRevision\t${data.baseRevision.revisionNumber}`);
  }

  lines.push("spec");
  lines.push(data.spec);
  return lines.join("\n");
}

export function formatDraftMutation(data: DraftMutationResponse): string {
  return [`draftId\t${data.draftId}`, `shortId\t${data.shortId}`]
    .concat(data.warnings.map((warning) => `warning\t${warning}`))
    .join("\n");
}

export function formatDraftCreate(data: { draftId: string; shortId: string }): string {
  return [`draftId\t${data.draftId}`, `shortId\t${data.shortId}`].join("\n");
}

export function formatDraftValidate(data: DraftValidateResponse): string {
  return [`ok\t${data.ok ? "true" : "false"}`]
    .concat(data.warnings.map((warning) => `warning\t${warning}`))
    .join("\n");
}

export function formatRevisionList(data: RevisionListResponse): string {
  if (data.items.length === 0) {
    return "No revisions found.";
  }

  const lines = data.items.map((item) =>
    [String(item.revisionNumber), item.runId ?? "-", item.createdAt].join("\t"),
  );

  if (data.nextCursor) {
    lines.push(`nextCursor\t${data.nextCursor}`);
  }

  return lines.join("\n");
}

export function formatRevisionDetail(data: RevisionDetail): string {
  const lines = [
    `id\t${data.id}`,
    `revision\t${data.revisionNumber}`,
    `specHash\t${data.specHash}`,
    `runId\t${data.runId ?? ""}`,
    `createdAt\t${data.createdAt}`,
  ];

  if (data.baseRevision) {
    lines.push(`baseRevision\t${data.baseRevision.revisionNumber}`);
  }

  lines.push("spec");
  lines.push(data.spec);
  return lines.join("\n");
}

export function formatRestRun(data: RestRunSummary | RunCancelResponse): string {
  const lines = [
    `id\t${data.id}`,
    `shortId\t${data.shortId}`,
    `status\t${data.status}`,
    `kind\t${data.kind}`,
  ];

  if ("reason" in data && data.reason) {
    lines.push(`reason\t${data.reason}`);
  }
  if (data.startedAt) {
    lines.push(`startedAt\t${data.startedAt}`);
  }
  if (data.finishedAt) {
    lines.push(`finishedAt\t${data.finishedAt}`);
  }

  return lines.join("\n");
}

export function formatRunWait(data: RunWaitResponse): string {
  const lines = [`status\t${data.status}`, `runId\t${data.runId}`];

  if (data.run) {
    lines.push(`shortId\t${data.run.shortId}`);
    lines.push(`runStatus\t${data.run.status}`);
    lines.push(`kind\t${data.run.kind}`);
  }

  return lines.join("\n");
}

export function formatRunApply(data: StackApplyResponse): string {
  const lines = [
    `status\t${data.status}`,
    `runId\t${data.runId}`,
    `jobId\t${data.jobId}`,
    `shortId\t${data.run.shortId}`,
    `runStatus\t${data.run.status}`,
    `kind\t${data.run.kind}`,
  ];

  if (data.previewResult?.changeSummary) {
    lines.push(`preview\t${formatChangeSummary(data.previewResult.changeSummary)}`);
  }

  return lines.join("\n");
}

export function formatRunImport(data: StackImportResponse): string {
  const lines = [
    `status\t${data.status}`,
    `runId\t${data.runId}`,
    `jobId\t${data.jobId}`,
    `shortId\t${data.run.shortId}`,
    `runStatus\t${data.run.status}`,
    `kind\t${data.run.kind}`,
    `importedCount\t${data.importedCount}`,
  ];

  return lines.join("\n");
}

export function formatOrgList(items: OrgVariableItem[]): string {
  if (items.length === 0) {
    return "No org variables found.";
  }

  return items
    .map((item) => [
      item.key,
      `sensitive=${item.sensitive ? "true" : "false"}`,
      item.updatedAt,
    ].join("\t"))
    .join("\n");
}

export function formatOrgVariable(data: OrgVariableItem): string {
  const lines = [`key\t${data.key}`, `sensitive\t${data.sensitive ? "true" : "false"}`];
  if ("value" in data && typeof data.value === "string") {
    lines.push(`value\t${data.value}`);
  }
  lines.push(`updatedAt\t${data.updatedAt}`);
  return lines.join("\n");
}

export function formatOrgNotes(data: OrgNotesResponse): string {
  return [`updatedAt\t${data.updatedAt}`, "content", data.content].join("\n");
}

export function stringifyJson(data: unknown): string {
  return `${JSON.stringify(data, null, 2)}\n`;
}

function baseRunLines(data: RunGetResponse): string[] {
  return [
    `id\t${data.id}`,
    `shortId\t${data.shortId}`,
    `status\t${data.status}`,
    `kind\t${data.kind}`,
    `stack\t${data.stackSlug}`,
    `env\t${data.envSlug}`,
    `queuedAt\t${data.queuedAt}`,
  ];
}

function formatChangeSummary(summary: Record<string, number>): string {
  return Object.entries(summary)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join(",");
}
