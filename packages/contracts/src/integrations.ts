import { z } from "zod"

// Public wire shape returned from the integrations api. Mirrors the DB row
// with `credentials` stripped (always) and three derived fields surfaced from
// the provider definition:
//   - `credentialDiscriminator`: provider-declared field that picks a
//     credential variant (e.g. AWS `"mode"`).
//   - `credentialsMode`: the value of that discriminator on the stored row,
//     surfaced so the FE can render the right credential branch in edit mode
//     without seeing the secret payload. Will be backed by a dedicated
//     `credential_mode` column in phase 3.
//   - `onboardingExternalId`: provider-declared onboarding identifier (e.g.
//     AWS assume-role external id). Not a secret — its purpose is to be
//     pasted into the customer's trust policy — so surfaced explicitly even
//     though the rest of the credentials blob is omitted.
export const integrationViewSchema = z.object({
	id: z.string().uuid(),
	projectId: z.string().uuid(),
	provider: z.string(),
	providerSource: z.string().nullable(),
	providerVersion: z.string().nullable(),
	slug: z.string(),
	name: z.string().nullable(),
	isDefault: z.boolean(),
	config: z.record(z.string(), z.unknown()),
	createdAt: z.date(),
	updatedAt: z.date(),
	deletedAt: z.date().nullable(),
	createdByType: z.string(),
	createdById: z.string().uuid(),
	credentialDiscriminator: z.string().nullable(),
	credentialsMode: z.string().nullable(),
	onboardingExternalId: z.string().nullable(),
})

export type IntegrationView = z.infer<typeof integrationViewSchema>
