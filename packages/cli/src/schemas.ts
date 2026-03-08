import { z } from "zod";
import {
  ApprovalStatusEnum,
  DraftMutationResponseSchema,
  DraftValidateResponseSchema,
  ErrorResponseSchema,
  OrgNotesSchema,
  OrgVariableSchema,
  RestRunSchema,
  RunKindEnum,
  RunStatusEnum,
  RunWaitResponseSchema,
  StackApplyResponseSchema,
  StackImportResponseSchema,
  WorkspaceSchema,
} from "@opsy/contracts";

export const WorkOsUserSchema = z.object({
  id: z.string().min(1),
  email: z.string().min(1),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  profilePictureUrl: z.string().nullable(),
  agentName: z.string().min(1),
  agentAvatarStyle: z.string().min(1),
  agentAvatarSeed: z.string().min(1),
});
export type WorkOsUser = z.infer<typeof WorkOsUserSchema>;

export const WhoAmIResponseSchema = z.object({
  user: WorkOsUserSchema,
  actor: z.object({
    userId: z.string().min(1),
    orgId: z.string().min(1),
    actorType: z.string().min(1),
    authType: z.enum(["jwt", "pat"]),
    credentialId: z.string().nullable(),
    credentialLabel: z.string().nullable(),
  }),
});
export type WhoAmIResponse = z.infer<typeof WhoAmIResponseSchema>;

export const WorkspaceListItemSchema = WorkspaceSchema.extend({
  stackCount: z.number().int().nonnegative().optional(),
  envCount: z.number().int().nonnegative().optional(),
});
export const WorkspaceListResponseSchema = z.array(WorkspaceListItemSchema);
export type WorkspaceListItem = z.infer<typeof WorkspaceListItemSchema>;

const RunActorSchema = WorkOsUserSchema.nullable();

const RunResultSchema = z.object({
  changeSummary: z.record(z.string(), z.number()),
  stdout: z.string(),
});

export const RunListItemSchema = z.object({
  id: z.string().min(1),
  shortId: z.string().min(1),
  kind: RunKindEnum,
  status: RunStatusEnum,
  stackSlug: z.string().min(1),
  envSlug: z.string().min(1),
  revisionId: z.string().nullable(),
  revisionNumber: z.number().int().positive().nullable(),
  draftId: z.string().nullable(),
  draftShortId: z.string().nullable(),
  queuedAt: z.string().min(1),
  startedAt: z.string().nullable(),
  finishedAt: z.string().nullable(),
  error: z.string().nullable(),
  requestedBy: RunActorSchema,
  requestedByType: z.string().nullable().optional(),
});
export type RunListItem = z.infer<typeof RunListItemSchema>;

export const RunListResponseSchema = z.object({
  items: z.array(RunListItemSchema),
  nextCursor: z.string().nullable(),
});
export type RunListResponse = z.infer<typeof RunListResponseSchema>;

export const RunGetResponseSchema = z.object({
  id: z.string().min(1),
  shortId: z.string().min(1),
  kind: RunKindEnum,
  status: RunStatusEnum,
  reason: z.string().nullable().optional(),
  stackSlug: z.string().min(1),
  envSlug: z.string().min(1),
  revisionId: z.string().nullable(),
  revisionNumber: z.number().int().positive().nullable(),
  draftId: z.string().nullable(),
  draftShortId: z.string().nullable(),
  queuedAt: z.string().min(1),
  startedAt: z.string().nullable(),
  finishedAt: z.string().nullable(),
  error: z.string().nullable(),
  previewResult: RunResultSchema.nullable().optional(),
  applyResult: RunResultSchema.nullable().optional(),
  requestedBy: RunActorSchema,
  requestedByType: z.string().nullable().optional(),
  approval: z
    .object({
      status: ApprovalStatusEnum,
      decidedBy: RunActorSchema,
      decidedAt: z.string().nullable(),
    })
    .nullable(),
});
export type RunGetResponse = z.infer<typeof RunGetResponseSchema>;

export const DraftSummarySchema = z.object({
  id: z.string().min(1),
  shortId: z.string().min(1),
  name: z.string().nullable(),
  specHash: z.string().min(1),
  baseRevisionId: z.string().nullable(),
  isStale: z.boolean(),
  createdByType: z.enum(["user", "agent"]),
  createdByUser: WorkOsUserSchema.nullable(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});
export type DraftSummary = z.infer<typeof DraftSummarySchema>;

export const DraftListResponseSchema = z.array(DraftSummarySchema);
export type DraftListResponse = z.infer<typeof DraftListResponseSchema>;

export const DraftDetailSchema = DraftSummarySchema.extend({
  spec: z.string(),
  baseRevision: z
    .object({
      id: z.string().min(1),
      revisionNumber: z.number().int().positive(),
      spec: z.string(),
    })
    .nullable(),
});
export type DraftDetail = z.infer<typeof DraftDetailSchema>;

export const DraftCreateResponseSchema = z.object({
  draftId: z.string().min(1),
  shortId: z.string().min(1),
});
export type DraftCreateResponse = z.infer<typeof DraftCreateResponseSchema>;

export type DraftMutationResponse = z.infer<typeof DraftMutationResponseSchema>;
export type DraftValidateResponse = z.infer<typeof DraftValidateResponseSchema>;

export const RevisionSummarySchema = z.object({
  id: z.string().min(1),
  revisionNumber: z.number().int().positive(),
  specHash: z.string().min(1),
  runId: z.string().nullable(),
  createdByType: z.enum(["user", "agent"]),
  createdByUser: WorkOsUserSchema.nullable(),
  createdAt: z.string().min(1),
});
export type RevisionSummary = z.infer<typeof RevisionSummarySchema>;

export const RevisionListResponseSchema = z.object({
  items: z.array(RevisionSummarySchema),
  nextCursor: z.string().nullable(),
});
export type RevisionListResponse = z.infer<typeof RevisionListResponseSchema>;

export const RevisionDetailSchema = z.object({
  id: z.string().min(1),
  revisionNumber: z.number().int().positive(),
  spec: z.string(),
  specHash: z.string().min(1),
  runId: z.string().nullable(),
  createdByType: z.enum(["user", "agent"]),
  createdByUser: WorkOsUserSchema.nullable(),
  createdAt: z.string().min(1),
  baseRevision: z
    .object({
      id: z.string().min(1),
      revisionNumber: z.number().int().positive(),
      spec: z.string(),
    })
    .nullable(),
});
export type RevisionDetail = z.infer<typeof RevisionDetailSchema>;

export const RestRunSummarySchema = RestRunSchema;
export type RestRunSummary = z.infer<typeof RestRunSummarySchema>;

export type RunWaitResponse = z.infer<typeof RunWaitResponseSchema>;
export type StackApplyResponse = z.infer<typeof StackApplyResponseSchema>;
export type StackImportResponse = z.infer<typeof StackImportResponseSchema>;

export const RunCancelResponseSchema = RestRunSummarySchema;
export type RunCancelResponse = z.infer<typeof RunCancelResponseSchema>;

export const OrgVariableListResponseSchema = z.array(OrgVariableSchema);
export type OrgVariableItem = z.infer<typeof OrgVariableSchema>;

export const OrgNotesResponseSchema = OrgNotesSchema;
export type OrgNotesResponse = z.infer<typeof OrgNotesResponseSchema>;

export {
  DraftMutationResponseSchema,
  DraftValidateResponseSchema,
  ErrorResponseSchema,
  OrgNotesSchema,
  OrgVariableSchema,
  RunWaitResponseSchema,
  StackApplyResponseSchema,
  StackImportResponseSchema,
};
