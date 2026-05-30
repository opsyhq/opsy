// @generated — DO NOT EDIT. Run `make gen-wire`.
import { z } from "zod"
import type { SchemaBlock } from "./wire-lazy"
import { SchemaBlockSchema } from "./wire-lazy"

export type ProviderRef = {
	provider_source: string
	provider_version: string
	provider_config: unknown | null
}

export const ProviderRefSchema = z.object({
	provider_source: z.string(),
	provider_version: z.string(),
	provider_config: z.unknown().nullable(),
})

export type ProviderMetadataRequest = {
	provider_source: string
	provider_version: string
	provider_config: unknown | null
}

export const ProviderMetadataRequestSchema = z.object({
	provider_source: z.string(),
	provider_version: z.string(),
	provider_config: z.unknown().nullable(),
})

export type ProviderSummaryRequest = {
	provider_source: string
	provider_version: string
}

export const ProviderSummaryRequestSchema = z.object({
	provider_source: z.string(),
	provider_version: z.string(),
})

export type ProviderTypesSearchRequest = {
	provider_source: string
	provider_version: string
	q?: string
	kind?: string
	limit?: number
	offset?: number
}

export const ProviderTypesSearchRequestSchema = z.object({
	provider_source: z.string(),
	provider_version: z.string(),
	q: z.string().optional(),
	kind: z.string().optional(),
	limit: z.number().int().optional(),
	offset: z.number().int().optional(),
})

export type ProviderTypeResolveRequest = {
	provider_source: string
	provider_version: string
	type: string
}

export const ProviderTypeResolveRequestSchema = z.object({
	provider_source: z.string(),
	provider_version: z.string(),
	type: z.string(),
})

export type ProviderTypeSchemaRequest = {
	provider_source: string
	provider_version: string
	type: string
	kind: string
}

export const ProviderTypeSchemaRequestSchema = z.object({
	provider_source: z.string(),
	provider_version: z.string(),
	type: z.string(),
	kind: z.string(),
})

export type ProviderConfigSchemaRequest = {
	provider_source: string
	provider_version: string
}

export const ProviderConfigSchemaRequestSchema = z.object({
	provider_source: z.string(),
	provider_version: z.string(),
})

export type ProviderTypeIdentityRequest = {
	provider_source: string
	provider_version: string
	type: string
}

export const ProviderTypeIdentityRequestSchema = z.object({
	provider_source: z.string(),
	provider_version: z.string(),
	type: z.string(),
})

export type ProviderValidateRequest = {
	provider_source: string
	provider_version: string
	provider_config: unknown | null
}

export const ProviderValidateRequestSchema = z.object({
	provider_source: z.string(),
	provider_version: z.string(),
	provider_config: z.unknown().nullable(),
})

export type ResourceValidateRequest = {
	provider_source: string
	provider_version: string
	provider_config: unknown | null
	type: string
	config: unknown | null
}

export const ResourceValidateRequestSchema = z.object({
	provider_source: z.string(),
	provider_version: z.string(),
	provider_config: z.unknown().nullable(),
	type: z.string(),
	config: z.unknown().nullable(),
})

export type ResourceReadRequest = {
	provider_source: string
	provider_version: string
	provider_config: unknown | null
	type: string
	current_state: unknown | null
	private: string | null
}

export const ResourceReadRequestSchema = z.object({
	provider_source: z.string(),
	provider_version: z.string(),
	provider_config: z.unknown().nullable(),
	type: z.string(),
	current_state: z.unknown().nullable(),
	private: z.string().nullable(),
})

export type ResourcePlanRequest = {
	provider_source: string
	provider_version: string
	provider_config: unknown | null
	type: string
	prior_state: unknown | null
	proposed_new_state: unknown | null
	config: unknown | null
	prior_private: string | null
}

export const ResourcePlanRequestSchema = z.object({
	provider_source: z.string(),
	provider_version: z.string(),
	provider_config: z.unknown().nullable(),
	type: z.string(),
	prior_state: z.unknown().nullable(),
	proposed_new_state: z.unknown().nullable(),
	config: z.unknown().nullable(),
	prior_private: z.string().nullable(),
})

