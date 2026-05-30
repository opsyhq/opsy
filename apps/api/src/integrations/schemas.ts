import { z } from "zod"

// Provider-agnostic shape: credentials and config are opaque jsonb,
// validated by the provider package (and ultimately the bridge) at plan/apply
// time. The api stores them verbatim. Same model as `change create --inputs`
// for resources — no provider-specific keys live in the api.

const opaqueRecord = z.record(z.string(), z.unknown())

const integrationSlug = z
	.string()
	.min(1)
	.max(64)
	.regex(/^[a-z0-9-]+$/, "slug must be lowercase letters, digits, and hyphens")

export const createIntegrationBody = z.object({
	provider: z.string().min(1).max(64),
	providerSource: z.string().min(1).max(128).optional(),
	providerVersion: z.string().min(1).max(64).optional(),
	// Project-unique identity, always caller-chosen.
	slug: integrationSlug,
	// Optional cosmetic label; the service layer defaults it to `slug`.
	name: z.string().min(1).max(64).optional(),
	// Mark this the default integration for its provider, demoting any
	// existing default. The first integration for a provider is the default
	// regardless of this flag.
	default: z.boolean().optional(),
	// Not defaulted — lets the service layer reject missing credentials for
	// providers that would otherwise silently fall back to ambient host creds.
	credentials: opaqueRecord.optional(),
	config: opaqueRecord.default({}),
})

export const updateIntegrationBody = z.object({
	name: z.string().min(1).max(64).optional(),
	// Promote this integration to its provider's default, demoting the
	// previous one. `false` is rejected by the service — you switch the
	// default by promoting another, never by leaving a provider with none.
	default: z.boolean().optional(),
	credentials: opaqueRecord.optional(),
	config: opaqueRecord.optional(),
})

export const checkIntegrationBody = createIntegrationBody
	.pick({
		provider: true,
		providerSource: true,
		providerVersion: true,
		credentials: true,
		config: true,
	})
	.extend({ config: opaqueRecord.default({}) })

export const checkExistingIntegrationBody = updateIntegrationBody.pick({
	credentials: true,
	config: true,
})

export type CreateIntegrationBody = z.infer<typeof createIntegrationBody>
export type UpdateIntegrationBody = z.infer<typeof updateIntegrationBody>
export type CheckIntegrationBody = z.infer<typeof checkIntegrationBody>
export type CheckExistingIntegrationBody = z.infer<
	typeof checkExistingIntegrationBody
>
