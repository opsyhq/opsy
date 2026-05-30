import { describe, expect, test } from "bun:test"
import type { IntegrationRow } from "@/lib/db/schema"
import { getIntegrationView } from ".."

function makeRow(
	provider: string,
	providerSource: string,
	credentials: Record<string, unknown>,
	credentialMode = "",
): IntegrationRow {
	return {
		id: "11111111-1111-1111-1111-111111111111",
		projectId: "22222222-2222-2222-2222-222222222222",
		provider,
		slug: "default",
		name: "test",
		providerSource,
		providerVersion: "0.0.0",
		credentials,
		credentialMode,
		config: {},
		createdAt: new Date(),
		updatedAt: new Date(),
		deletedAt: null,
	} as IntegrationRow
}

describe("getIntegrationView", () => {
	test("strips credentials and projects credentialsMode from the stored column", () => {
		const row = makeRow(
			"aws",
			"hashicorp/aws",
			{
				source: "assume_role",
				role_arn: "arn:aws:iam::123456789012:role/x",
				external_id: "abcd-1234",
				session_name: "opsy",
			},
			"assume_role",
		)
		const view = getIntegrationView(row)
		expect("credentials" in view).toBe(false)
		expect(view.credentialDiscriminator).toBe("source")
		expect(view.credentialsMode).toBe("assume_role")
		expect(view.onboardingExternalId).toBe("abcd-1234")
	})

	test("returns null mode when the stored column is empty", () => {
		const row = makeRow("aws", "hashicorp/aws", {
			source: "static",
			access_key: "A".repeat(16),
			secret_key: "secret",
		})
		const view = getIntegrationView(row)
		expect(view.credentialsMode).toBeNull()
		expect(view.onboardingExternalId).toBeNull()
	})

	test("returns null discriminator + mode when provider has no discriminator", () => {
		const row = makeRow("rfake_nodisc", "fake/rfake_nodisc", {
			token: "secret",
		})
		const view = getIntegrationView(row)
		expect("credentials" in view).toBe(false)
		expect(view.credentialDiscriminator).toBeNull()
		expect(view.credentialsMode).toBeNull()
	})
})