export type ResourceApplyRequest = {
	provider_source: string
	provider_version: string
	provider_config: unknown | null
	type: string
	prior_state: unknown | null
	planned_state: unknown | null
	config: unknown | null
	planned_private: string | null
	requires_replace?: string[][]
}

export const ResourceApplyRequestSchema = z.object({
	provider_source: z.string(),
	provider_version: z.string(),
	provider_config: z.unknown().nullable(),
	type: z.string(),
	prior_state: z.unknown().nullable(),
	planned_state: z.unknown().nullable(),
	config: z.unknown().nullable(),
	planned_private: z.string().nullable(),
	requires_replace: z.array(z.array(z.string())).optional(),
})

export type ResourceImportRequest = {
	provider_source: string
	provider_version: string
	provider_config: unknown | null
	type: string
	provider_id?: string
	identity?: Record<string, string>
}

export const ResourceImportRequestSchema = z.object({
	provider_source: z.string(),
	provider_version: z.string(),
	provider_config: z.unknown().nullable(),
	type: z.string(),
	provider_id: z.string().optional(),
	identity: z.record(z.string(), z.string()).optional(),
})

export type DataSourceReadRequest = {
	provider_source: string
	provider_version: string
	provider_config: unknown | null
	type: string
	config: unknown | null
}

export const DataSourceReadRequestSchema = z.object({
	provider_source: z.string(),
	provider_version: z.string(),
	provider_config: z.unknown().nullable(),
	type: z.string(),
	config: z.unknown().nullable(),
})

export type Diagnostic = {
	severity: string
	summary: string
	detail?: string
	attribute?: string[]
}

export const DiagnosticSchema = z.object({
	severity: z.string(),
	summary: z.string(),
	detail: z.string().optional(),
	attribute: z.array(z.string()).optional(),
})

export type ErrorResponse = {
	error: string
	detail?: string
	available_versions?: string[]
}

export const ErrorResponseSchema = z.object({
	error: z.string(),
	detail: z.string().optional(),
	available_versions: z.array(z.string()).optional(),
})

export type ProviderServerCapabilities = {
	plan_destroy: boolean
	get_provider_schema_optional: boolean
	move_resource_state: boolean
}

export const ProviderServerCapabilitiesSchema = z.object({
	plan_destroy: z.boolean(),
	get_provider_schema_optional: z.boolean(),
	move_resource_state: z.boolean(),
})

export type ProviderMetadataResponse = {
	server_capabilities: ProviderServerCapabilities
	diagnostics?: Diagnostic[]
}

export const ProviderMetadataResponseSchema = z.object({
	server_capabilities: ProviderServerCapabilitiesSchema,
	diagnostics: z.array(DiagnosticSchema).optional(),
})

// TODO: codegen - depended on by SchemaBlock/SchemaNestedBlock — kept in wire-lazy.ts to avoid circular imports
// SchemaAttributeSchema and SchemaAttribute are hand-written in wire-lazy.ts

// TODO: codegen - mutually recursive with SchemaNestedBlock — requires z.lazy()
// SchemaBlockSchema and SchemaBlock are hand-written in wire-lazy.ts

// TODO: codegen - mutually recursive with SchemaBlock — requires z.lazy()
// SchemaNestedBlockSchema and SchemaNestedBlock are hand-written in wire-lazy.ts

export type ResourceSchema = {
	version: number
	block?: SchemaBlock
}

export const ResourceSchemaSchema = z.object({
	version: z.number().int(),
	block: SchemaBlockSchema.optional(),
})

export type ProviderSummaryResponse = {
	provider_source: string
	provider_version: string
	resource_count: number
	data_source_count: number
	server_capabilities: ProviderServerCapabilities
	diagnostics?: Diagnostic[]
}

export const ProviderSummaryResponseSchema = z.object({
	provider_source: z.string(),
	provider_version: z.string(),
	resource_count: z.number().int(),
	data_source_count: z.number().int(),
	server_capabilities: ProviderServerCapabilitiesSchema,
	diagnostics: z.array(DiagnosticSchema).optional(),
})

export type ProviderTypeSearchHit = {
	type: string
	kinds: string[]
}

export const ProviderTypeSearchHitSchema = z.object({
	type: z.string(),
	kinds: z.array(z.string()),
})

