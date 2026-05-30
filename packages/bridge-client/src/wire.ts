import { z } from "zod"
import {
	DataSourceReadRequestSchema,
	DataSourceReadResponseSchema,
	DiagnosticSchema,
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
	ResourceImportRequestSchema,
	ResourceImportResponseSchema,
	ResourcePlanRequestSchema,
	ResourcePlanResponseSchema,
	ResourceReadRequestSchema,
	ResourceReadResponseSchema,
	ResourceValidateRequestSchema,
	ValidateResponseSchema,
} from "./wire.generated"

// Re-export everything from the generated wire file and the hand-written
// lazy schemas. Go structs in bridge/types/ are the source of truth; run
// `make gen-wire` to regenerate wire.generated.ts.
export * from "./wire.generated"
export * from "./wire-lazy"

// Op constants
export const BRIDGE_OPS = [
	"provider.metadata",
	"provider.summary",
	"provider.types.search",
	"provider.types.resolve",
	"provider.types.schema",
	"provider.types.identity",
	"provider.config-schema",
	"provider.validate",
	"resource.validate",
	"resource.read",
	"resource.plan",
	"resource.apply",
	"resource.import",
	"datasource.read",
] as const
export type BridgeOp = (typeof BRIDGE_OPS)[number]

// Op-tagged request union. Each variant is the payload schema extended with an
// `op` literal. The discriminator is a client-side tag; the HTTP transport
// strips it before POSTing.
export const BridgeRequestSchema = z.discriminatedUnion("op", [
	ProviderMetadataRequestSchema.extend({ op: z.literal("provider.metadata") }),
	ProviderSummaryRequestSchema.extend({ op: z.literal("provider.summary") }),
	ProviderTypesSearchRequestSchema.extend({
		op: z.literal("provider.types.search"),
	}),
	ProviderTypeResolveRequestSchema.extend({
		op: z.literal("provider.types.resolve"),
	}),
	ProviderTypeSchemaRequestSchema.extend({
		op: z.literal("provider.types.schema"),
	}),
	ProviderTypeIdentityRequestSchema.extend({
		op: z.literal("provider.types.identity"),
	}),
	ProviderConfigSchemaRequestSchema.extend({
		op: z.literal("provider.config-schema"),
	}),
	ProviderValidateRequestSchema.extend({ op: z.literal("provider.validate") }),
	ResourceValidateRequestSchema.extend({ op: z.literal("resource.validate") }),
	ResourceReadRequestSchema.extend({ op: z.literal("resource.read") }),
	ResourcePlanRequestSchema.extend({ op: z.literal("resource.plan") }),
	ResourceApplyRequestSchema.extend({ op: z.literal("resource.apply") }),
	ResourceImportRequestSchema.extend({ op: z.literal("resource.import") }),
	DataSourceReadRequestSchema.extend({ op: z.literal("datasource.read") }),
])
export type BridgeRequest = z.infer<typeof BridgeRequestSchema>

export const BridgeResponseSchema = z.discriminatedUnion("op", [
	ProviderMetadataResponseSchema.extend({ op: z.literal("provider.metadata") }),
	ProviderSummaryResponseSchema.extend({ op: z.literal("provider.summary") }),
	ProviderTypesSearchResponseSchema.extend({
		op: z.literal("provider.types.search"),
	}),
	ProviderTypeResolveResponseSchema.extend({
		op: z.literal("provider.types.resolve"),
	}),
	ProviderTypeSchemaResponseSchema.extend({
		op: z.literal("provider.types.schema"),
	}),
	ProviderTypeIdentityResponseSchema.extend({
		op: z.literal("provider.types.identity"),
	}),
	ProviderConfigSchemaResponseSchema.extend({
		op: z.literal("provider.config-schema"),
	}),
	ValidateResponseSchema.extend({ op: z.literal("provider.validate") }),
	ValidateResponseSchema.extend({ op: z.literal("resource.validate") }),
	ResourceReadResponseSchema.extend({ op: z.literal("resource.read") }),
	ResourcePlanResponseSchema.extend({ op: z.literal("resource.plan") }),
	ResourceApplyResponseSchema.extend({ op: z.literal("resource.apply") }),
	ResourceImportResponseSchema.extend({ op: z.literal("resource.import") }),
	DataSourceReadResponseSchema.extend({ op: z.literal("datasource.read") }),
])
export type BridgeResponse = z.infer<typeof BridgeResponseSchema>

