// Public wire types. Shapes mirror bridge/types/request.go and
// bridge/types/response.go. These are z.infer aliases of the schemas in
// wire.ts — the schemas are the source of truth, but consumers that only need
// types (not runtime validation) can keep importing from this module.
import type { z } from "zod"
import type {
	DataSourceReadRequestSchema,
	DataSourceReadResponseSchema,
	DiagnosticSchema,
	IdentityAttributeSchema,
	ProviderConfigSchemaRequestSchema,
	ProviderConfigSchemaResponseSchema,
	ProviderMetadataRequestSchema,
	ProviderMetadataResponseSchema,
	ProviderSummaryRequestSchema,
	ProviderSummaryResponseSchema,
	ProviderTypeResolveRequestSchema,
	ProviderTypeResolveResponseSchema,
	ProviderTypeIdentityRequestSchema,
	ProviderTypeIdentityResponseSchema,
	ProviderTypeSchemaRequestSchema,
	ProviderTypeSchemaResponseSchema,
	ProviderTypesSearchRequestSchema,
	ProviderTypesSearchResponseSchema,
	ProviderValidateRequestSchema,
	ResourceApplyRequestSchema,
	ResourceApplyResponseSchema,
	ResourceIdentitySchemaSchema,
	ResourceImportRequestSchema,
	ResourceImportResponseSchema,
	ResourcePlanRequestSchema,
	ResourcePlanResponseSchema,
	ResourceReadRequestSchema,
	ResourceReadResponseSchema,
	ResourceSchemaSchema,
	ResourceValidateRequestSchema,
	SchemaAttributeSchema,
	SchemaBlockSchema,
	SchemaNestedBlockSchema,
	ValidateResponseSchema,
} from "./wire"

export type Diagnostic = z.infer<typeof DiagnosticSchema>
export type SchemaAttribute = z.infer<typeof SchemaAttributeSchema>
export type SchemaBlock = z.infer<typeof SchemaBlockSchema>
export type SchemaNestedBlock = z.infer<typeof SchemaNestedBlockSchema>
export type ResourceSchema = z.infer<typeof ResourceSchemaSchema>
export type IdentityAttribute = z.infer<typeof IdentityAttributeSchema>
export type ResourceIdentitySchema = z.infer<
	typeof ResourceIdentitySchemaSchema
>

export type ProviderMetadataRequest = z.infer<
	typeof ProviderMetadataRequestSchema
>
export type ProviderSummaryRequest = z.infer<
	typeof ProviderSummaryRequestSchema
>
export type ProviderTypesSearchRequest = z.infer<
	typeof ProviderTypesSearchRequestSchema
>
export type ProviderTypeResolveRequest = z.infer<
	typeof ProviderTypeResolveRequestSchema
>
export type ProviderTypeSchemaRequest = z.infer<
	typeof ProviderTypeSchemaRequestSchema
>
export type ProviderTypeIdentityRequest = z.infer<
	typeof ProviderTypeIdentityRequestSchema
>
export type ProviderConfigSchemaRequest = z.infer<
	typeof ProviderConfigSchemaRequestSchema
>
export type ProviderValidateRequest = z.infer<
	typeof ProviderValidateRequestSchema
>
export type ResourceValidateRequest = z.infer<
	typeof ResourceValidateRequestSchema
>
export type ResourceReadRequest = z.infer<typeof ResourceReadRequestSchema>
export type ResourcePlanRequest = z.infer<typeof ResourcePlanRequestSchema>
export type ResourceApplyRequest = z.infer<typeof ResourceApplyRequestSchema>
export type ResourceImportRequest = z.infer<typeof ResourceImportRequestSchema>
export type DataSourceReadRequest = z.infer<typeof DataSourceReadRequestSchema>

export type ProviderMetadataResponse = z.infer<
	typeof ProviderMetadataResponseSchema
>
export type ProviderSummaryResponse = z.infer<
	typeof ProviderSummaryResponseSchema
>
export type ProviderTypesSearchResponse = z.infer<
	typeof ProviderTypesSearchResponseSchema
>
export type ProviderTypeResolveResponse = z.infer<
	typeof ProviderTypeResolveResponseSchema
>
export type ProviderTypeSchemaResponse = z.infer<
	typeof ProviderTypeSchemaResponseSchema
>
export type ProviderTypeIdentityResponse = z.infer<
	typeof ProviderTypeIdentityResponseSchema
>
export type ProviderConfigSchemaResponse = z.infer<
	typeof ProviderConfigSchemaResponseSchema
>
export type ValidateResponse = z.infer<typeof ValidateResponseSchema>
export type ResourceReadResponse = z.infer<typeof ResourceReadResponseSchema>
export type ResourcePlanResponse = z.infer<typeof ResourcePlanResponseSchema>
export type ResourceApplyResponse = z.infer<typeof ResourceApplyResponseSchema>
export type ResourceImportResponse = z.infer<
	typeof ResourceImportResponseSchema
>
export type DataSourceReadResponse = z.infer<
	typeof DataSourceReadResponseSchema
>
