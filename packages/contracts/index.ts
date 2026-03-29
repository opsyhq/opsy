export type Paginated<T> = { items: T[]; nextCursor: string | null };

export type ListParams = {
  limit?: number;
  cursor?: string;
  sort?: string;
};

export * from "./observe";
export * from "./commands";
export * from "./display";
export * from "./streaming";
export * from "./audit";

export type DiscoveryProviderId = "aws" | "cloudflare";

export type DiscoveryProviderSummary = {
  id: DiscoveryProviderId;
  label: string;
};

export const DISCOVERY_PROVIDERS: DiscoveryProviderSummary[] = [
  { id: "aws", label: "AWS" },
  { id: "cloudflare", label: "Cloudflare" },
];

export function getUnsupportedDiscoveryProviderMessage(provider: string): string {
  return `Discovery is not implemented for "${provider}". Use manual import.`;
}

/**
 * Auto-apply policy for environments, from most restrictive to most permissive.
 *
 * - "disabled":            No auto-apply (default)
 * - "creates_and_imports": Auto-apply CREATE and IMPORT only
 * - "non_destructive":     Auto-apply CREATE, IMPORT, and UPDATE (but NOT update-with-replacement, NOT delete)
 * - "all":                 Auto-apply everything
 */
export type AutoApplyPolicy = "disabled" | "creates_and_imports" | "non_destructive" | "all";

export const AUTO_APPLY_POLICIES: AutoApplyPolicy[] = ["disabled", "creates_and_imports", "non_destructive", "all"];

export const AUTO_APPLY_POLICY_LABELS: Record<AutoApplyPolicy, string> = {
  disabled: "Disabled",
  creates_and_imports: "Creates & Imports only",
  non_destructive: "Non-destructive (no deletes or replacements)",
  all: "All changes",
};

export type BillingPlan = "free" | "starter" | "business" | "enterprise";
export type BillingSource = "free" | "stripe" | "manual";

export type BillingFeatures = {
  auditLog: boolean;
  sso: boolean;
  domainVerification: boolean;
  emailSupport: boolean;
  dedicatedSupport: boolean;
  sla: boolean;
};

export type BillingLimits = {
  users: number | null;
  projects: number | null;
};

export type BillingUsage = {
  activeUsers: number;
  pendingInvites: number;
  seatsCounted: number;
  projects: number;
  resources: number;
};

export type OrgBillingSummary = {
  orgId: string;
  plan: BillingPlan;
  planSelected: boolean;
  billingSource: BillingSource;
  subscriptionStatus: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  usage: BillingUsage;
  limits: BillingLimits;
  features: BillingFeatures;
  blocked: {
    addUser: boolean;
    createProject: boolean;
  };
};

export type CheckoutSessionResponse = { url: string } | { upgraded: true };
export type BillingPortalResponse = { url: string };

export type CustomTimeouts = {
  create?: string;
  update?: string;
  delete?: string;
};

export type ChangeMutation = {
  kind: "create" | "update" | "delete" | "import" | "forget" | "external" | string;
  slug?: string;
  type?: string;
  inputs?: unknown;
  sensitiveInputs?: unknown;
  removeInputPaths?: string[];
  sensitiveInputPaths?: string[];
  providerId?: string;
  profileId?: string;
  parent?: string | null;
  dependsOn?: string[];
  recursive?: boolean;
  targetDependents?: boolean;
  force?: boolean;
  version?: number;
  customTimeouts?: CustomTimeouts;
};

export type ChangeRequestRecord = {
  mutations: ChangeMutation[];
};

export type ActorRecordType = "user" | "agent";

export type ActorRecord = {
  type: ActorRecordType;
  sourceType?: "user" | "agent" | "personal_agent";
  id: string;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  profilePictureUrl?: string | null;
  agentName?: string | null;
  agentAvatarStyle?: AgentAvatarStyle | null;
  agentAvatarSeed?: string | null;
};

export type OperationStateBefore = {
  inputs?: Record<string, unknown>;
  status?: string;
  providerId?: string | null;
  version?: number;
} | null;

