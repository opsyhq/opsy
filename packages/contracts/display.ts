import type {
  ChangeOperationRecord,
  ChangePreviewOperation,
  ExecutionRecord,
  ResourceLockRecord,
  ResourceRecord,
  StableChangeRow,
} from "./index";

export type DisplayView = "summary" | "detail" | "raw";

export type NormalizedError = {
  message: string;
  code?: string | null;
  details?: string | null;
  blockedBy?: string[] | null;
};

export type ValueRow = {
  path: string;
  value?: unknown;
  template?: string | null;
  resolved?: unknown;
};

export type DeltaRow = {
  path: string;
  before: unknown;
  after: unknown;
  beforeSourceExpression?: string | null;
  afterSourceExpression?: string | null;
};

export type ResourceSummaryRow = {
  slug: string;
  kind: "resource" | "group";
  type: string;
  status: string;
  parentSlug: string | null;
  childCount: number;
  providerId: string | null;
  lock?: ResourceLockRecord | null;
};

export type OutcomeSummary = {
  kind: string;
  status: string;
  changeShortId?: string | null;
  operationId?: string | null;
  message?: string | null;
  error?: NormalizedError | null;
};

export type ResourceDetailView = {
  kind: "resource.detail";
  resource: {
    slug: string;
    type: string;
    status: string;
    syncState: string;
    providerId: string | null;
    dependsOn: string[];
    lock?: ResourceLockRecord | null;
  };
  intent: ValueRow[];
  problem: DeltaRow[];
  outcome: OutcomeSummary | null;
};

export type ResourceDiffView = {
  kind: "resource.diff";
  resource: {
    slug: string;
    type: string;
    status: string;
    providerId: string | null;
  };
  delta: DeltaRow[];
  outcome: NormalizedError | null;
};

export type ResourceHistoryEntry = {
  when: string | null;
  kind: string;
  status: string;
  changeShortId: string | null;
  operationId: string;
  message: string | null;
};

export type ChangeSummaryCounts = {
  pending: number;
  running: number;
  failed: number;
  blocked: number;
  succeeded: number;
};

export type ChangeSummaryRow = {
  shortId: string;
  status: string;
  summary: string | null;
  createdAt: string;
  operationCount: number;
  previewSummary: Record<string, number>;
  approvalRequired: boolean;
};

export type ChangeOperationSummaryRow = {
  operationId: string;
  slug: string;
  kind: string;
  status: string;
  resourceType: string;
  dependsOn: string[];
  changes: StableChangeRow[];
  error: NormalizedError | null;
  blockedBy: string[];
};

export type ChangeDetailView = {
  kind: "change.detail";
  change: {
    shortId: string;
    status: string;
    summary: string | null;
    createdAt: string;
    previewSummary: Record<string, number>;
    approvalRequired: boolean;
    counts: ChangeSummaryCounts;
    warnings: string[];
  };
  operations: ChangeOperationSummaryRow[];
};

export type ChangePreviewRowStatus = "valid" | "warning" | "invalid";

export type ChangePreviewRow = {
  operationId: string;
  slug: string;
  kind: string;
  status: ChangePreviewRowStatus;
  changes: StableChangeRow[];
  replacementFields: string[];
  validation: string[];
};

export type ChangePreviewView = {
  kind: "change.preview";
  change: {
    shortId: string;
    status: string;
    summary: string | null;
  };
  plan: Record<string, number>;
  operations: ChangePreviewRow[];
  impacts: Array<{
    resourceSlug: string;
    status: string;
    reason?: string | null;
  }>;
};

export type ApplyProgressRow = {
  slug: string;
  kind: string;
  status: string;
  error: NormalizedError | null;
  blockedBy: string[];
};

export type ApplyProgressView = {
  kind: "change.apply";
  change: {
    shortId: string;
    status: string;
    summary: string | null;
  };
  counts: ChangeSummaryCounts;
  operations: ApplyProgressRow[];
};

export type OperationTimelineEntry = {
  label: string;
};

export type OperationDetailView = {
  kind: "operation.detail";
  operation: {
    id: string;
    slug: string;
    kind: string;
    status: string;
    changeShortId: string | null;
    resourceType: string;
    dependsOn: string[];
  };
  intent: ValueRow[];
  outcome: {
    startedAt: string | null;
    finishedAt: string | null;
    result: string;
  };
  failure: NormalizedError | null;
  blocker: {
    blockedBy: string[];
    reason: string | null;
  } | null;
  diff: StableChangeRow[];
  timeline: OperationTimelineEntry[];
  advanced: {
    providerDiagnostics?: unknown;
    outputProps?: unknown;
    inputProps?: unknown;
    stateBefore?: unknown;
  };
};

