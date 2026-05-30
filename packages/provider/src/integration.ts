import type { Diagnostic } from "@opsy/bridge-client"
import type { z } from "zod"

/**
 * Local provider-side Integration shape. Intentionally simple and decoupled
 * from the apps/api Drizzle schema. The API translates its Integration row into
 * this shape when calling provider methods.
 */
export interface Integration {
	/** Provider name, e.g. "aws", "cloudflare". */
	provider: string
	/** Provider-specific credentials. e.g. { access_key, secret_key, region }. */
	credentials: Record<string, unknown>
	/** Non-secret provider configuration. e.g. { region, default_tags }. */
	config: Record<string, unknown>
	/** Pinned TF provider version. If unset, the provider's default is used. */
	providerVersion?: string
}

export type IntegrationCheckStatus = "valid" | "invalid" | "unknown"
export type IntegrationCheckDiagnostic = Diagnostic

export interface IntegrationCheckResult {
	status: IntegrationCheckStatus
	checkedAt: string
	diagnostics: IntegrationCheckDiagnostic[]
}

// Fields that are auto-minted on create for a specific discriminator value.
// AWS uses this for the `external_id` UUID under the `assume_role` mode — the
// FE shouldn't ask the user for it; the trust-policy card displays it back.
export type GeneratedIntegrationField = { kind: "uuid" }

export interface ProviderCredentialFormDefinition {
	preferredMode?: string
	createHiddenFieldsByMode?: Record<string, string[]>
	createGeneratedFieldsByMode?: Record<
		string,
		Record<string, GeneratedIntegrationField>
	>
}

// Onboarding metadata for the "assume role trust policy" pattern: the
// customer creates an IAM role with a trust policy that Opsy's principal can
// assume, and pastes the ARN back. The card fires whenever the credentials
// carry an `assume_role` block (kind-specific contract), regardless of which
// base source the integration uses.
export type ProviderIntegrationOnboardingDefinition = {
	kind: "assume_role_trust_policy"
	// Field name inside `credentials.assume_role` that holds the customer-
	// provided external id. Surfaced for trust-policy display.
	externalIdField: string
	principalEnv: string
	title: string
	description: string
	externalIdLabel: string
	principalLabel: string
	documentLabel: string
	unavailableMessage: string
	documentFor: (input: { principalArn: string; externalId: string }) => string
	// One-click stack creation. The static template lives in the public assets
	// bucket; the API turns this + env into a console launch URL. Trust is
	// rebuilt inside the template from the ExternalId/OpsyPrincipalArn stack
	// params (same shape `documentFor` emits) so there is no second hand-edited
	// copy of the trust policy to drift against.
	cloudformation?: {
		templateAssetKey: string
		stackName: string
		// Single source of truth for the deploy role's provisioning power.
		// Passed to the template as a stack parameter, not duplicated in YAML.
		permissionsPolicyArn: string
	}
}

export type ProviderIntegrationOnboardingMetadata = Omit<
	ProviderIntegrationOnboardingDefinition,
	"documentFor" | "principalEnv" | "cloudformation"
>

export interface ProviderIntegrationDefinition {
	name: string
	source: string
	credentialsSchema?: z.ZodType
	configSchema?: z.ZodType
	credentialDiscriminator?: string
	credentialForm?: ProviderCredentialFormDefinition
	providerConfigFor?: (integration: Integration) => Record<string, unknown>
	// Pure projection of credentials → a stable string label (e.g. "static",
	// "static+role", "assume_role"). Stored in the integrations.credential_mode
	// column at create/update so callers can filter and the UI can badge
	// without re-parsing the credentials payload.
	summarizeCredentialMode?: (credentials: Record<string, unknown>) => string
	onboarding?: ProviderIntegrationOnboardingDefinition
}
