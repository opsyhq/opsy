import { z } from "zod";
import { SlugSchema } from "./common.js";
import { ImportTargetSchema, RunSchema } from "./entities.js";

export const SetEnvConfigSchema = z.object({
  providerProfileBindings: z
    .array(
      z.object({
        providerPkg: z.string().min(1).max(64),
        profileName: z.string().min(1).max(128),
        config: z.record(z.string(), z.string()).optional(),
      }),
    )
    .optional(),
  variables: z.array(z.object({
    key: z.string().min(1),
    value: z.string(),
    sensitive: z.boolean().default(false),
  })).optional(),
});

export type SetEnvConfig = z.infer<typeof SetEnvConfigSchema>;

export const CreateWorkspaceRequestSchema = z.object({
  slug: SlugSchema,
  name: z.string().min(1).max(128),
  envs: z.array(z.object({
    slug: SlugSchema,
    config: SetEnvConfigSchema.optional(),
  })).optional(),
});
export type CreateWorkspaceRequest = z.infer<typeof CreateWorkspaceRequestSchema>;

export const UpdateWorkspaceRequestSchema = z.object({
  name: z.string().min(1).max(128).optional(),
  notes: z.string().nullable().optional(),
});
export type UpdateWorkspaceRequest = z.infer<typeof UpdateWorkspaceRequestSchema>;

export const CreateStackRequestSchema = z.object({
  slug: SlugSchema,
  yaml: z.string().optional(),
});
export type CreateStackRequest = z.infer<typeof CreateStackRequestSchema>;

export const CreateEnvRequestSchema = z.object({ slug: SlugSchema });
export type CreateEnvRequest = z.infer<typeof CreateEnvRequestSchema>;

export const BindProviderRequestSchema = z.object({
  providerPkg: z.string().min(1).max(64),
  profileName: z.string().min(1).max(128),
});
export type BindProviderRequest = z.infer<typeof BindProviderRequestSchema>;

export const CreateGlobalProviderProfileRequestSchema = z.object({
  providerPkg: z.string().min(1).max(64),
  profileName: z.string().min(1).max(128),
  config: z.record(z.string(), z.unknown()),
});
export type CreateGlobalProviderProfileRequest = z.infer<typeof CreateGlobalProviderProfileRequestSchema>;

export const UpdateGlobalProviderProfileRequestSchema = z.object({
  config: z.record(z.string(), z.unknown()),
});
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

export const TestProviderResultSchema = z.object({
  ok: z.boolean(),
  identity: z.record(z.string(), z.unknown()).nullable(),
  error: z.string().nullable(),
  testedAt: z.string(),
});
export type TestProviderResult = z.infer<typeof TestProviderResultSchema>;

// --- CLI-facing REST helper shapes ---

export const DraftEditRequestSchema = z.object({
  oldString: z.string().min(1),
  newString: z.string(),
});
export type DraftEditRequest = z.infer<typeof DraftEditRequestSchema>;

export const DraftMutationResponseSchema = z.object({
  draftId: z.string().min(1),
  shortId: z.string().min(1),
  warnings: z.array(z.string()),
});
export type DraftMutationResponse = z.infer<typeof DraftMutationResponseSchema>;

export const DraftValidateResponseSchema = z.object({
  ok: z.boolean(),
  warnings: z.array(z.string()),
});
export type DraftValidateResponse = z.infer<typeof DraftValidateResponseSchema>;

export const RunWaitQuerySchema = z.object({
  timeoutSeconds: z.coerce.number().int().min(1).max(3600).optional(),
});
export type RunWaitQuery = z.infer<typeof RunWaitQuerySchema>;

export const RestRunSchema = RunSchema.extend({
  shortId: z.string().min(1),
});
export type RestRun = z.infer<typeof RestRunSchema>;

export const RunWaitResponseSchema = z.object({
  status: z.enum(["already_terminal", "timeout", "completed"]),
  runId: z.string().min(1),
  run: RestRunSchema.nullable(),
});
export type RunWaitResponse = z.infer<typeof RunWaitResponseSchema>;

export const StackImportRequestSchema = z.object({
  envSlug: SlugSchema,
  targets: z.array(ImportTargetSchema).min(1).max(100),
  reason: z.string().min(1).max(2000).optional(),
});
export type StackImportRequest = z.infer<typeof StackImportRequestSchema>;

export const ChangeSummarySchema = z.record(z.string(), z.number());
export const RunChangeSummarySchema = z.object({
  changeSummary: ChangeSummarySchema,
});
export type RunChangeSummary = z.infer<typeof RunChangeSummarySchema>;

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
export type StackImportResponse = z.infer<typeof StackImportResponseSchema>;

export const StackApplyRequestSchema = z.object({
  envSlug: SlugSchema,
  draftShortId: z.string().min(1).optional(),
  revisionNumber: z.number().int().positive().optional(),
  previewOnly: z.boolean().optional(),
  reason: z.string().min(1).max(2000).optional(),
}).refine((data) => !(data.draftShortId && data.revisionNumber !== undefined), {
  message: 'Provide either "draftShortId" or "revisionNumber", not both.',
});
export type StackApplyRequest = z.infer<typeof StackApplyRequestSchema>;

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
export type StackApplyResponse = z.infer<typeof StackApplyResponseSchema>;

// --- Resource schema types ---

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
  enum?: { name: string; value: unknown; description?: string }[];
}

export interface ResourceSchema {
  description?: string;
  inputProperties: Record<string, ResourcePropertyDef>;
  outputProperties: Record<string, ResourcePropertyDef>;
  requiredInputs: string[];
  types: Record<string, ResourceTypeDef>;
}
