export * from "./audit"
export * from "./auth"
export * from "./capabilities"
export * from "./changesets"
export * from "./onboarding"
export * from "./operations"
export * from "./projects"
export * from "./resource-dry-runs"
export * from "./resource-layouts"
export * from "./resources"
export * from "./shared"
export * from "./thinkingBlockArtifacts"
export * from "./thinkingBlockModelCalls"
export * from "./thinkingBlocks"
export * from "./thinkingBlockValidationResults"

import type {
	CreateResourceChanges,
	DeleteResourceChanges,
	ImportResourceChanges,
	UpdateResourceChanges,
} from "@/changesets/schemas"
import type { auditEvents } from "./audit"
import type { changeSetItems, changeSets } from "./changesets"
import type { operations } from "./operations"
import type { integrations, projects } from "./projects"
import type { resourceDryRuns } from "./resource-dry-runs"
import type { resourceLayouts } from "./resource-layouts"
import type { resources } from "./resources"
import type { thinkingBlockArtifacts } from "./thinkingBlockArtifacts"
import type { thinkingBlockModelCalls } from "./thinkingBlockModelCalls"
import type { thinkingBlockRuns } from "./thinkingBlocks"
import type { thinkingBlockValidationResults } from "./thinkingBlockValidationResults"

export type Project = typeof projects.$inferSelect
export type NewProject = typeof projects.$inferInsert
export type IntegrationRow = typeof integrations.$inferSelect
export type NewIntegrationRow = typeof integrations.$inferInsert

export type Operation<TRequest = (typeof operations.$inferSelect)["request"]> =
	Omit<typeof operations.$inferSelect, "request"> & {
		request: TRequest
	}
export type NewOperation = typeof operations.$inferInsert
export type ChangeSet = typeof changeSets.$inferSelect
export type NewChangeSet = typeof changeSets.$inferInsert

// Discriminated row type: kind narrows changes. Readers branch on item.kind and
// TypeScript narrows item.changes to the matching payload — no runtime parsing.
type ChangeSetItemRowBase = Omit<
	typeof changeSetItems.$inferSelect,
	"kind" | "changes"
>
export type ChangeSetItem =
	| (ChangeSetItemRowBase & {
			kind: "create_resource"
			changes: CreateResourceChanges
	  })
	| (ChangeSetItemRowBase & {
			kind: "update_resource"
			changes: UpdateResourceChanges
	  })
	| (ChangeSetItemRowBase & {
			kind: "delete_resource"
			changes: DeleteResourceChanges
	  })
	| (ChangeSetItemRowBase & {
			kind: "import_resource"
			changes: ImportResourceChanges
	  })
export type NewChangeSetItem = typeof changeSetItems.$inferInsert
export type ThinkingBlockRun = typeof thinkingBlockRuns.$inferSelect
export type NewThinkingBlockRun = typeof thinkingBlockRuns.$inferInsert
export type ThinkingBlockArtifact = typeof thinkingBlockArtifacts.$inferSelect
export type NewThinkingBlockArtifact =
	typeof thinkingBlockArtifacts.$inferInsert
export type ThinkingBlockModelCall = typeof thinkingBlockModelCalls.$inferSelect
export type NewThinkingBlockModelCall =
	typeof thinkingBlockModelCalls.$inferInsert
export type ThinkingBlockValidationResult =
	typeof thinkingBlockValidationResults.$inferSelect
export type NewThinkingBlockValidationResult =
	typeof thinkingBlockValidationResults.$inferInsert

export type Resource = typeof resources.$inferSelect
export type NewResource = typeof resources.$inferInsert
export type ResourceLayout = typeof resourceLayouts.$inferSelect
export type NewResourceLayout = typeof resourceLayouts.$inferInsert
export type StoredResourceDryRun = typeof resourceDryRuns.$inferSelect
export type NewStoredResourceDryRun = typeof resourceDryRuns.$inferInsert

export type AuditEvent = typeof auditEvents.$inferSelect
export type NewAuditEvent = typeof auditEvents.$inferInsert
