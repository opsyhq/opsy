import { z } from "zod"

// Catalog entry returned by `GET /providers`. The api re-renames the legacy
// `tfSource` column to `source` to match the contract — single field name
// across the api/web boundary.
export const providerListEntrySchema = z.object({
	name: z.string(),
	source: z.string(),
	// Nullable: a provider that hasn't been initialized in this runtime carries
	// no resolved version. The FE treats null as "unknown".
	version: z.string().nullable(),
	versions: z.array(z.string()),
	resourceCount: z.number().int().nonnegative(),
	dataSourceCount: z.number().int().nonnegative(),
})

export type ProviderListEntry = z.infer<typeof providerListEntrySchema>

export const providersListResponseSchema = z.object({
	providers: z.array(providerListEntrySchema),
})

export type ProvidersListResponse = z.infer<typeof providersListResponseSchema>
