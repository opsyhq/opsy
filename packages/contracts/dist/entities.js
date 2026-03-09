import { z } from "zod";
import { IsoTimestampSchema, JsonObjectSchema, NullableStringSchema, SlugSchema, UuidSchema } from "./common.js";
import { ApprovalStatusEnum, JobStatusEnum, JobTypeEnum, RunKindEnum, RunStatusEnum } from "./status.js";
export const BaseRecordSchema = z.object({
    id: UuidSchema,
    createdAt: IsoTimestampSchema,
    updatedAt: IsoTimestampSchema,
});
export const WorkspaceSchema = BaseRecordSchema.extend({
    slug: SlugSchema,
    name: z.string().min(1).max(128),
    ownerWorkosOrgId: z.string().min(1),
    notes: z.string().nullable().optional(),
});
export const StackSchema = BaseRecordSchema.extend({
    workspaceId: UuidSchema,
    slug: SlugSchema,
    headRevisionId: UuidSchema.nullable(),
    notes: z.string().nullable().optional(),
});
export const StackRevisionSchema = z.object({
    id: UuidSchema,
    stackId: UuidSchema,
    revisionNumber: z.number().int().positive(),
    spec: z.string(),
    specHash: z.string().regex(/^[a-f0-9]{64}$/),
    runId: UuidSchema.nullable().optional(),
    baseRevisionId: UuidSchema.nullable(),
    createdBy: NullableStringSchema.optional(),
    createdAt: IsoTimestampSchema,
});
export const StackDraftSchema = z.object({
    id: UuidSchema,
    stackId: UuidSchema,
    shortId: z.string(),
    name: z.string().nullable(),
    spec: z.string(),
    specHash: z.string().regex(/^[a-f0-9]{64}$/),
    baseRevisionId: UuidSchema.nullable(),
    createdBy: NullableStringSchema.optional(),
    createdAt: IsoTimestampSchema,
    updatedAt: IsoTimestampSchema,
});
export const EnvSchema = BaseRecordSchema.extend({
    workspaceId: UuidSchema,
    slug: SlugSchema,
});
export const ProviderProfileSchema = z.object({
    id: UuidSchema,
    ownerWorkosOrgId: z.string().min(1),
    providerPkg: z.string().min(1).max(64),
    profileName: z.string().min(1).max(128),
    config: JsonObjectSchema,
    createdAt: IsoTimestampSchema,
    updatedAt: IsoTimestampSchema,
});
// Backward compatibility alias; provider profiles are org-scoped.
export const GlobalProviderProfileSchema = ProviderProfileSchema;
export const EnvProviderBindingSchema = z.object({
    id: UuidSchema,
    envId: UuidSchema,
    workspaceId: UuidSchema,
    providerPkg: z.string().min(1).max(64),
    globalProviderProfileId: UuidSchema,
    config: JsonObjectSchema.optional(),
    createdAt: IsoTimestampSchema,
    updatedAt: IsoTimestampSchema,
});
export const StackStateSchema = z.object({
    id: UuidSchema,
    stackId: UuidSchema,
    envId: UuidSchema,
    runId: UuidSchema,
    createdAt: IsoTimestampSchema,
    updatedAt: IsoTimestampSchema,
});
export const EnvVariableSchema = z.object({
    id: UuidSchema,
    envId: UuidSchema,
    key: z.string().min(1).max(128),
    value: z.string().optional(),
    sensitive: z.boolean(),
    createdAt: IsoTimestampSchema,
    updatedAt: IsoTimestampSchema,
});
export const ImportTargetSchema = z.object({
    type: z.string().min(1),
    name: z.string().min(1),
    id: z.string().min(1),
});
export const RunSchema = z.object({
    id: UuidSchema,
    workspaceId: UuidSchema,
    stackId: UuidSchema,
    envId: UuidSchema,
    revisionId: UuidSchema.nullable(),
    draftId: UuidSchema.nullable().optional(),
    importTargets: z.array(ImportTargetSchema).nullable().optional(),
    kind: RunKindEnum,
    status: RunStatusEnum,
    reason: NullableStringSchema.optional(),
    requestedBy: NullableStringSchema.optional(),
    queuedAt: IsoTimestampSchema,
    startedAt: IsoTimestampSchema.nullable(),
    finishedAt: IsoTimestampSchema.nullable(),
    error: NullableStringSchema.optional(),
    previewResult: z
        .object({
        changeSummary: z.record(z.string(), z.number()),
        stdout: z.string(),
    })
        .nullable()
        .optional(),
    applyResult: z
        .object({
        changeSummary: z.record(z.string(), z.number()),
        stdout: z.string(),
    })
        .nullable()
        .optional(),
});
export const ApprovalSchema = z.object({
    id: UuidSchema,
    runId: UuidSchema,
    status: ApprovalStatusEnum,
    policyMode: z.enum(["manual", "auto"]),
    requestedAt: IsoTimestampSchema,
    decidedAt: IsoTimestampSchema.nullable(),
    decidedBy: NullableStringSchema.optional(),
    decisionNote: NullableStringSchema.optional(),
});
export const JobSchema = z.object({
    id: UuidSchema,
    runId: UuidSchema,
    jobType: JobTypeEnum,
    status: JobStatusEnum,
    attempt: z.number().int().min(0),
    availableAt: IsoTimestampSchema,
    leasedAt: IsoTimestampSchema.nullable(),
    leaseOwner: NullableStringSchema.optional(),
    lastError: NullableStringSchema.optional(),
    createdAt: IsoTimestampSchema,
    updatedAt: IsoTimestampSchema,
});
export const StackOutputSnapshotSchema = z.object({
    id: UuidSchema,
    workspaceId: UuidSchema,
    stackId: UuidSchema,
    envId: UuidSchema,
    runId: UuidSchema,
    revisionId: UuidSchema,
    outputs: JsonObjectSchema,
    createdAt: IsoTimestampSchema,
});
export const OrgVariableSchema = z.object({
    id: UuidSchema,
    orgId: z.string(),
    key: z.string(),
    value: z.string().optional(),
    sensitive: z.boolean(),
    createdAt: IsoTimestampSchema,
    updatedAt: IsoTimestampSchema,
});
export const OrgNotesSchema = z.object({
    id: UuidSchema,
    orgId: z.string(),
    content: z.string(),
    createdAt: IsoTimestampSchema,
    updatedAt: IsoTimestampSchema,
});
export const AuditEventSchema = z.object({
    id: UuidSchema,
    workspaceId: UuidSchema.nullable(),
    actor: NullableStringSchema.optional(),
    actorType: z.enum(["user", "agent"]).nullable().optional(),
    authType: z.enum(["jwt", "pat"]).nullable().optional(),
    credentialId: NullableStringSchema.optional(),
    credentialLabel: NullableStringSchema.optional(),
    eventType: z.string().min(1).max(128),
    entityType: z.string().min(1).max(64),
    entityId: z.string().min(1).max(128),
    payload: JsonObjectSchema,
    createdAt: IsoTimestampSchema,
});
export const EntityIdsSchema = z.object({
    workspaceId: UuidSchema.optional(),
    stackId: UuidSchema.optional(),
    revisionId: UuidSchema.optional(),
    envId: UuidSchema.optional(),
    runId: UuidSchema.optional(),
    approvalId: UuidSchema.optional(),
    jobId: UuidSchema.optional(),
});
//# sourceMappingURL=entities.js.map