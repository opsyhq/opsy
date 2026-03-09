import { z } from "zod";
import { SlugSchema } from "./common.js";
import { ImportTargetSchema, RunSchema } from "./entities.js";
export const SetEnvConfigSchema = z.object({
    providerProfileBindings: z
        .array(z.object({
        providerPkg: z.string().min(1).max(64),
        profileName: z.string().min(1).max(128),
        config: z.record(z.string(), z.string()).optional(),
    }))
        .optional(),
    variables: z.array(z.object({
        key: z.string().min(1),
        value: z.string(),
        sensitive: z.boolean().default(false),
    })).optional(),
});
export const CreateWorkspaceRequestSchema = z.object({
    slug: SlugSchema,
    name: z.string().min(1).max(128),
    envs: z.array(z.object({
        slug: SlugSchema,
        config: SetEnvConfigSchema.optional(),
    })).optional(),
});
export const UpdateWorkspaceRequestSchema = z.object({
    name: z.string().min(1).max(128).optional(),
    notes: z.string().nullable().optional(),
});
export const CreateStackRequestSchema = z.object({
    slug: SlugSchema,
    yaml: z.string().optional(),
});
export const CreateEnvRequestSchema = z.object({ slug: SlugSchema });
export const BindProviderRequestSchema = z.object({
    providerPkg: z.string().min(1).max(64),
    profileName: z.string().min(1).max(128),
});
export const CreateGlobalProviderProfileRequestSchema = z.object({
    providerPkg: z.string().min(1).max(64),
    profileName: z.string().min(1).max(128),
    config: z.record(z.string(), z.unknown()),
});
export const UpdateGlobalProviderProfileRequestSchema = z.object({
    config: z.record(z.string(), z.unknown()),
});
export const TestProviderResultSchema = z.object({
    ok: z.boolean(),
    identity: z.record(z.string(), z.unknown()).nullable(),
    error: z.string().nullable(),
    testedAt: z.string(),
});
// --- CLI-facing REST helper shapes ---
export const DraftEditRequestSchema = z.object({
    oldString: z.string().min(1),
    newString: z.string(),
});
export const DraftMutationResponseSchema = z.object({
    draftId: z.string().min(1),
    shortId: z.string().min(1),
    warnings: z.array(z.string()),
});
export const DraftValidateResponseSchema = z.object({
    ok: z.boolean(),
    warnings: z.array(z.string()),
});
export const RunWaitQuerySchema = z.object({
    timeoutSeconds: z.coerce.number().int().min(1).max(3600).optional(),
});
export const RestRunSchema = RunSchema.extend({
    shortId: z.string().min(1),
});
export const RunWaitResponseSchema = z.object({
    status: z.enum(["already_terminal", "timeout", "completed"]),
    runId: z.string().min(1),
    run: RestRunSchema.nullable(),
});
export const StackImportRequestSchema = z.object({
    envSlug: SlugSchema,
    targets: z.array(ImportTargetSchema).min(1).max(100),
    reason: z.string().min(1).max(2000).optional(),
});
export const ChangeSummarySchema = z.record(z.string(), z.number());
export const RunChangeSummarySchema = z.object({
    changeSummary: ChangeSummarySchema,
});
export const StackImportResponseSchema = z.object({
    status: z.enum(["timeout", "completed"]),
    workspaceId: z.string().min(1),
    stackId: z.string().min(1),
    envId: z.string().min(1),
    runId: z.string().min(1),
    jobId: z.string().min(1),
    importedCount: z.number().int().min(1),
    run: RestRunSchema,
});
export const StackApplyRequestSchema = z.object({
    envSlug: SlugSchema,
    draftShortId: z.string().min(1).optional(),
    revisionNumber: z.number().int().positive().optional(),
    previewOnly: z.boolean().optional(),
    reason: z.string().min(1).max(2000).optional(),
}).refine((data) => !(data.draftShortId && data.revisionNumber !== undefined), {
    message: 'Provide either "draftShortId" or "revisionNumber", not both.',
});
export const StackApplyResponseSchema = z.object({
    status: z.enum(["timeout", "ready"]),
    workspaceId: z.string().min(1),
    stackId: z.string().min(1),
    envId: z.string().min(1),
    runId: z.string().min(1),
    jobId: z.string().min(1),
    run: RestRunSchema,
    previewResult: RunChangeSummarySchema.nullable().optional(),
});
//# sourceMappingURL=rest.js.map