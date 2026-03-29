// ─── Audit Event Registry ─────────────────────────────────────────────────────
// Single source of truth for audit event types, entity types, and org-audit
// dashboard metadata. Backend validation, service helpers, and the web dashboard
// all derive their lists from this module.

/**
 * Every supported audit event type across the platform.
 */
export const AUDIT_EVENT_TYPES = [
  // Project lifecycle
  "project.created",
  "project.updated",
  "project.deleted",
  // Integration lifecycle (org-level)
  "integration.created",
  "integration.updated",
  "integration.deleted",
  "integration.tested",
  // Change lifecycle
  "change.proposed",
  "change.applied",
  "change.dismissed",
  // Resource events
  "resource.conflict_detected",
  // Personal access token lifecycle (org-level)
  "pat.created",
  "pat.revoked",
  // Agent access token lifecycle (org-level)
  "agent_token.created",
  "agent_token.revoked",
  // Agent lifecycle (org-level)
  "agent.created",
  "agent.updated",
  "agent.deleted",
  // Platform access events (not part of org-audit product)
  "platform_access.requested",
  "platform_access.approved",
  "platform_access.rejected",
] as const;

export type AuditEventType = (typeof AUDIT_EVENT_TYPES)[number];

/**
 * Every entity type that can appear in an audit row.
 */
export const AUDIT_ENTITY_TYPES = [
  "project",
  "integration",
  "change",
  "resource",
  "personal_access_token",
  "agent_access_token",
  "agent",
  "platform_access",
] as const;

export type AuditEntityType = (typeof AUDIT_ENTITY_TYPES)[number];

// ─── Scoped event type subsets ───────────────────────────────────────────────
// These drive compile-time scope safety in the backend audit helpers.

/** Events that require a projectId + orgId scope. */
export const PROJECT_AUDIT_EVENT_TYPES = [
  "project.created",
  "project.updated",
  "project.deleted",
  "change.proposed",
  "change.applied",
  "change.dismissed",
  "resource.conflict_detected",
] as const;

export type ProjectAuditEventType = (typeof PROJECT_AUDIT_EVENT_TYPES)[number];

/** Entity types that appear in project-scoped events. */
export type ProjectAuditEntityType = "project" | "change" | "resource";

/** Events that require an orgId scope (no projectId). */
export const ORG_ONLY_AUDIT_EVENT_TYPES = [
  "integration.created",
  "integration.updated",
  "integration.deleted",
  "integration.tested",
  "pat.created",
  "pat.revoked",
  "agent_token.created",
  "agent_token.revoked",
  "agent.created",
  "agent.updated",
  "agent.deleted",
] as const;

export type OrgAuditEventType = (typeof ORG_ONLY_AUDIT_EVENT_TYPES)[number];

/** Entity types that appear in org-scoped events. */
export type OrgAuditEntityType = "integration" | "personal_access_token" | "agent_access_token" | "agent";

/** Events for platform-level audit (no org required). */
export const PLATFORM_AUDIT_EVENT_TYPES = [
  "platform_access.requested",
  "platform_access.approved",
  "platform_access.rejected",
] as const;

export type PlatformAuditEventType = (typeof PLATFORM_AUDIT_EVENT_TYPES)[number];

/** Entity types that appear in platform-scoped events. */
export type PlatformAuditEntityType = "platform_access";

// ─── Org-Audit Dashboard Registry ────────────────────────────────────────────
// Events that are part of the *org* audit product (visible in the dashboard).
// Includes both project-scoped and org-scoped events.
// Platform-access events are excluded — they belong to a separate admin surface.

export type OrgAuditEventMeta = {
  eventType: ProjectAuditEventType | OrgAuditEventType;
  entityType: AuditEntityType;
  label: string;
  /** Dot colour class used in the dashboard timeline. */
  dot: string;
};

/**
 * Canonical list of org-audit events shown in the dashboard.
 * The dashboard event-filter options and presentation styles are derived from
 * this array — adding an entry here automatically wires it into the UI.
 */
export const ORG_AUDIT_EVENTS: OrgAuditEventMeta[] = [
  // Project
  { eventType: "project.created", entityType: "project", label: "Project created", dot: "bg-cyan-500" },
  { eventType: "project.updated", entityType: "project", label: "Project updated", dot: "bg-cyan-500" },
  { eventType: "project.deleted", entityType: "project", label: "Project deleted", dot: "bg-cyan-500" },
  // Integration
  { eventType: "integration.created", entityType: "integration", label: "Integration created", dot: "bg-indigo-500" },
  { eventType: "integration.updated", entityType: "integration", label: "Integration updated", dot: "bg-indigo-500" },
  { eventType: "integration.deleted", entityType: "integration", label: "Integration deleted", dot: "bg-indigo-500" },
  { eventType: "integration.tested", entityType: "integration", label: "Integration tested", dot: "bg-indigo-500" },
  // Change lifecycle
  { eventType: "change.proposed", entityType: "change", label: "Change proposed", dot: "bg-blue-500" },
  { eventType: "change.applied", entityType: "change", label: "Change applied", dot: "bg-green-500" },
  { eventType: "change.dismissed", entityType: "change", label: "Change dismissed", dot: "bg-muted-foreground" },
  // Resource
  { eventType: "resource.conflict_detected", entityType: "resource", label: "Conflict detected", dot: "bg-amber-500" },
  // PAT
  { eventType: "pat.created", entityType: "personal_access_token", label: "PAT created", dot: "bg-indigo-500" },
  { eventType: "pat.revoked", entityType: "personal_access_token", label: "PAT revoked", dot: "bg-red-500" },
  // Agent token
  { eventType: "agent_token.created", entityType: "agent_access_token", label: "Agent token created", dot: "bg-sky-500" },
  { eventType: "agent_token.revoked", entityType: "agent_access_token", label: "Agent token revoked", dot: "bg-rose-500" },
  // Agent
  { eventType: "agent.created", entityType: "agent", label: "Agent created", dot: "bg-violet-500" },
  { eventType: "agent.updated", entityType: "agent", label: "Agent updated", dot: "bg-violet-500" },
  { eventType: "agent.deleted", entityType: "agent", label: "Agent deleted", dot: "bg-violet-500" },
];

/** Set of event types that belong to the org-audit product. */
export const ORG_AUDIT_EVENT_TYPES = new Set(ORG_AUDIT_EVENTS.map((e) => e.eventType));

/** Unique entity types present in the org-audit registry. */
export const ORG_AUDIT_ENTITY_TYPES = [...new Set(ORG_AUDIT_EVENTS.map((e) => e.entityType))];