export type ProviderTypesSearchResponse = {
	results: ProviderTypeSearchHit[]
	truncated: boolean
}

export const ProviderTypesSearchResponseSchema = z.object({
	results: z.array(ProviderTypeSearchHitSchema),
	truncated: z.boolean(),
})

export type ProviderTypeResolveResponse = {
	type: string
	kinds: string[]
	resource_path?: string
	data_source_path?: string
}

export const ProviderTypeResolveResponseSchema = z.object({
	type: z.string(),
	kinds: z.array(z.string()),
	resource_path: z.string().optional(),
	data_source_path: z.string().optional(),
})

export type ProviderTypeSchemaResponse = {
	type: string
	kind: string
	schema?: ResourceSchema
}

export const ProviderTypeSchemaResponseSchema = z.object({
	type: z.string(),
	kind: z.string(),
	schema: ResourceSchemaSchema.optional(),
})

export type ProviderConfigSchemaResponse = {
	schema?: ResourceSchema
	diagnostics?: Diagnostic[]
}

export const ProviderConfigSchemaResponseSchema = z.object({
	schema: ResourceSchemaSchema.optional(),
	diagnostics: z.array(DiagnosticSchema).optional(),
})

export type IdentityAttribute = {
	name: string
	type?: unknown
	required_for_import?: boolean
	optional_for_import?: boolean
	description?: string
}

export const IdentityAttributeSchema = z.object({
	name: z.string(),
	type: z.unknown().optional(),
	required_for_import: z.boolean().optional(),
	optional_for_import: z.boolean().optional(),
	description: z.string().optional(),
})

export type ResourceIdentitySchema = {
	version: number
	attributes: IdentityAttribute[]
}

export const ResourceIdentitySchemaSchema = z.object({
	version: z.number().int(),
	attributes: z.array(IdentityAttributeSchema),
})

export type ProviderTypeIdentityResponse = {
	type: string
	identity?: ResourceIdentitySchema
	diagnostics?: Diagnostic[]
}

export const ProviderTypeIdentityResponseSchema = z.object({
	type: z.string(),
	identity: ResourceIdentitySchemaSchema.optional(),
	diagnostics: z.array(DiagnosticSchema).optional(),
})

export type ValidateResponse = {
	diagnostics?: Diagnostic[]
}

export const ValidateResponseSchema = z.object({
	diagnostics: z.array(DiagnosticSchema).optional(),
})

export type ResourceReadResponse = {
	new_state: unknown | null
	private?: string
	diagnostics?: Diagnostic[]
}

export const ResourceReadResponseSchema = z.object({
	new_state: z.unknown().nullable(),
	private: z.string().optional(),
	diagnostics: z.array(DiagnosticSchema).optional(),
})

export type ResourcePlanResponse = {
	planned_state: unknown | null
	planned_private?: string
	requires_replace?: string[][]
	diagnostics?: Diagnostic[]
}

export const ResourcePlanResponseSchema = z.object({
	planned_state: z.unknown().nullable(),
	planned_private: z.string().optional(),
	requires_replace: z.array(z.array(z.string())).optional(),
	diagnostics: z.array(DiagnosticSchema).optional(),
})

export type ResourceApplyResponse = {
	new_state: unknown | null
	private?: string
	diagnostics?: Diagnostic[]
}

export const ResourceApplyResponseSchema = z.object({
	new_state: z.unknown().nullable(),
	private: z.string().optional(),
	diagnostics: z.array(DiagnosticSchema).optional(),
})

export type ImportedResource = {
	type_name: string
	state: unknown | null
	private?: string
}

export const ImportedResourceSchema = z.object({
	type_name: z.string(),
	state: z.unknown().nullable(),
	private: z.string().optional(),
})

export type ResourceImportResponse = {
	imported_resources: ImportedResource[]
	diagnostics?: Diagnostic[]
}

export const ResourceImportResponseSchema = z.object({
	imported_resources: z.array(ImportedResourceSchema),
	diagnostics: z.array(DiagnosticSchema).optional(),
})

export type DataSourceReadResponse = {
	state: unknown | null
	diagnostics?: Diagnostic[]
}

export const DataSourceReadResponseSchema = z.object({
	state: z.unknown().nullable(),
	diagnostics: z.array(DiagnosticSchema).optional(),
})
