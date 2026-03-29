import type {
  ApplyProgressView,
  ChangeDetailView,
  ChangePreviewView,
  ChangeSummaryRow,
  NormalizedError,
  OperationDetailView,
  ResourceDetailView,
  ResourceDiffView,
  ResourceHistoryEntry,
  ResourceSummaryRow,
} from "@opsy/contracts";
import { formatTable } from "./output";

function formatUnknown(value: unknown): string {
  if (value === null || value === undefined) return "-";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

function formatRelative(iso: string | null): string {
  if (!iso) return "-";
  const delta = Date.now() - new Date(iso).getTime();
  const seconds = Math.floor(delta / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function renderHeader(label: string, value: string): string {
  return `${(label + " ").padEnd(10)}${value}`;
}

function displayChangeStatus(status: string, approvalRequired?: boolean): string {
  return approvalRequired ? "awaiting_approval" : status;
}

function formatCountSummary(summary: Record<string, number>): string {
  const parts = Object.entries(summary)
    .filter(([, value]) => value > 0)
    .map(([key, value]) => `${key}:${value}`);
  return parts.join(" ") || "-";
}

function renderValueRows(title: string, rows: Array<{ path: string; value?: unknown; template?: string | null; resolved?: unknown }>): string {
  if (rows.length === 0) return "";
  const lines = [title];
  for (const row of rows) {
    if (row.template) {
      const resolved = row.resolved !== undefined ? ` -> ${formatUnknown(row.resolved)}` : "";
      lines.push(`- ${row.path}: ${row.template}${resolved}`);
    } else {
      lines.push(`- ${row.path}: ${formatUnknown(row.value)}`);
    }
  }
  return lines.join("\n");
}

function renderDeltaRows(title: string, rows: Array<{ path: string; before?: unknown; after?: unknown }>): string {
  if (rows.length === 0) return "";
  const lines = [title];
  for (const row of rows) {
    lines.push(`- ${row.path}: ${formatUnknown(row.before)} -> ${formatUnknown(row.after)}`);
  }
  return lines.join("\n");
}

export function renderResourceSummaryTable(rows: ResourceSummaryRow[]): string {
  return formatTable(
    ["SLUG", "KIND", "TYPE", "STATUS", "PARENT", "CHILDREN", "ID"],
    rows.map((row) => [
      row.slug,
      row.kind,
      row.type,
      row.status,
      row.parentSlug ?? "-",
      String(row.childCount),
      row.providerId ?? "-",
    ]),
  );
}

export function renderChangeSummaryTable(rows: ChangeSummaryRow[]): string {
  return formatTable(
    ["SHORT ID", "STATUS", "SUMMARY", "OPS", "PREVIEW", "CREATED"],
    rows.map((row) => [
      row.shortId,
      displayChangeStatus(row.status, row.approvalRequired),
      row.summary ?? "-",
      String(row.operationCount),
      formatCountSummary(row.previewSummary),
      formatRelative(row.createdAt),
    ]),
  );
}

export function renderResourceDetail(view: ResourceDetailView): string {
  const sections = [
    renderHeader("Resource", view.resource.slug),
    renderHeader("Type", view.resource.type),
    renderHeader("Status", view.resource.syncState === "in_sync" ? view.resource.status : `${view.resource.status} (${view.resource.syncState})`),
    renderHeader("ID", view.resource.providerId ?? "-"),
    ...(view.resource.dependsOn.length > 0
      ? [renderHeader("DependsOn", view.resource.dependsOn.join(", "))]
      : []),
    "",
    renderValueRows("Intent", view.intent),
  ];
  if (view.problem.length > 0) {
    sections.push("", renderDeltaRows("Problem", view.problem));
  }
  if (view.outcome) {
    const outcome = [`Outcome`, `- ${view.outcome.kind} ${view.outcome.status}${view.outcome.changeShortId ? ` (${view.outcome.changeShortId})` : ""}`];
    if (view.outcome.error?.message) outcome.push(`- ${view.outcome.error.message}`);
    sections.push("", outcome.join("\n"));
  }
  return sections.filter(Boolean).join("\n");
}

export function renderResourceDiff(view: ResourceDiffView): string {
  const sections = [
    renderHeader("Resource", view.resource.slug),
    renderHeader("Type", view.resource.type),
    renderHeader("Status", view.resource.status),
    renderHeader("ID", view.resource.providerId ?? "-"),
    "",
    view.delta.length > 0 ? renderDeltaRows("Delta", view.delta) : "Delta\n- no differences",
  ];
  if (view.outcome?.message) {
    sections.push("", `Outcome\n- live read failed: ${view.outcome.message}`);
  }
  return sections.join("\n");
}

export function renderResourceHistoryTable(rows: ResourceHistoryEntry[]): string {
  return formatTable(
    ["WHEN", "KIND", "STATUS", "CHANGE", "OP ID", "MESSAGE"],
    rows.map((row) => [
      formatRelative(row.when),
      row.kind,
      row.status,
      row.changeShortId ?? "-",
      row.operationId,
      row.message ?? "-",
    ]),
  );
}

export function renderChangeDetail(view: ChangeDetailView): string {
  const lines = [
    renderHeader("Change", view.change.shortId),
    renderHeader("Status", displayChangeStatus(view.change.status, view.change.approvalRequired)),
    renderHeader("Summary", view.change.summary ?? "-"),
  ];
  const preview = formatCountSummary(view.change.previewSummary);
  if (preview !== "-") lines.push(renderHeader("Preview", preview));
  if (view.change.warnings.length > 0) {
    lines.push("");
    for (const warning of view.change.warnings) {
      lines.push(`Warning: ${warning}`);
    }
  }
  lines.push(
    renderHeader("Failed", String(view.change.counts.failed)),
    renderHeader("Blocked", String(view.change.counts.blocked)),
    renderHeader("Succeeded", String(view.change.counts.succeeded)),
    "",
    "Operations",
  );
  for (const operation of view.operations) {
    lines.push(`- ${operation.slug.padEnd(15)} ${operation.kind.padEnd(8)} ${operation.status}`);
    if (operation.blockedBy.length > 0) {
      lines.push(`  blocked by: ${operation.blockedBy.join(", ")}`);
    } else if (operation.error?.message) {
      lines.push(`  error: ${operation.error.message}`);
    }
    if (operation.dependsOn.length > 0) {
      lines.push(`  depends on: ${operation.dependsOn.join(", ")}`);
    }
  }
  return lines.join("\n");
}

export function renderChangePreview(view: ChangePreviewView): string {
  const lines = [
    renderHeader("Preview", view.change.shortId),
    renderHeader("Status", view.change.status),
    renderHeader("Summary", view.change.summary ?? "-"),
    renderHeader("Plan", formatCountSummary(view.plan)),
    "",
    "Operations",
  ];
  for (const operation of view.operations) {
    lines.push(`- ${operation.slug.padEnd(15)} ${operation.kind.padEnd(8)} ${operation.status}`);
    for (const change of operation.changes) {
      lines.push(`  ${change.path}: ${formatUnknown(change.before)} -> ${formatUnknown(change.after)}`);
    }
    if (operation.replacementFields.length > 0) {
      lines.push(`  replaces: ${operation.replacementFields.join(", ")}`);
    }
    for (const validation of operation.validation) {
      lines.push(`  validation: ${validation}`);
    }
  }
  return lines.join("\n");
}

export function renderOperationDetail(view: OperationDetailView): string {
  const lines = [
    renderHeader("Operation", view.operation.slug),
    renderHeader("Kind", view.operation.kind),
    renderHeader("Status", view.operation.status),
    renderHeader("Change", view.operation.changeShortId ?? "-"),
    ...(view.operation.dependsOn.length > 0
      ? [renderHeader("DependsOn", view.operation.dependsOn.join(", "))]
      : []),
    "",
    renderValueRows("Intent", view.intent),
    "",
    "Outcome",
    `- result: ${view.outcome.result}`,
  ];
  if (view.outcome.startedAt) lines.push(`- started: ${view.outcome.startedAt}`);
  if (view.outcome.finishedAt) lines.push(`- finished: ${view.outcome.finishedAt}`);
  if (view.failure) {
    lines.push("", "Failure", `- error: ${view.failure.message}`);
    if (view.failure.code) lines.push(`- code: ${view.failure.code}`);
    if (view.failure.details) lines.push(`- detail: ${view.failure.details}`);
  }
  if (view.blocker) {
    lines.push("", "Blocker", `- blocked by: ${view.blocker.blockedBy.join(", ")}`);
    if (view.blocker.reason) lines.push(`- reason: ${view.blocker.reason}`);
  }
  if (view.diff.length > 0) {
    lines.push("", renderDeltaRows("Diff", view.diff));
  }
  if (view.timeline.length > 0) {
    lines.push("", "Timeline", ...view.timeline.map((entry) => `- ${entry.label}`));
  }
  return lines.filter(Boolean).join("\n");
}

export function renderApplyProgress(view: ApplyProgressView): string {
  const lines = [
    renderHeader("Applying", view.change.shortId),
    renderHeader("Summary", view.change.summary ?? "-"),
    "",
    "Operations",
  ];
  for (const operation of view.operations) {
    lines.push(`- ${operation.slug.padEnd(15)} ${operation.kind.padEnd(8)} ${operation.status}`);
    if (operation.blockedBy.length > 0) {
      lines.push(`  blocked by: ${operation.blockedBy.join(", ")}`);
    } else if (operation.error?.message) {
      lines.push(`  error: ${operation.error.message}`);
    }
  }
  lines.push(
    "",
    "Result",
    `Status: ${view.change.status}`,
    `Failed: ${view.counts.failed}`,
    `Blocked: ${view.counts.blocked}`,
    `Succeeded: ${view.counts.succeeded}`,
  );
  return lines.join("\n");
}