export type StableChangeValue =
  | { kind: "null" }
  | { kind: "bool"; value: boolean }
  | { kind: "number"; value: number }
  | { kind: "string"; value: string }
  | { kind: "array"; items: StableChangeValue[] }
  | { kind: "object"; entries: Record<string, StableChangeValue> }
  | { kind: "computed"; element: StableChangeValue }
  | { kind: "output"; element: StableChangeValue; known: boolean; secret: boolean; dependencies: string[] }
  | { kind: "secret"; element: StableChangeValue }
  | {
      kind: "resource_reference";
      urn: string;
      name: string;
      type: string;
      id: StableChangeValue;
      packageVersion?: string;
    };

export type StableChangeRow = {
  path: string;
  type: "added" | "updated" | "removed";
  before?: StableChangeValue;
  after?: StableChangeValue;
  beforeSourceExpression?: string | null;
  afterSourceExpression?: string | null;
};

export type ChangeSourceBinding = {
  path: string;
  sourceExpression: string;
  refSlugs: string[];
  refPaths: string[];
  kind: "reference" | "interpolation";
  secret?: boolean;
};

export type ChangePresentationPayload = {
  intentInputs?: Record<string, unknown> | null;
  beforeValues?: StableChangeValue | null;
  afterValues?: StableChangeValue | null;
  sourceBindings?: {
    before?: Record<string, ChangeSourceBinding>;
    after?: Record<string, ChangeSourceBinding>;
  };
  presentationChanges: StableChangeRow[];
  previewComplete?: boolean;
  unresolvedRefs?: string[];
  providerDiff?: {
    changes: boolean;
    changeState?: "unknown" | "none" | "some";
    replaces: string[];
    diffs: string[];
    detailedDiff: Record<string, unknown>;
    deleteBeforeReplace: boolean;
  };
  checkFailures?: Array<{ property: string; reason: string }>;
  requiresReplacement?: boolean;
  parentChanged?: boolean;
  dependencyChanged?: boolean;
  inputChanges?: boolean;
  customTimeouts?: CustomTimeouts | null;
  providerId?: string | null;
  forget?: boolean;
  force?: boolean;
};

export type ChangeOperationRecord = {
  id: string;
  opKey?: string | null;
  changeId: string | null;
  executionId?: string | null;
  stepId?: string | null;
  changeShortId?: string | null;
  changeStatus?: string | null;
  changeSummary?: string | null;
  kind: string;
  status: string;
  resourceSlug: string;
  managed?: boolean;
  managedSlug?: string | null;
  resourceType: string;
  error: string | null;
  changes: StableChangeRow[];
  diff: ChangePresentationPayload | null;
  inputProps?: unknown;
  outputProps?: unknown;
  stateBefore?: OperationStateBefore;
  intentInputs?: Record<string, unknown> | null;
  resolvedInputs?: Record<string, unknown> | null;
  errorCode?: string | null;
  errorDetails?: unknown;
  blockedBy?: unknown;
  createdAt?: string;
  startedAt?: string | null;
  finishedAt?: string | null;
  resourceStatus?: string | null;
  resourceInputs?: Record<string, unknown> | null;
  resourceProviderId?: string | null;
  resourceProfileId?: string | null;
  requestedBy?: string | null;
  requestedByType?: string | null;
  requestedByActor?: ActorRecord | null;
  executedBy?: string | null;
  executedByType?: string | null;
  executedByActor?: ActorRecord | null;
  sensitiveInputPaths?: string[];
  customTimeouts?: CustomTimeouts | null;
  refs: string[];
  mutation?: ChangeMutation | null;
};

export type ChangePreviewOperation = {
  operationId: string;
  opKey?: string;
  stepKey?: string;
  resourceSlug: string;
  managed?: boolean;
  managedSlug?: string | null;
  kind: string;
  changes: StableChangeRow[];
  diff: ChangePresentationPayload | null;
  intentInputs?: Record<string, unknown> | null;
  resolvedInputs?: Record<string, unknown> | null;
  refs: string[];
  depStepKeys?: string[];
  providerDiff?: unknown;
  checkFailures?: Array<{ property: string; reason: string }>;
  requiresReplacement?: boolean;
  unresolvedRefs?: string[];
  previewComplete?: boolean;
  customTimeouts?: CustomTimeouts | null;
  resourceType?: string | null;
  resourceProviderId?: string | null;
  resourceProfileId?: string | null;
};

export type ExecutionStepError = {
  code: string;
  message: string;
  retryable?: boolean;
  kind?: string;
  details?: Record<string, unknown>;
};

