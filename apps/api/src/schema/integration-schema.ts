import {
	SchemaTypeIdentityUnknown,
	SchemaUnknownProvider,
} from "@opsy/contracts/errors"
import type {
	ProviderCredentialFormDefinition,
	ProviderIntegrationOnboardingDefinition,
	ProviderIntegrationOnboardingMetadata,
	ResourceIdentitySchema,
} from "@opsy/provider"
import { getWidget } from "@opsy/provider"
import { z } from "zod"
import { env } from "../lib/env"
import { requireSchemaProvider } from "./provider-catalog"
import type {
	GetIntegrationSchemaQuery,
	GetProviderOnboardingQuery,
} from "./schemas"

export type TypeIdentityResponse = { provider: string; type: string } & (
	| {
			/**
			 * The provider advertises a structured import identity: callers
			 * supply each attribute by name rather than a single opaque string.
			 */
			mode: "identity"
			identity: ResourceIdentitySchema
	  }
	| {
			/**
			 * The resource exists but has no structured identity, so callers
			 * pass the raw Terraform import ID (the value `terraform import`
			 * would take).
			 */
			mode: "import-id"
	  }
)

interface IntegrationSchemaResponse {
	provider: string
	providerSource: string
	providerVersion: string
	credentials: Record<string, unknown> | null
	config: Record<string, unknown> | null
	credentialDiscriminator: string | null
	credentialForm: ProviderCredentialFormDefinition | null
	onboarding: ProviderIntegrationOnboardingMetadata | null
}

function injectWidgets(
	jsonSchema: Record<string, unknown>,
	zodProperties: Record<string, z.ZodType>,
): void {
	const props = jsonSchema.properties as
		| Record<string, Record<string, unknown>>
		| undefined
	if (!props) return
	for (const [key, propSchema] of Object.entries(props)) {
		const zodField = zodProperties[key]
		if (!zodField) continue
		const widget = getWidget(zodField)
		if (widget) propSchema["x-opsy-widget"] = widget
	}
}

export async function getTypeIdentity(
	providerName: string,
	type: string,
): Promise<TypeIdentityResponse> {
	const { provider } = await requireSchemaProvider(providerName)
	const identity = await provider.getTypeIdentity(type)
	if (identity === undefined) {
		throw new SchemaTypeIdentityUnknown({ providerName, type })
	}
	if (identity === null) {
		return { provider: providerName, type, mode: "import-id" }
	}
	return { provider: providerName, type, mode: "identity", identity }
}

function onboardingMetadata(
	onboarding: ProviderIntegrationOnboardingDefinition | null | undefined,
): ProviderIntegrationOnboardingMetadata | null {
	if (!onboarding) return null
	const {
		documentFor: _documentFor,
		principalEnv: _principalEnv,
		cloudformation: _cloudformation,
		...metadata
	} = onboarding
	return metadata
}

function toJsonSchemaWithWidgets(schema: z.ZodType): Record<string, unknown> {
	const json = z.toJSONSchema(schema) as Record<string, unknown>
	delete json.$schema
	const top = (schema as { shape?: Record<string, z.ZodType> }).shape
	if (top) injectWidgets(json, top)
	const options = (
		schema as { options?: Array<{ shape?: Record<string, z.ZodType> }> }
	).options
	const branches = (json.oneOf ?? json.anyOf) as
		| Array<Record<string, unknown>>
		| undefined
	if (options && branches) {
		for (let i = 0; i < branches.length; i++) {
			const branch = branches[i]
			const branchShape = options[i]?.shape
			if (branch && branchShape) injectWidgets(branch, branchShape)
		}
	}
	return json
}

export async function getIntegrationSchema(
	providerName: string,
	query: GetIntegrationSchemaQuery = {},
): Promise<IntegrationSchemaResponse> {
	const { ref, provider } = await requireSchemaProvider(providerName, query)
	const entry = provider.integrationDefinition
	const objectSchema = {
		type: "object",
		additionalProperties: true,
	} as Record<string, unknown>
	return {
		provider: providerName,
		providerSource: ref.source,
		providerVersion: ref.version,
		credentials: entry?.credentialsSchema
			? toJsonSchemaWithWidgets(entry.credentialsSchema)
			: objectSchema,
		config: entry?.configSchema
			? toJsonSchemaWithWidgets(entry.configSchema)
			: objectSchema,
		credentialDiscriminator: entry?.credentialDiscriminator ?? null,
		credentialForm: entry?.credentialForm ?? null,
		onboarding: onboardingMetadata(entry?.onboarding ?? null),
	}
}

export async function getProviderOnboarding(
	providerName: string,
	onboardingKind: string,
	query: GetProviderOnboardingQuery,
): Promise<{
	principalArn: string | null
	externalId: string
	document: string | null
	permissionsPolicyArn: string | null
	cloudformation: { launchUrl: string } | null
}> {
	const { provider } = await requireSchemaProvider(providerName, query)
	const onboarding = provider.integrationDefinition?.onboarding
	if (!onboarding || onboarding.kind !== onboardingKind) {
		throw new SchemaUnknownProvider({ name: providerName })
	}
	const configuredPrincipal = env[onboarding.principalEnv as keyof typeof env]
	const principalArn =
		typeof configuredPrincipal === "string" ? configuredPrincipal : null
	// One-click is only offered when both halves exist: a configured principal
	// to trust, and a public assets bucket to fetch the template from.
	// Otherwise the UI falls back to the manual trust-policy path.
	const cf = onboarding.cloudformation
	const assetsBucket = env.OPSY_ASSETS_S3_BUCKET
	const launchUrl =
		principalArn && cf && assetsBucket
			? `https://console.aws.amazon.com/cloudformation/home?region=${
					env.OPSY_ASSETS_S3_REGION
				}#/stacks/quickcreate?${new URLSearchParams({
					templateURL: `https://${assetsBucket}.s3.${env.OPSY_ASSETS_S3_REGION}.amazonaws.com/${cf.templateAssetKey}`,
					stackName: cf.stackName,
					param_ExternalId: query.external_id,
					param_OpsyPrincipalArn: principalArn,
					param_PermissionsPolicyArn: cf.permissionsPolicyArn,
				}).toString()}`
			: null
	return {
		principalArn,
		externalId: query.external_id,
		document: principalArn
			? onboarding.documentFor({
					principalArn,
					externalId: query.external_id,
				})
			: null,
		permissionsPolicyArn: cf?.permissionsPolicyArn ?? null,
		cloudformation: launchUrl ? { launchUrl } : null,
	}
}