type ChangeSummaryInput = {
  shortId: string;
  status: string;
  summary: string | null;
  createdAt: string;
  awaitingApproval?: boolean;
  operationCount?: number;
  previewSummary?: unknown;
  request?: { mutations?: unknown[] } | null;
  mutations?: unknown[] | null;
};

type ChangeDetailInput = {
  change: {
    shortId: string;
    status: string;
    summary: string | null;
    createdAt: string;
    awaitingApproval?: boolean;
    previewSummary?: unknown;
  };
  operations: ChangeOperationRecord[];
  latestExecution?: ExecutionRecord | null;
  latestApplyExecution?: ExecutionRecord | null;
};

type ChangePreviewInput = {
  change: {
    shortId: string;
    status: string;
    summary: string | null;
    previewSummary?: unknown;
  };
  execution: {
    previewSummary?: unknown;
  };
  operations: ChangePreviewOperation[];
  impacts: Array<{
    resourceSlug: string;
    status: string;
    reason?: string | null;
  }>;
};

type DiffLikeValue = {
  old?: unknown;
  new?: unknown;
  stored?: unknown;
  cloud?: unknown;
};

const REF_PATTERN = /\$\{[^}]+\}/;
const PROVIDER_ID_KEYS = ["providerId", "providerID", "id"];

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function hasRefs(value: unknown): boolean {
  if (typeof value === "string") return REF_PATTERN.test(value);
  if (Array.isArray(value)) return value.some(hasRefs);
  if (isPlainObject(value)) return Object.values(value).some(hasRefs);
  return false;
}

function formatPath(parent: string, key: string | number): string {
  if (typeof key === "number") {
    return `${parent}[${key}]`;
  }
  if (!parent) return key;
  return /^[0-9]+$/.test(key) ? `${parent}[${key}]` : `${parent}.${key}`;
}

function flattenValue(value: unknown, path = ""): Array<{ path: string; value: unknown }> {
  if (Array.isArray(value)) {
    if (value.length === 0) return [{ path: path || "(value)", value }];
    return value.flatMap((entry, index) => flattenValue(entry, formatPath(path, index)));
  }
  if (isPlainObject(value)) {
    const entries = Object.entries(value);
    if (entries.length === 0) return [{ path: path || "(value)", value }];
    return entries.flatMap(([key, child]) => flattenValue(child, formatPath(path, key)));
  }
  return [{ path: path || "(value)", value }];
}

function flattenDiffValue(value: unknown, path = "", isRoot = true): Array<{ path: string; value: unknown }> {
  if (value == null) {
    return isRoot ? [] : [{ path: path || "(value)", value: null }];
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return isRoot ? [] : [{ path: path || "(value)", value }];
    return value.flatMap((entry, index) => flattenDiffValue(entry, formatPath(path, index), false));
  }
  if (isPlainObject(value)) {
    const entries = Object.entries(value);
    if (entries.length === 0) return isRoot ? [] : [{ path: path || "(value)", value }];
    return entries.flatMap(([key, child]) => flattenDiffValue(child, formatPath(path, key), false));
  }
  return [{ path: path || "(value)", value }];
}

function diffRowsFromBeforeAfter(before: unknown, after: unknown): DeltaRow[] {
  const beforeEntries = flattenDiffValue(before);
  const afterEntries = flattenDiffValue(after);
  const beforeMap = new Map(beforeEntries.map((entry) => [entry.path, entry.value]));
  const afterMap = new Map(afterEntries.map((entry) => [entry.path, entry.value]));
  const paths = [...new Set([...beforeMap.keys(), ...afterMap.keys()])].sort();
  return paths
    .filter((path) => JSON.stringify(beforeMap.get(path)) !== JSON.stringify(afterMap.get(path)))
    .map((path) => ({
      path,
      before: beforeMap.get(path) ?? null,
      after: afterMap.get(path) ?? null,
    }));
}

function hasData(value: unknown): boolean {
  if (value == null) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value as Record<string, unknown>).length > 0;
  return true;
}

