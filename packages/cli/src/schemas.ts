import { z } from "zod";
import {
  ApprovalStatusEnum,
  DraftMutationCommandResponseSchema,
  DraftRenderResponseSchema,
  DraftMutationResponseSchema as ContractDraftMutationResponseSchema,
  DraftValidateResponseSchema,
  EnvSchema,
  ErrorResponseSchema,
  OrgNotesSchema,
  OrgVariableSchema,
  RestRunSchema,
  RunKindEnum,
  RunStatusEnum,
  RunWaitResponseSchema,
  SchemaGetResponseSchema,
  SchemaScaffoldResponseSchema,
  SchemaSearchResponseSchema as ContractSchemaSearchResponseSchema,
  StackApplyResponseSchema,
  StackImportResponseSchema,
  StackSchema,
  WorkspaceEnvVarsResponseSchema,
  WorkspaceSchema,
  WorkspaceTreeResponseSchema,
} from "@opsy/contracts";
export {
  DraftMutationCommandResponseSchema,
  DraftRenderResponseSchema,
  SchemaGetResponseSchema,
  SchemaScaffoldResponseSchema,
  WorkspaceEnvVarsResponseSchema,
  WorkspaceTreeResponseSchema,
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
  resourceChanges: z.array(z.object({
    op: z.string().min(1),
    type: z.string().min(1),
    name: z.string().min(1),
    action: z.string().min(1),
    summary: z.string().min(1),
  })).optional(),
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

export const DraftMutationResponseSchema = ContractDraftMutationResponseSchema.extend({
  validationSummary: z.string().min(1).optional(),
});

export const SchemaSearchResponseSchema = ContractSchemaSearchResponseSchema.extend({
  items: ContractSchemaSearchResponseSchema.shape.items.element.extend({
    keyProps: z.array(z.string()),
  }).array(),
});

export type DraftMutationResponse = z.infer<typeof DraftMutationResponseSchema>;
export type DraftValidateResponse = z.infer<typeof DraftValidateResponseSchema>;
export type DraftRenderResponse = z.infer<typeof DraftRenderResponseSchema>;
export type DraftMutationCommandResponse = z.infer<typeof DraftMutationCommandResponseSchema>;

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
export type SchemaSearchResponse = z.infer<typeof SchemaSearchResponseSchema>;
export type SchemaGetResponse = z.infer<typeof SchemaGetResponseSchema>;
export type SchemaScaffoldResponse = z.infer<typeof SchemaScaffoldResponseSchema>;

export const RunCancelResponseSchema = RestRunSummarySchema;
export type RunCancelResponse = z.infer<typeof RunCancelResponseSchema>;

export const OrgVariableListResponseSchema = z.array(OrgVariableSchema);
export type OrgVariableItem = z.infer<typeof OrgVariableSchema>;

export const OrgNotesResponseSchema = OrgNotesSchema;
export type OrgNotesResponse = z.infer<typeof OrgNotesResponseSchema>;

// --- Workspace ---

export const WorkspaceDetailSchema = WorkspaceSchema;
export type WorkspaceDetail = z.infer<typeof WorkspaceDetailSchema>;

export const WorkspaceCreateResponseSchema = WorkspaceSchema;
export type WorkspaceCreateResponse = z.infer<typeof WorkspaceCreateResponseSchema>;
export type WorkspaceTreeResponse = z.infer<typeof WorkspaceTreeResponseSchema>;
export type WorkspaceEnvVarsResponse = z.infer<typeof WorkspaceEnvVarsResponseSchema>;

// --- Stacks ---

const StackDeploymentSchema = z.object({
  envSlug: z.string().min(1),
  currentRevisionId: z.string().nullable(),
  currentRevisionNumber: z.number().int().positive().nullable(),
  lastAppliedAt: z.string().nullable(),
  activeRunStatus: RunStatusEnum.nullable(),
});

export const StackListItemSchema = StackSchema.extend({
  headRevisionNumber: z.number().int().positive().nullable(),
  draftCount: z.number().int().nonnegative(),
  deployments: z.array(StackDeploymentSchema),
});
export const StackListResponseSchema = z.array(StackListItemSchema);
export type StackListItem = z.infer<typeof StackListItemSchema>;

export const StackCreateResponseSchema = StackSchema;
export type StackCreateResponse = z.infer<typeof StackCreateResponseSchema>;

export const StackDetailSchema = StackSchema.extend({
  headRevision: z.object({
    id: z.string().min(1),
    revisionNumber: z.number().int().positive(),
    spec: z.string(),
    specHash: z.string().min(1),
  }).nullable(),
  draftCount: z.number().int().nonnegative(),
  deployments: z.array(StackDeploymentSchema.extend({
    lastRunId: z.string().nullable().optional(),
  })),
});
export type StackDetail = z.infer<typeof StackDetailSchema>;

// --- Stack state ---

const StackStateResourceSchema = z.object({
  urn: z.string(),
  name: z.string(),
  type: z.string(),
  inputs: z.record(z.string(), z.unknown()),
  outputs: z.record(z.string(), z.unknown()),
  deps: z.array(z.string()),
  created: z.string().nullable(),
  modified: z.string().nullable(),
});

export const StackStateEnvSchema = z.object({
  envSlug: z.string().min(1),
  updatedAt: z.string(),
  runId: z.string(),
  currentRevisionId: z.string().nullable(),
  currentRevisionNumber: z.number().int().positive().nullable(),
  resources: z.array(StackStateResourceSchema),
});
export const StackStateResponseSchema = z.array(StackStateEnvSchema);
export type StackStateEnv = z.infer<typeof StackStateEnvSchema>;

// --- Environments ---

export const EnvListItemSchema = EnvSchema.extend({
  bindings: z.array(z.object({
    providerPkg: z.string().min(1),
    profileName: z.string().nullable(),
  })),
  variableCount: z.number().int().nonnegative(),
  secretCount: z.number().int().nonnegative(),
});
export const EnvListResponseSchema = z.array(EnvListItemSchema);
export type EnvListItem = z.infer<typeof EnvListItemSchema>;

export const EnvCreateResponseSchema = EnvSchema;
export type EnvCreateResponse = z.infer<typeof EnvCreateResponseSchema>;

export const EnvConfigResponseSchema = z.object({
  bindings: z.array(z.object({
    binding: z.object({
      id: z.string().min(1),
      envId: z.string().min(1),
      workspaceId: z.string().min(1),
      providerPkg: z.string().min(1),
      globalProviderProfileId: z.string().min(1),
      config: z.record(z.string(), z.unknown()).optional(),
      createdAt: z.string().min(1),
      updatedAt: z.string().min(1),
    }),
    profile: z.object({
      id: z.string().min(1),
      ownerWorkosOrgId: z.string().min(1),
      providerPkg: z.string().min(1),
      profileName: z.string().min(1),
      config: z.record(z.string(), z.unknown()),
      createdAt: z.string().min(1),
      updatedAt: z.string().min(1),
    }).nullable(),
  })),
  variables: z.array(z.object({
    id: z.string().min(1),
    envId: z.string().min(1),
    key: z.string().min(1),
    value: z.string().optional(),
    sensitive: z.boolean(),
    createdAt: z.string().min(1),
    updatedAt: z.string().min(1),
  })),
});
export type EnvConfigResponse = z.infer<typeof EnvConfigResponseSchema>;

export {
  DraftValidateResponseSchema,
  ErrorResponseSchema,
  OrgNotesSchema,
  OrgVariableSchema,
  RunWaitResponseSchema,
  StackApplyResponseSchema,
  StackImportResponseSchema,
};
