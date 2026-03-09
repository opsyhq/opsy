import { z } from "zod";
export declare const BaseRecordSchema: z.ZodObject<{
    id: z.ZodString;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, z.core.$strip>;
export declare const WorkspaceSchema: z.ZodObject<{
    id: z.ZodString;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
    slug: z.ZodString;
    name: z.ZodString;
    ownerWorkosOrgId: z.ZodString;
    notes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, z.core.$strip>;
export type Workspace = z.infer<typeof WorkspaceSchema>;
export declare const StackSchema: z.ZodObject<{
    id: z.ZodString;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
    workspaceId: z.ZodString;
    slug: z.ZodString;
    headRevisionId: z.ZodNullable<z.ZodString>;
    notes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, z.core.$strip>;
export type Stack = z.infer<typeof StackSchema>;
export declare const StackRevisionSchema: z.ZodObject<{
    id: z.ZodString;
    stackId: z.ZodString;
    revisionNumber: z.ZodNumber;
    spec: z.ZodString;
    specHash: z.ZodString;
    runId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    baseRevisionId: z.ZodNullable<z.ZodString>;
    createdBy: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    createdAt: z.ZodString;
}, z.core.$strip>;
export type StackRevision = z.infer<typeof StackRevisionSchema>;
export declare const StackDraftSchema: z.ZodObject<{
    id: z.ZodString;
    stackId: z.ZodString;
    shortId: z.ZodString;
    name: z.ZodNullable<z.ZodString>;
    spec: z.ZodString;
    specHash: z.ZodString;
    baseRevisionId: z.ZodNullable<z.ZodString>;
    createdBy: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, z.core.$strip>;
export type StackDraft = z.infer<typeof StackDraftSchema>;
export declare const EnvSchema: z.ZodObject<{
    id: z.ZodString;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
    workspaceId: z.ZodString;
    slug: z.ZodString;
}, z.core.$strip>;
export type Env = z.infer<typeof EnvSchema>;
export declare const ProviderProfileSchema: z.ZodObject<{
    id: z.ZodString;
    ownerWorkosOrgId: z.ZodString;
    providerPkg: z.ZodString;
    profileName: z.ZodString;
    config: z.ZodRecord<z.ZodString, z.ZodType<import("./common.js").JsonValue, unknown, z.core.$ZodTypeInternals<import("./common.js").JsonValue, unknown>>>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, z.core.$strip>;
export declare const GlobalProviderProfileSchema: z.ZodObject<{
    id: z.ZodString;
    ownerWorkosOrgId: z.ZodString;
    providerPkg: z.ZodString;
    profileName: z.ZodString;
    config: z.ZodRecord<z.ZodString, z.ZodType<import("./common.js").JsonValue, unknown, z.core.$ZodTypeInternals<import("./common.js").JsonValue, unknown>>>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, z.core.$strip>;
export type ProviderProfile = z.infer<typeof ProviderProfileSchema>;
export type GlobalProviderProfile = ProviderProfile;
export declare const EnvProviderBindingSchema: z.ZodObject<{
    id: z.ZodString;
    envId: z.ZodString;
    workspaceId: z.ZodString;
    providerPkg: z.ZodString;
    globalProviderProfileId: z.ZodString;
    config: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodType<import("./common.js").JsonValue, unknown, z.core.$ZodTypeInternals<import("./common.js").JsonValue, unknown>>>>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, z.core.$strip>;
export type EnvProviderBinding = z.infer<typeof EnvProviderBindingSchema>;
export declare const StackStateSchema: z.ZodObject<{
    id: z.ZodString;
    stackId: z.ZodString;
    envId: z.ZodString;
    runId: z.ZodString;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, z.core.$strip>;
export type StackState = z.infer<typeof StackStateSchema>;
export declare const EnvVariableSchema: z.ZodObject<{
    id: z.ZodString;
    envId: z.ZodString;
    key: z.ZodString;
    value: z.ZodOptional<z.ZodString>;
    sensitive: z.ZodBoolean;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, z.core.$strip>;
export type EnvVariable = z.infer<typeof EnvVariableSchema>;
export declare const ImportTargetSchema: z.ZodObject<{
    type: z.ZodString;
    name: z.ZodString;
    id: z.ZodString;
}, z.core.$strip>;
export type ImportTarget = z.infer<typeof ImportTargetSchema>;
export declare const RunSchema: z.ZodObject<{
    id: z.ZodString;
    workspaceId: z.ZodString;
    stackId: z.ZodString;
    envId: z.ZodString;
    revisionId: z.ZodNullable<z.ZodString>;
    draftId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    importTargets: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodObject<{
        type: z.ZodString;
        name: z.ZodString;
        id: z.ZodString;
    }, z.core.$strip>>>>;
    kind: z.ZodEnum<{
        preview: "preview";
        apply: "apply";
        import: "import";
    }>;
    status: z.ZodEnum<{
        queued: "queued";
        awaiting_approval: "awaiting_approval";
        running: "running";
        applied: "applied";
        failed: "failed";
        rejected: "rejected";
        canceled: "canceled";
    }>;
    reason: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    requestedBy: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    queuedAt: z.ZodString;
    startedAt: z.ZodNullable<z.ZodString>;
    finishedAt: z.ZodNullable<z.ZodString>;
    error: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    previewResult: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        changeSummary: z.ZodRecord<z.ZodString, z.ZodNumber>;
        stdout: z.ZodString;
    }, z.core.$strip>>>;
    applyResult: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        changeSummary: z.ZodRecord<z.ZodString, z.ZodNumber>;
        stdout: z.ZodString;
    }, z.core.$strip>>>;
}, z.core.$strip>;
export type Run = z.infer<typeof RunSchema>;
export declare const ApprovalSchema: z.ZodObject<{
    id: z.ZodString;
    runId: z.ZodString;
    status: z.ZodEnum<{
        rejected: "rejected";
        pending: "pending";
        approved: "approved";
    }>;
    policyMode: z.ZodEnum<{
        manual: "manual";
        auto: "auto";
    }>;
    requestedAt: z.ZodString;
    decidedAt: z.ZodNullable<z.ZodString>;
    decidedBy: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    decisionNote: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, z.core.$strip>;
export type Approval = z.infer<typeof ApprovalSchema>;
export declare const JobSchema: z.ZodObject<{
    id: z.ZodString;
    runId: z.ZodString;
    jobType: z.ZodEnum<{
        preview: "preview";
        apply: "apply";
        import: "import";
    }>;
    status: z.ZodEnum<{
        queued: "queued";
        running: "running";
        failed: "failed";
        leased: "leased";
        succeeded: "succeeded";
    }>;
    attempt: z.ZodNumber;
    availableAt: z.ZodString;
    leasedAt: z.ZodNullable<z.ZodString>;
    leaseOwner: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    lastError: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, z.core.$strip>;
export type Job = z.infer<typeof JobSchema>;
export declare const StackOutputSnapshotSchema: z.ZodObject<{
    id: z.ZodString;
    workspaceId: z.ZodString;
    stackId: z.ZodString;
    envId: z.ZodString;
    runId: z.ZodString;
    revisionId: z.ZodString;
    outputs: z.ZodRecord<z.ZodString, z.ZodType<import("./common.js").JsonValue, unknown, z.core.$ZodTypeInternals<import("./common.js").JsonValue, unknown>>>;
    createdAt: z.ZodString;
}, z.core.$strip>;
export type StackOutputSnapshot = z.infer<typeof StackOutputSnapshotSchema>;
export declare const OrgVariableSchema: z.ZodObject<{
    id: z.ZodString;
    orgId: z.ZodString;
    key: z.ZodString;
    value: z.ZodOptional<z.ZodString>;
    sensitive: z.ZodBoolean;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, z.core.$strip>;
export type OrgVariable = z.infer<typeof OrgVariableSchema>;
export declare const OrgNotesSchema: z.ZodObject<{
    id: z.ZodString;
    orgId: z.ZodString;
    content: z.ZodString;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, z.core.$strip>;
export type OrgNotes = z.infer<typeof OrgNotesSchema>;
export declare const AuditEventSchema: z.ZodObject<{
    id: z.ZodString;
    workspaceId: z.ZodNullable<z.ZodString>;
    actor: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    actorType: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
        user: "user";
        agent: "agent";
    }>>>;
    authType: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
        jwt: "jwt";
        pat: "pat";
    }>>>;
    credentialId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    credentialLabel: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    eventType: z.ZodString;
    entityType: z.ZodString;
    entityId: z.ZodString;
    payload: z.ZodRecord<z.ZodString, z.ZodType<import("./common.js").JsonValue, unknown, z.core.$ZodTypeInternals<import("./common.js").JsonValue, unknown>>>;
    createdAt: z.ZodString;
}, z.core.$strip>;
export type AuditEvent = z.infer<typeof AuditEventSchema>;
export declare const EntityIdsSchema: z.ZodObject<{
    workspaceId: z.ZodOptional<z.ZodString>;
    stackId: z.ZodOptional<z.ZodString>;
    revisionId: z.ZodOptional<z.ZodString>;
    envId: z.ZodOptional<z.ZodString>;
    runId: z.ZodOptional<z.ZodString>;
    approvalId: z.ZodOptional<z.ZodString>;
    jobId: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type EntityIds = z.infer<typeof EntityIdsSchema>;
//# sourceMappingURL=entities.d.ts.map