export type RequestFor<Op extends BridgeOp> = Extract<BridgeRequest, { op: Op }>
export type ResponseFor<Op extends BridgeOp> = Extract<
	BridgeResponse,
	{ op: Op }
>

// Per-op payload lookups used by the HTTP transport (strips op, POSTs payload,
// parses response body, reattaches op tag).
export const REQUEST_PAYLOAD_SCHEMAS = {
	"provider.metadata": ProviderMetadataRequestSchema,
	"provider.summary": ProviderSummaryRequestSchema,
	"provider.types.search": ProviderTypesSearchRequestSchema,
	"provider.types.resolve": ProviderTypeResolveRequestSchema,
	"provider.types.schema": ProviderTypeSchemaRequestSchema,
	"provider.types.identity": ProviderTypeIdentityRequestSchema,
	"provider.config-schema": ProviderConfigSchemaRequestSchema,
	"provider.validate": ProviderValidateRequestSchema,
	"resource.validate": ResourceValidateRequestSchema,
	"resource.read": ResourceReadRequestSchema,
	"resource.plan": ResourcePlanRequestSchema,
	"resource.apply": ResourceApplyRequestSchema,
	"resource.import": ResourceImportRequestSchema,
	"datasource.read": DataSourceReadRequestSchema,
} as const

export const RESPONSE_PAYLOAD_SCHEMAS = {
	"provider.metadata": ProviderMetadataResponseSchema,
	"provider.summary": ProviderSummaryResponseSchema,
	"provider.types.search": ProviderTypesSearchResponseSchema,
	"provider.types.resolve": ProviderTypeResolveResponseSchema,
	"provider.types.schema": ProviderTypeSchemaResponseSchema,
	"provider.types.identity": ProviderTypeIdentityResponseSchema,
	"provider.config-schema": ProviderConfigSchemaResponseSchema,
	"provider.validate": ValidateResponseSchema,
	"resource.validate": ValidateResponseSchema,
	"resource.read": ResourceReadResponseSchema,
	"resource.plan": ResourcePlanResponseSchema,
	"resource.apply": ResourceApplyResponseSchema,
	"resource.import": ResourceImportResponseSchema,
	"datasource.read": DataSourceReadResponseSchema,
} as const

// HTTP path mapping for the default transport.
export const OP_TO_PATH: Record<BridgeOp, string> = {
	"provider.metadata": "/providers/metadata",
	"provider.summary": "/providers/summary",
	"provider.types.search": "/providers/types/search",
	"provider.types.resolve": "/providers/types/resolve",
	"provider.types.schema": "/providers/types/schema",
	"provider.types.identity": "/providers/types/identity",
	"provider.config-schema": "/providers/config-schema",
	"provider.validate": "/providers/validate-config",
	"resource.validate": "/resources/validate-config",
	"resource.read": "/resources/read",
	"resource.plan": "/resources/plan",
	"resource.apply": "/resources/apply",
	"resource.import": "/resources/import",
	"datasource.read": "/data-sources/read",
}

// Streaming events for long-running ops (apply with progress).
export const BridgeStreamEventSchema = z.discriminatedUnion("kind", [
	z.object({
		kind: z.literal("progress"),
		message: z.string(),
		timestamp: z.string(),
	}),
	z.object({
		kind: z.literal("diagnostic"),
		diagnostic: DiagnosticSchema,
	}),
	z.object({
		kind: z.literal("final"),
		response: BridgeResponseSchema,
	}),
])
export type BridgeStreamEvent = z.infer<typeof BridgeStreamEventSchema>
