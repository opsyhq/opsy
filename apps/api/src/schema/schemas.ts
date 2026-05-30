import { z } from "zod"

const kindFilter = z.enum(["resource", "data", "both"])
const kindSelect = z.enum(["resource", "data"])
const formatOption = z.enum(["compact", "detailed"]).default("compact")
const providerRefQuery = {
	providerSource: z.string().trim().min(1).optional(),
	providerVersion: z.string().trim().min(1).optional(),
}

export const searchTypesQuery = z.object({
	q: z.string().trim().min(1).optional(),
	provider: z.string().trim().min(1).optional(),
	...providerRefQuery,
	kind: kindFilter.optional().default("both"),
	limit: z.coerce.number().int().min(1).max(100).optional().default(20),
	offset: z.coerce.number().int().min(0).optional().default(0),
})

export const getTypeSchemaQuery = z.object({
	kind: kindSelect.optional(),
	...providerRefQuery,
	format: formatOption,
})

export const getTypeArtifactsQuery = z.object({
	kind: kindSelect.default("resource"),
})

export const getProviderDetailQuery = z.object({
	...providerRefQuery,
	format: formatOption,
})

export const getIntegrationSchemaQuery = z.object({
	...providerRefQuery,
})

export const getProviderOnboardingQuery = z.object({
	...providerRefQuery,
	external_id: z.uuid(),
})

export type SearchTypesQuery = z.infer<typeof searchTypesQuery>
export type GetTypeSchemaQuery = z.infer<typeof getTypeSchemaQuery>
export type GetTypeArtifactsQuery = z.infer<typeof getTypeArtifactsQuery>
export type GetProviderDetailQuery = z.infer<typeof getProviderDetailQuery>
export type GetIntegrationSchemaQuery = z.infer<
	typeof getIntegrationSchemaQuery
>
export type GetProviderOnboardingQuery = z.infer<
	typeof getProviderOnboardingQuery
>