export type ExecutionStepRecord = {
  id: string;
  resourceId: string | null;
  resourceSlug: string;
  stepKey: string;
  op: string;
  status: string;
  depStepKeys: string[];
  planPayload?: ChangePresentationPayload | null;
  error?: ExecutionStepError | null;
  providerDiagnostics?: unknown;
  startedAt?: string | null;
  finishedAt?: string | null;
};

export type ExecutionJournalEntryRecord = {
  id: string;
  stepId: string | null;
  sequence: number;
  kind: string;
  payload?: unknown;
  createdAt: string;
};

export type ExecutionRecord = {
  id: string;
  changeId: string | null;
  projectId: string;
  mode: "preview" | "apply" | "refresh" | "import";
  status: "pending" | "running" | "succeeded" | "failed" | "cancelled";
  targetSlugs: string[];
  leaseExpiresAt?: string | null;
  cancelRequestedAt?: string | null;
  cancelReason?: string | null;
  subgraphSummary?: unknown;
  previewSummary?: unknown;
  errorSummary?: unknown;
  requestedBy?: ActorRecord | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  steps: ExecutionStepRecord[];
  journal: ExecutionJournalEntryRecord[];
};

export type DownstreamImpactRecord = {
  resourceSlug: string;
  status: "unaffected" | "may_reconcile" | "pending_upstream" | "broken_if_deleted";
  reason?: string | null;
};

export type ChangeRecord = {
  id: string;
  shortId: string;
  projectId: string;
  summary: string | null;
  status: "open" | "previewed" | "applying" | "partially_applied" | "applied" | "failed" | "dismissed";
  awaitingApproval?: boolean;
  createdAt: string;
  updatedAt?: string;
  request?: ChangeRequestRecord | null;
  targetSlugs?: string[] | null;
  appliedTargets?: string[];
  remainingTargets?: string[];
  activeExecutionId?: string | null;
  activeTargetSlugs?: string[];
  previewSummary?: unknown;
  derivedFromChangeId?: string | null;
  derivationKind?: string | null;
  mutations?: ChangeMutation[] | null;
  proposedBy?: ActorRecord | null;
  appliedBy?: ActorRecord | null;
};

export type OrgChangeRecord = ChangeRecord & {
  projectSlug: string;
  projectName: string;
};

export type ChangeDetailResponse = {
  change: ChangeRecord;
  operations: ChangeOperationRecord[];
  executions: ExecutionRecord[];
  latestExecution: ExecutionRecord | null;
  latestApplyExecution?: ExecutionRecord | null;
};

export type ChangePreviewResponse = {
  change: ChangeRecord;
  execution: ExecutionRecord;
  operations: ChangePreviewOperation[];
  impacts: DownstreamImpactRecord[];
};

export type ResourceConflictDiffEntry = {
  stored: unknown;
  cloud: unknown;
};

export type ResourceConflictSnapshot = {
  operationId: string | null;
  detectedAt: string | null;
  comparedInputs: Record<string, unknown>;
  liveInputs: Record<string, unknown>;
  liveOutputs: Record<string, unknown>;
  diff: Record<string, ResourceConflictDiffEntry>;
};

export type ResourceSyncState = "in_sync" | "stale" | "conflicted";

export type ResourceRecord = {
  id: string;
  slug: string;
  kind: "resource" | "group";
  type: string;
  providerPkg: string;
  status: string;
  syncState: ResourceSyncState;
  version: number;
  providerId: string | null;
  inputs: Record<string, unknown>;
  dependsOn: string[];
  customTimeouts?: CustomTimeouts | null;
  conflict: ResourceConflictSnapshot | null;
  createdAt: string;
  updatedAt: string;
};

export type ProviderUsageBinding = {
  projectSlug: string;
  projectName: string;
  boundAt: string;
};

export type ProviderUsageSummary = {
  profileId: string;
  bindingCount: number;
  bindings: ProviderUsageBinding[];
};

export type OnboardingState = {
  hasOrg: boolean;
  hasProject: boolean;
  projectCount: number;
  hasIntegration?: boolean;
  orgIntegrationsCount?: number;
  integrationsCount: number;
};

export type PlatformAccessStatus = "none" | "requested" | "approved" | "rejected";