function diffRowsFromPatch(diff: Array<Record<string, unknown>>): DeltaRow[] {
  return diff.map((entry) => ({
    path: String(entry.path ?? "(value)").replace(/^\//, "").replace(/\//g, "."),
    before: entry.old ?? null,
    after: entry.value ?? null,
  }));
}

function diffRowsFromStructured(diff: Record<string, DiffLikeValue>): DeltaRow[] {
  return Object.entries(diff)
    .map(([path, value]) => ({
      path,
      before: value.old !== undefined || value.new !== undefined ? (value.old ?? null) : (value.stored ?? null),
      after: value.old !== undefined || value.new !== undefined ? (value.new ?? null) : (value.cloud ?? null),
    }))
    .filter((entry) => JSON.stringify(entry.before) !== JSON.stringify(entry.after))
    .sort((left, right) => left.path.localeCompare(right.path));
}

function diffRowsFromUnknown(diff: unknown, opts?: { inputsBefore?: unknown; inputsAfter?: unknown }): DeltaRow[] {
  if (opts && (opts.inputsBefore !== undefined || opts.inputsAfter !== undefined)) {
    const rows = diffRowsFromBeforeAfter(opts.inputsBefore ?? null, opts.inputsAfter ?? null);
    if (rows.length > 0) return rows;
  }
  if (diff == null) {
    return [];
  }
  if (Array.isArray(diff)) {
    return diffRowsFromPatch(diff as Array<Record<string, unknown>>);
  }
  if (isPlainObject(diff)) {
    const sample = Object.values(diff)[0];
    if (isPlainObject(sample) && ("old" in sample || "new" in sample || "stored" in sample || "cloud" in sample)) {
      return diffRowsFromStructured(diff as Record<string, DiffLikeValue>);
    }
  }
  return flattenDiffValue(diff).map((entry) => ({
    path: entry.path,
    before: null,
    after: entry.value,
  }));
}

function normalizeDetails(details: unknown): string | null {
  if (details == null) return null;
  if (typeof details === "string") return details;
  if (Array.isArray(details)) return details.map((entry) => normalizeDetails(entry)).filter(Boolean).join("; ") || null;
  if (!isPlainObject(details)) return String(details);
  if (typeof details.message === "string") return details.message;
  if (typeof details.reason === "string") return details.reason;
  if (Array.isArray(details.blockedBy) && details.blockedBy.length > 0) {
    return `blocked by ${details.blockedBy.join(", ")}`;
  }
  return Object.entries(details)
    .map(([key, value]) => `${key}: ${normalizeDetails(value) ?? "null"}`)
    .join("; ");
}

function asBlockedBy(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string");
}

export function normalizeError(args: {
  message?: string | null;
  code?: string | null;
  details?: unknown;
  blockedBy?: unknown;
}): NormalizedError | null {
  const message = args.message?.trim() ?? "";
  const blockedBy = asBlockedBy(args.blockedBy);
  const details = normalizeDetails(args.details);
  if (!message && !args.code && !details && blockedBy.length === 0) return null;
  return {
    message: message || (blockedBy.length > 0 ? "Operation blocked." : "Operation failed."),
    code: args.code ?? null,
    details,
    blockedBy: blockedBy.length > 0 ? blockedBy : null,
  };
}

export function getProviderId(resource: { providerId?: string | null }): string | null {
  return resource.providerId ?? null;
}

function extractProviderIdFromOutput(value: unknown): string | null {
  if (!isPlainObject(value)) return null;
  for (const key of PROVIDER_ID_KEYS) {
    const candidate = value[key];
    if (typeof candidate === "string" && candidate.length > 0) return candidate;
  }
  return null;
}

function buildIntentRows(templateInputs: Record<string, unknown>, resolvedInputs?: Record<string, unknown> | null): ValueRow[] {
  const templateRows = flattenValue(templateInputs);
  const resolvedMap = new Map(flattenValue(resolvedInputs ?? {}).map((entry) => [entry.path, entry.value]));
  return templateRows.map((entry) => {
    const resolved = resolvedMap.has(entry.path) ? resolvedMap.get(entry.path) : undefined;
    if (hasRefs(entry.value)) {
      return {
        path: entry.path,
        template: typeof entry.value === "string" ? entry.value : JSON.stringify(entry.value),
        resolved,
      };
    }
    return { path: entry.path, value: entry.value };
  });
}

function previewSummaryToRecord(summary: unknown): Record<string, number> {
  if (!isPlainObject(summary)) return {};
  if (isPlainObject(summary.byOp)) {
    return Object.fromEntries(
      Object.entries(summary.byOp).filter(([, value]) => typeof value === "number"),
    ) as Record<string, number>;
  }
  return Object.fromEntries(
    Object.entries(summary).filter(([, value]) => typeof value === "number"),
  ) as Record<string, number>;
}

function summarizeOperations(operations: Array<{ status: string }>): ChangeSummaryCounts {
  const counts: ChangeSummaryCounts = {
    pending: 0,
    running: 0,
    failed: 0,
    blocked: 0,
    succeeded: 0,
  };
  for (const operation of operations) {
    switch (operation.status) {
      case "pending":
      case "planned":
        counts.pending += 1;
        break;
      case "running":
      case "applying":
        counts.running += 1;
        break;
      case "failed":
        counts.failed += 1;
        break;
      case "blocked":
        counts.blocked += 1;
        break;
      default:
        counts.succeeded += 1;
        break;
    }
  }
  return counts;
}

function operationStatusWeight(status: string): number {
  switch (status) {
    case "failed":
      return 0;
    case "blocked":
      return 1;
    case "running":
    case "applying":
      return 2;
    case "pending":
    case "planned":
      return 3;
    default:
      return 4;
  }
}

function compareOperationsForDisplay(left: ChangeOperationRecord, right: ChangeOperationRecord): number {
  const byStatus = operationStatusWeight(left.status) - operationStatusWeight(right.status);
  if (byStatus !== 0) return byStatus;

  return left.resourceSlug.localeCompare(right.resourceSlug);
}

function compareOperationsByRecency(left: ChangeOperationRecord, right: ChangeOperationRecord): number {
  const leftTime = left.finishedAt ?? left.startedAt ?? left.createdAt ?? "";
  const rightTime = right.finishedAt ?? right.startedAt ?? right.createdAt ?? "";
  if (leftTime !== rightTime) return rightTime.localeCompare(leftTime);

  return right.id.localeCompare(left.id);
}

function selectLatestOperationPerSlug(operations: ChangeOperationRecord[]): ChangeOperationRecord[] {
  const groupedBySlug = new Map<string, ChangeOperationRecord>();
  for (const operation of operations) {
    const existing = groupedBySlug.get(operation.resourceSlug);
    if (!existing || compareOperationsByRecency(operation, existing) < 0) {
      groupedBySlug.set(operation.resourceSlug, operation);
    }
  }

  return [...groupedBySlug.values()];
}

function normalizeOperationKind(operation: ChangeOperationRecord): string {
  return operation.mutation?.kind === "forget" && operation.kind === "delete"
    ? "forget"
    : operation.kind;
}

/**
 * Single selector for authoritative change rows.
 * When a preview exists its rows are authoritative — even when empty ([]).
 * Falls back to persisted operation rows only when no preview is present.
 */
export function selectAuthoritativeChangeRows(
  operation: Pick<ChangeOperationRecord, "changes">,
  preview?: Pick<ChangePreviewOperation, "changes"> | null,
): StableChangeRow[] {
  return preview ? preview.changes : operation.changes;
}

function isMeaningfulOperationForDisplay(
  operation: Pick<ChangeOperationRecord, "kind" | "changes">,
): boolean {
  return operation.kind !== "same" || operation.changes.length > 0;
}

function isMeaningfulPreviewOperationForDisplay(
  operation: Pick<ChangePreviewOperation, "kind" | "changes">,
): boolean {
  return operation.kind !== "same" || operation.changes.length > 0;
}

export function buildResourceSummaryRows(resources: ResourceRecord[]): ResourceSummaryRow[] {
  return resources.map((resource) => ({
    slug: resource.slug,
    kind: resource.kind,
    type: resource.type,
    status: resource.status,
    parentSlug: (resource as ResourceRecord & { parentSlug?: string | null }).parentSlug ?? null,
    childCount: (resource as ResourceRecord & { childCount?: number }).childCount ?? 0,
    providerId: getProviderId(resource),
    lock: resource.lock ?? null,
  }));
}

export function buildResourceDetailView(resource: ResourceRecord, operations?: ChangeOperationRecord[]): ResourceDetailView {
  const latestOperation = (operations ?? [])[0] ?? null;
  const resolvedInputs = resource.conflict?.comparedInputs ?? null;
  const problem = resource.conflict ? diffRowsFromStructured(resource.conflict.diff).slice(0, 200) : [];
  return {
    kind: "resource.detail",
    resource: {
      slug: resource.slug,
      type: resource.type,
      status: resource.status,
      syncState: resource.syncState,
      providerId: getProviderId(resource),
      dependsOn: resource.dependsOn,
      lock: resource.lock ?? null,
    },
    intent: buildIntentRows(resource.inputs, resolvedInputs),
    problem,
    outcome: latestOperation
      ? {
          kind: latestOperation.kind,
          status: latestOperation.status,
          changeShortId: latestOperation.changeShortId ?? null,
          operationId: latestOperation.id,
          message: latestOperation.error ?? null,
          error: normalizeError({
            message: latestOperation.error,
            code: latestOperation.errorCode,
            details: latestOperation.errorDetails,
            blockedBy: latestOperation.blockedBy,
          }),
        }
      : null,
  };
}

export function buildResourceDiffView(args: {
  slug: string;
  type: string;
  status?: string;
  providerId?: string | null;
  inputs: Record<string, unknown>;
  liveInputs: Record<string, unknown> | null;
  liveError?: { message?: string | null } | null;
  diff: unknown;
}): ResourceDiffView {
  return {
    kind: "resource.diff",
    resource: {
      slug: args.slug,
      type: args.type,
      status: args.status ?? (args.liveError ? "unknown" : "in_sync"),
      providerId: args.providerId ?? null,
    },
    delta: diffRowsFromUnknown(args.diff, { inputsBefore: args.inputs, inputsAfter: args.liveInputs }),
    outcome: normalizeError({ message: args.liveError?.message ?? null }),
  };
}

export function buildResourceHistoryEntries(operations: ChangeOperationRecord[]): ResourceHistoryEntry[] {
  return operations.map((operation) => ({
    when: operation.createdAt ?? null,
    kind: operation.kind,
    status: operation.status,
    changeShortId: operation.changeShortId ?? null,
    operationId: operation.id,
    message: operation.error ?? null,
  }));
}

export function buildChangeSummaryRows(changes: ChangeSummaryInput[]): ChangeSummaryRow[] {
  return changes.map((change) => ({
    shortId: change.shortId,
    status: change.status,
    summary: change.summary ?? null,
    createdAt: change.createdAt,
    operationCount: change.operationCount ?? (change.request?.mutations?.length ?? change.mutations?.length ?? 0),
    previewSummary: previewSummaryToRecord(change.previewSummary),
    approvalRequired: change.awaitingApproval === true,
  }));
}

export function buildChangeDetailView(response: ChangeDetailInput): ChangeDetailView {
  const operations = selectLatestOperationPerSlug(response.operations)
    .filter(isMeaningfulOperationForDisplay)
    .sort((left, right) => {
    const byDisplay = compareOperationsForDisplay(left, right);
    if (byDisplay !== 0) return byDisplay;
    return left.resourceSlug.localeCompare(right.resourceSlug);
  });
  const failedExecution = response.latestApplyExecution?.status === "failed" || response.latestApplyExecution?.errorSummary
    ? response.latestApplyExecution
    : response.latestExecution;
  return {
    kind: "change.detail",
    change: {
      shortId: response.change.shortId,
      status: response.change.status,
      summary: response.change.summary ?? null,
      createdAt: response.change.createdAt,
      previewSummary: previewSummaryToRecord(response.change.previewSummary),
      approvalRequired: response.change.awaitingApproval === true,
      counts: summarizeOperations(operations),
      warnings: operations.every((operation) => operation.status !== "failed")
        && (failedExecution?.status === "failed" || failedExecution?.errorSummary)
        ? ["Latest execution failed before operations were recorded."]
        : [],
    },
    operations: operations.map((operation) => ({
      operationId: operation.id,
      slug: operation.resourceSlug,
      kind: normalizeOperationKind(operation),
      status: operation.status,
      resourceType: operation.resourceType,
      dependsOn: operation.mutation?.dependsOn ?? [],
      changes: selectAuthoritativeChangeRows(operation),
      error: normalizeError({
        message: operation.error,
        code: operation.errorCode,
        details: operation.errorDetails,
        blockedBy: operation.blockedBy,
      }),
      blockedBy: asBlockedBy(operation.blockedBy),
    })),
  };
}

export function buildChangePreviewView(response: ChangePreviewInput): ChangePreviewView {
  return {
    kind: "change.preview",
    change: {
      shortId: response.change.shortId,
      status: response.change.status,
      summary: response.change.summary ?? null,
    },
    plan: previewSummaryToRecord(response.execution.previewSummary ?? response.change.previewSummary),
    operations: response.operations.filter(isMeaningfulPreviewOperationForDisplay).map((operation) => {
      const validation = (operation.checkFailures ?? []).map((failure) => failure.reason);
      const replacementFields = isPlainObject(operation.providerDiff) && Array.isArray(operation.providerDiff.replaces)
        ? operation.providerDiff.replaces.filter((value): value is string => typeof value === "string")
        : [];
      const status: ChangePreviewRowStatus = validation.length > 0
        ? "invalid"
        : replacementFields.length > 0 || operation.requiresReplacement
          ? "warning"
          : "valid";
      return {
        operationId: operation.operationId ?? operation.id ?? operation.opKey ?? operation.resourceSlug,
        slug: operation.resourceSlug,
        kind: operation.kind,
        status,
        changes: selectAuthoritativeChangeRows(operation),
        replacementFields,
        validation,
      };
    }),
    impacts: response.impacts,
  };
}

export function buildOperationDetailView(args: {
  operation: ChangeOperationRecord;
  preview?: ChangePreviewOperation | null;
  latestExecution?: ExecutionRecord | null;
}): OperationDetailView {
  const { operation, preview, latestExecution } = args;
  const inputSource = (
    operation.intentInputs
    ?? (operation.mutation?.inputs as Record<string, unknown> | undefined)
    ?? (operation.inputProps as Record<string, unknown> | null)
    ?? {}
  ) as Record<string, unknown>;
  const resolvedInputs = preview?.resolvedInputs ?? operation.resolvedInputs ?? null;
  const failure = normalizeError({
    message: operation.error,
    code: operation.errorCode,
    details: operation.errorDetails,
    blockedBy: operation.blockedBy,
  });
  const blockedBy = asBlockedBy(operation.blockedBy);
  const diff = selectAuthoritativeChangeRows(operation, preview);
  const timeline: OperationTimelineEntry[] = [];
  if (operation.startedAt) timeline.push({ label: "operation started" });
  if (blockedBy.length > 0) timeline.push({ label: `blocked by ${blockedBy.join(", ")}` });
  if (failure) timeline.push({ label: failure.message });
  if (operation.finishedAt && !failure && blockedBy.length === 0) timeline.push({ label: "operation completed" });
  if (timeline.length === 0) {
    const executionStep = latestExecution?.steps.find((step) => step.id === operation.stepId)
      ?? latestExecution?.steps.find((step) => operation.opKey && step.stepKey === operation.opKey)
      ?? latestExecution?.steps.find((step) => !operation.stepId && !operation.opKey && step.resourceSlug === operation.resourceSlug);
    if (executionStep?.status) timeline.push({ label: `operation ${executionStep.status}` });
  }
  return {
    kind: "operation.detail",
    operation: {
      id: operation.id,
      slug: operation.resourceSlug,
      kind: normalizeOperationKind(operation),
      status: operation.status,
      changeShortId: operation.changeShortId ?? null,
      resourceType: operation.resourceType,
      dependsOn: operation.mutation?.dependsOn ?? [],
    },
    intent: buildIntentRows(inputSource, resolvedInputs),
    outcome: {
      startedAt: operation.startedAt ?? null,
      finishedAt: operation.finishedAt ?? null,
      result: operation.status,
    },
    failure: blockedBy.length === 0 ? failure : null,
    blocker: blockedBy.length > 0
      ? {
          blockedBy,
          reason: failure?.details ?? failure?.message ?? null,
        }
      : null,
    diff,
    timeline,
    advanced: {
      inputProps: operation.inputProps ?? null,
      outputProps: operation.outputProps ?? null,
      stateBefore: operation.stateBefore ?? null,
    },
  };
}

export function buildApplyProgressView(args: {
  change: { shortId: string; status: string; summary: string | null };
  operations: Array<{ slug: string; kind: string; status: string; error?: NormalizedError | null; blockedBy?: string[] }>;
}): ApplyProgressView {
  return {
    kind: "change.apply",
    change: args.change,
    counts: summarizeOperations(args.operations),
    operations: [...args.operations].sort((left, right) => {
      const byStatus = operationStatusWeight(left.status) - operationStatusWeight(right.status);
      if (byStatus !== 0) return byStatus;
      return left.slug.localeCompare(right.slug);
    }).map((operation) => ({
      slug: operation.slug,
      kind: operation.kind,
      status: operation.status,
      error: operation.error ?? null,
      blockedBy: operation.blockedBy ?? [],
    })),
  };
}
