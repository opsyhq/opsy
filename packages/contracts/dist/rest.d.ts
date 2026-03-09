import { z } from "zod";
export declare const SetEnvConfigSchema: z.ZodObject<{
    providerProfileBindings: z.ZodOptional<z.ZodArray<z.ZodObject<{
        providerPkg: z.ZodString;
        profileName: z.ZodString;
        config: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    }, z.core.$strip>>>;
    variables: z.ZodOptional<z.ZodArray<z.ZodObject<{
        key: z.ZodString;
        value: z.ZodString;
        sensitive: z.ZodDefault<z.ZodBoolean>;
    }, z.core.$strip>>>;
}, z.core.$strip>;
export type SetEnvConfig = z.infer<typeof SetEnvConfigSchema>;
export declare const CreateWorkspaceRequestSchema: z.ZodObject<{
    slug: z.ZodString;
    name: z.ZodString;
    envs: z.ZodOptional<z.ZodArray<z.ZodObject<{
        slug: z.ZodString;
        config: z.ZodOptional<z.ZodObject<{
            providerProfileBindings: z.ZodOptional<z.ZodArray<z.ZodObject<{
                providerPkg: z.ZodString;
                profileName: z.ZodString;
                config: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
            }, z.core.$strip>>>;
            variables: z.ZodOptional<z.ZodArray<z.ZodObject<{
                key: z.ZodString;
                value: z.ZodString;
                sensitive: z.ZodDefault<z.ZodBoolean>;
            }, z.core.$strip>>>;
        }, z.core.$strip>>;
    }, z.core.$strip>>>;
}, z.core.$strip>;
export type CreateWorkspaceRequest = z.infer<typeof CreateWorkspaceRequestSchema>;
export declare const UpdateWorkspaceRequestSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    notes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, z.core.$strip>;
export type UpdateWorkspaceRequest = z.infer<typeof UpdateWorkspaceRequestSchema>;
export declare const CreateStackRequestSchema: z.ZodObject<{
    slug: z.ZodString;
    yaml: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type CreateStackRequest = z.infer<typeof CreateStackRequestSchema>;
export declare const CreateEnvRequestSchema: z.ZodObject<{
    slug: z.ZodString;
}, z.core.$strip>;
export type CreateEnvRequest = z.infer<typeof CreateEnvRequestSchema>;
export declare const BindProviderRequestSchema: z.ZodObject<{
    providerPkg: z.ZodString;
    profileName: z.ZodString;
}, z.core.$strip>;
export type BindProviderRequest = z.infer<typeof BindProviderRequestSchema>;
export declare const CreateGlobalProviderProfileRequestSchema: z.ZodObject<{
    providerPkg: z.ZodString;
    profileName: z.ZodString;
    config: z.ZodRecord<z.ZodString, z.ZodUnknown>;
}, z.core.$strip>;
export type CreateGlobalProviderProfileRequest = z.infer<typeof CreateGlobalProviderProfileRequestSchema>;
export declare const UpdateGlobalProviderProfileRequestSchema: z.ZodObject<{
    config: z.ZodRecord<z.ZodString, z.ZodUnknown>;
}, z.core.$strip>;
export type UpdateGlobalProviderProfileRequest = z.infer<typeof UpdateGlobalProviderProfileRequestSchema>;
export interface ProviderSchemaVariable {
    type?: "string" | "boolean" | "integer" | "array" | "object";
    secret?: boolean;
    description?: string;
    isRef?: boolean;
    defaultEnvVars?: string[];
}
export interface ProviderConfigSchema {
    variables: Record<string, ProviderSchemaVariable>;
}
export declare const TestProviderResultSchema: z.ZodObject<{
    ok: z.ZodBoolean;
    identity: z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    error: z.ZodNullable<z.ZodString>;
    testedAt: z.ZodString;
}, z.core.$strip>;
export type TestProviderResult = z.infer<typeof TestProviderResultSchema>;
export declare const DraftEditRequestSchema: z.ZodObject<{
    oldString: z.ZodString;
    newString: z.ZodString;
}, z.core.$strip>;
export type DraftEditRequest = z.infer<typeof DraftEditRequestSchema>;
export declare const DraftMutationResponseSchema: z.ZodObject<{
    draftId: z.ZodString;
    shortId: z.ZodString;
    warnings: z.ZodArray<z.ZodString>;
}, z.core.$strip>;
export type DraftMutationResponse = z.infer<typeof DraftMutationResponseSchema>;
export declare const DraftValidateResponseSchema: z.ZodObject<{
    ok: z.ZodBoolean;
    warnings: z.ZodArray<z.ZodString>;
}, z.core.$strip>;
export type DraftValidateResponse = z.infer<typeof DraftValidateResponseSchema>;
export declare const RunWaitQuerySchema: z.ZodObject<{
    timeoutSeconds: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
}, z.core.$strip>;
export type RunWaitQuery = z.infer<typeof RunWaitQuerySchema>;
export declare const RestRunSchema: z.ZodObject<{
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
    shortId: z.ZodString;
}, z.core.$strip>;
export type RestRun = z.infer<typeof RestRunSchema>;
export declare const RunWaitResponseSchema: z.ZodObject<{
    status: z.ZodEnum<{
        already_terminal: "already_terminal";
        timeout: "timeout";
        completed: "completed";
    }>;
    runId: z.ZodString;
    run: z.ZodNullable<z.ZodObject<{
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
        shortId: z.ZodString;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type RunWaitResponse = z.infer<typeof RunWaitResponseSchema>;
export declare const StackImportRequestSchema: z.ZodObject<{
    envSlug: z.ZodString;
    targets: z.ZodArray<z.ZodObject<{
        type: z.ZodString;
        name: z.ZodString;
        id: z.ZodString;
    }, z.core.$strip>>;
    reason: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type StackImportRequest = z.infer<typeof StackImportRequestSchema>;
export declare const ChangeSummarySchema: z.ZodRecord<z.ZodString, z.ZodNumber>;
export declare const RunChangeSummarySchema: z.ZodObject<{
    changeSummary: z.ZodRecord<z.ZodString, z.ZodNumber>;
}, z.core.$strip>;
export type RunChangeSummary = z.infer<typeof RunChangeSummarySchema>;
export declare const StackImportResponseSchema: z.ZodObject<{
    status: z.ZodEnum<{
        timeout: "timeout";
        completed: "completed";
    }>;
    workspaceId: z.ZodString;
    stackId: z.ZodString;
    envId: z.ZodString;
    runId: z.ZodString;
    jobId: z.ZodString;
    importedCount: z.ZodNumber;
    run: z.ZodObject<{
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
        shortId: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>;
export type StackImportResponse = z.infer<typeof StackImportResponseSchema>;
export declare const StackApplyRequestSchema: z.ZodObject<{
    envSlug: z.ZodString;
    draftShortId: z.ZodOptional<z.ZodString>;
    revisionNumber: z.ZodOptional<z.ZodNumber>;
    previewOnly: z.ZodOptional<z.ZodBoolean>;
    reason: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type StackApplyRequest = z.infer<typeof StackApplyRequestSchema>;
export declare const StackApplyResponseSchema: z.ZodObject<{
    status: z.ZodEnum<{
        timeout: "timeout";
        ready: "ready";
    }>;
    workspaceId: z.ZodString;
    stackId: z.ZodString;
    envId: z.ZodString;
    runId: z.ZodString;
    jobId: z.ZodString;
    run: z.ZodObject<{
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
        shortId: z.ZodString;
    }, z.core.$strip>;
    previewResult: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        changeSummary: z.ZodRecord<z.ZodString, z.ZodNumber>;
    }, z.core.$strip>>>;
}, z.core.$strip>;
export type StackApplyResponse = z.infer<typeof StackApplyResponseSchema>;
export interface ResourcePropertyDef {
    type?: string;
    description?: string;
    $ref?: string;
    items?: ResourcePropertyDef;
    additionalProperties?: ResourcePropertyDef;
    secret?: boolean;
    enum?: unknown[];
}
export interface ResourceTypeDef {
    type: string;
    description?: string;
    properties?: Record<string, ResourcePropertyDef>;
    required?: string[];
    additionalProperties?: ResourcePropertyDef;
    enum?: {
        name: string;
        value: unknown;
        description?: string;
    }[];
}
export interface ResourceSchema {
    description?: string;
    inputProperties: Record<string, ResourcePropertyDef>;
    outputProperties: Record<string, ResourcePropertyDef>;
    requiredInputs: string[];
    types: Record<string, ResourceTypeDef>;
}
//# sourceMappingURL=rest.d.ts.map