export type PlatformAccessRecord = {
  id: string;
  email: string;
  name: string | null;
  status: Exclude<PlatformAccessStatus, "none">;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PlatformAccessMeResponse = {
  email: string;
  status: PlatformAccessStatus;
  hasActiveMembership: boolean;
  canCreateOrg: boolean;
  record: PlatformAccessRecord | null;
};

export type PlatformAccessListResponse = {
  items: PlatformAccessRecord[];
};

export type ErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "CONFLICT"
  | "PLAN_LIMIT_REACHED"
  | "FEATURE_NOT_AVAILABLE"
  | "BILLING_NOT_CONFIGURED"
  | "PROVIDER_NOT_BOUND"
  | "APPROVAL_REQUIRED"
  | "VERSION_CONFLICT"
  | "NOT_IMPLEMENTED"
  | "INTERNAL_ERROR";

export const AGENT_AVATAR_STYLES = ["bottts-neutral"] as const;

export type AgentAvatarStyle = (typeof AGENT_AVATAR_STYLES)[number];

export const DEFAULT_AGENT_AVATAR_STYLE: AgentAvatarStyle = "bottts-neutral";

export type AgentProfile = {
  name: string;
  avatarStyle: AgentAvatarStyle;
  avatarSeed: string;
};

export type UpdateAgentProfileInput = {
  name: string;
};

export type PersonalAccessTokenListItem = {
  id: string;
  label: string;
  publicId: string;
  tokenSuffix: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
};

export type CreatePersonalAccessTokenInput = {
  label: string;
};

export type ListPersonalAccessTokensResponse = {
  items: PersonalAccessTokenListItem[];
};

export type CreatePersonalAccessTokenResponse = {
  item: PersonalAccessTokenListItem;
  token: string;
};

export const meRoutes = {
  agentProfile: "/me/agent-profile",
  personalAccessTokens: "/me/pats",
  personalAccessToken(tokenId: string) {
    return `/me/pats/${tokenId}`;
  },
} as const;

export const orgRoutes = {
  onboardingState: "/org/onboarding-state",
  members: "/org/members",
} as const;

export const platformAccessRoutes = {
  me: "/platform-access/me",
  request: "/platform-access/request",
  publicRequest: "/public/platform-access/request",
  adminList: "/admin/platform-access",
  adminApprove: "/admin/platform-access/approve",
  adminReject: "/admin/platform-access/reject",
} as const;

export type FeedbackSource = "web_ui" | "cli" | "cli_llm" | "mcp_llm" | string;

export type SubmitFeedbackInput = {
  message: string;
  source: FeedbackSource;
  pagePath?: string;
  metadata?: Record<string, unknown>;
};

export type SubmitFeedbackResponse = {
  id: string;
  message: string;
  pagePath: string | null;
  source: string;
  createdAt: string;
};

export const feedbackRoutes = {
  submit: "/feedback",
} as const;

export const REALTIME_EVENT_ENTITIES = [
  "audit_events",
  "changes",
  "integrations",
  "operations",
  "projects",
  "resources",
] as const;

export type RealtimeEventEntity = typeof REALTIME_EVENT_ENTITIES[number];

export const REALTIME_EVENT_ACTIONS = [
  "apply_started",
  "change_awaiting_approval",
  "change_created",
  "change_dismissed",
  "change_retried",
  "execution_cancel_requested",
  "execution_cancelled",
  "execution_completed",
  "execution_failed",
  "integration_bound",
  "integration_unbound",
  "preview_started",
  "project_deleted",
  "project_restored",
  "project_updated",
  "resource_updated",
  "resources_refreshed",
] as const;

export type RealtimeEventAction = typeof REALTIME_EVENT_ACTIONS[number];

export type RealtimeEvent = {
  project: string;
  entity: RealtimeEventEntity;
  slug?: string;
  action: RealtimeEventAction;
  executionId?: string;
  updatedAt: string;
};

export const EXECUTION_STREAM_EVENT_TYPES = [
  "execution.started",
  "step.started",
  "step.completed",
  "execution.completed",
  "execution.cancelled",
  "execution.failed",
] as const;

export type ExecutionStreamEventType = typeof EXECUTION_STREAM_EVENT_TYPES[number];
export type TerminalExecutionStreamEventType = Extract<
  ExecutionStreamEventType,
  "execution.completed" | "execution.cancelled" | "execution.failed"
>;

type ExecutionStreamPayloadBase = Record<string, unknown> & {
  executionId?: string;
};

type ExecutionStepPayloadBase = ExecutionStreamPayloadBase & {
  stepId?: string | null;
  stepKey?: string;
  resourceSlug?: string;
  op?: string;
};

export type ExecutionStartedPayload = ExecutionStreamPayloadBase & {
  mode?: string;
};

export type StepStartedPayload = ExecutionStepPayloadBase;

export type StepCompletedPayload = ExecutionStepPayloadBase & {
  status?: string;
  error?: unknown;
  blockedBy?: string[];
};

export type ExecutionTerminalPayload = ExecutionStreamPayloadBase & {
  status?: string;
  previewSummary?: unknown;
  errorSummary?: unknown;
};

type ExecutionStreamEventBase<
  TType extends ExecutionStreamEventType,
  TPayload extends Record<string, unknown>,
> = {
  id: string;
  executionId: string;
  changeId: string | null;
  changeShortId: string | null;
  projectSlug: string;
  sequence: number;
  timestamp: string;
  type: TType;
  payload: TPayload;
};

export type ExecutionStartedEvent = ExecutionStreamEventBase<"execution.started", ExecutionStartedPayload>;
export type StepStartedEvent = ExecutionStreamEventBase<"step.started", StepStartedPayload>;
export type StepCompletedEvent = ExecutionStreamEventBase<"step.completed", StepCompletedPayload>;
export type ExecutionCompletedEvent = ExecutionStreamEventBase<"execution.completed", ExecutionTerminalPayload>;
export type ExecutionCancelledEvent = ExecutionStreamEventBase<"execution.cancelled", ExecutionTerminalPayload>;
export type ExecutionFailedEvent = ExecutionStreamEventBase<"execution.failed", ExecutionTerminalPayload>;

export type ExecutionStreamEvent =
  | ExecutionStartedEvent
  | StepStartedEvent
  | StepCompletedEvent
  | ExecutionCompletedEvent
  | ExecutionCancelledEvent
  | ExecutionFailedEvent;

export function isTerminalExecutionStreamEventType(type: ExecutionStreamEventType): type is TerminalExecutionStreamEventType {
  return type === "execution.completed" || type === "execution.cancelled" || type === "execution.failed";
}

export function isTerminalExecutionStreamEvent(
  event: ExecutionStreamEvent,
): event is ExecutionCompletedEvent | ExecutionCancelledEvent | ExecutionFailedEvent {
  return isTerminalExecutionStreamEventType(event.type);
}

export type ApplyChangeRequest = {
  targetSlugs?: string[];
};

export type ApplyChangeApprovalRequiredResponse = {
  kind: "approval_required";
  reviewUrl: string;
  change: { shortId: string; status: string };
  preview?: ChangePreviewResponse | null;
};

export type ApplyChangeStartedResponse = {
  kind: "started";
  executionId: string;
  changeShortId: string;
  targetSlugs: string[];
};

export type ApplyChangeResponse =
  | ApplyChangeApprovalRequiredResponse
  | ApplyChangeStartedResponse;

// ─── Agents ─────────────────────────────────────────────────────────────────

export type AgentStatus = "active" | "suspended";

export type AgentRecord = {
  id: string;
  name: string;
  description: string | null;
  status: AgentStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  deletedBy?: string | null;
  deletedByType?: string | null;
};

export type AgentListResponse = {
  items: AgentRecord[];
};

export type CreateAgentInput = {
  name: string;
  description?: string;
};

export type UpdateAgentInput = {
  name?: string;
  description?: string | null;
  status?: AgentStatus;
};

export const agentRoutes = {
  list: "/agents",
  create: "/agents",
  get(agentId: string) {
    return `/agents/${agentId}`;
  },
  update(agentId: string) {
    return `/agents/${agentId}`;
  },
  delete(agentId: string) {
    return `/agents/${agentId}`;
  },
  restore(agentId: string) {
    return `/agents/${agentId}/restore`;
  },
  tokens(agentId: string) {
    return `/agents/${agentId}/tokens`;
  },
  token(agentId: string, tokenId: string) {
    return `/agents/${agentId}/tokens/${tokenId}`;
  },
} as const;
