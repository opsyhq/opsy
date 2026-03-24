export type Paginated<T> = { items: T[]; nextCursor: string | null };

export * from "./observe";
export * from "./commands";

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

export type BillingPlan = "free" | "starter" | "team" | "enterprise";
export type BillingSource = "free" | "stripe" | "manual";

export type BillingFeatures = {
  auditLog: boolean;
  sso: boolean;
  domainVerification: boolean;
  apiKeys: boolean;
  emailSupport: boolean;
  dedicatedSupport: boolean;
  sla: boolean;
};

export type BillingLimits = {
  users: number | null;
  workspaces: number | null;
  resources: number | null;
};

export type BillingUsage = {
  activeUsers: number;
  pendingInvites: number;
  seatsCounted: number;
  workspaces: number;
  resources: number;
};

export type OrgBillingSummary = {
  orgId: string;
  plan: BillingPlan;
  billingSource: BillingSource;
  subscriptionStatus: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  usage: BillingUsage;
  limits: BillingLimits;
  features: BillingFeatures;
  blocked: {
    addUser: boolean;
    createWorkspace: boolean;
  };
};

export type CheckoutSessionResponse = { url: string } | { upgraded: true };
export type BillingPortalResponse = { url: string };

export type ChangeMutation = {
  kind: "create" | "update" | "delete" | "import" | "forget" | "external" | string;
  slug?: string;
  type?: string;
  inputs?: unknown;
  removeInputPaths?: string[];
  sensitiveInputPaths?: string[];
  cloudId?: string;
  importId?: string;
  parentSlug?: string | null;
  recursive?: boolean;
  force?: boolean;
  version?: number;
};

export type ChangeRequestRecord = {
  mutations: ChangeMutation[];
};

export type ActorRecordType = "user" | "agent";

export type ActorRecord = {
  type: ActorRecordType;
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
  cloudId?: string | null;
  version?: number;
} | null;

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
  resourceType: string;
  error: string | null;
  diff: unknown;
  inputProps?: unknown;
  outputProps?: unknown;
  stateBefore?: OperationStateBefore;
  errorCode?: string | null;
  errorDetails?: unknown;
  blockedBy?: unknown;
  createdAt?: string;
  startedAt?: string | null;
  finishedAt?: string | null;
  resourceStatus?: string | null;
  resourceInputs?: Record<string, unknown> | null;
  resourceCloudId?: string | null;
  requestedBy?: string | null;
  requestedByType?: string | null;
  requestedByActor?: ActorRecord | null;
  executedBy?: string | null;
  executedByType?: string | null;
  executedByActor?: ActorRecord | null;
  sensitiveInputPaths?: string[];
  refs: string[];
  mutation?: ChangeMutation | null;
};

export type ChangePreviewOperation = {
  operationId: string;
  opKey?: string;
  stepKey?: string;
  resourceSlug: string;
  kind: string;
  diff: unknown;
  refs: string[];
  depStepKeys?: string[];
  providerDiff?: unknown;
  checkFailures?: Array<{ property: string; reason: string }>;
  requiresReplacement?: boolean;
  unresolvedRefs?: string[];
  previewComplete?: boolean;
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
  planPayload?: unknown;
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
  envId: string;
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
  envId: string;
  summary: string | null;
  status: "open" | "previewed" | "applying" | "partially_applied" | "applied" | "failed" | "dismissed";
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

export type ChangeDetailResponse = {
  change: ChangeRecord;
  operations: ChangeOperationRecord[];
  executions: ExecutionRecord[];
  latestExecution: ExecutionRecord | null;
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
  cloudId: string | null;
  inputs: Record<string, unknown>;
  conflict: ResourceConflictSnapshot | null;
  createdAt: string;
  updatedAt: string;
};

export type ProviderUsageBinding = {
  workspaceSlug: string;
  workspaceName: string;
  envSlug: string;
  boundAt: string;
};

export type ProviderUsageSummary = {
  profileId: string;
  bindingCount: number;
  bindings: ProviderUsageBinding[];
};

export type OnboardingState = {
  hasOrg: boolean;
  hasWorkspace: boolean;
  workspaceCount: number;
  hasProviderProfile?: boolean;
  orgProviderProfilesCount?: number;
  providerProfilesCount: number;
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

export type RealtimeEvent = {
  workspace: string;
  entity: string;
  env?: string;
  slug?: string;
  id?: string;
};

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
  tokens(agentId: string) {
    return `/agents/${agentId}/tokens`;
  },
  token(agentId: string, tokenId: string) {
    return `/agents/${agentId}/tokens/${tokenId}`;
  },
} as const;
