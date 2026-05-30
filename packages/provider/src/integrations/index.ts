import { IntegrationUnknownProvider } from "@opsy/contracts/errors"
import type { Integration, ProviderIntegrationDefinition } from "../integration"
import { awsIntegrationDefinition } from "./aws"

export const providerIntegrationDefinitions = [
	awsIntegrationDefinition,
] satisfies ProviderIntegrationDefinition[]

// Test-only registry. Production code paths never read from this — it's only
// consulted by `findProviderIntegrationDefinition`. Tests use it to register
// fake providers (e.g. `fakep`) without coupling the security registry to test
// fixtures. Always-cleared in `afterEach` via `setTestProviderIntegrationDefinitions(null)`.
let testDefinitions: ProviderIntegrationDefinition[] | null = null

export function setTestProviderIntegrationDefinitions(
	definitions: ProviderIntegrationDefinition[] | null,
): void {
	testDefinitions = definitions
}

export function findProviderIntegrationDefinition(ref: {
	name: string
	source?: string | null
}): ProviderIntegrationDefinition | null {
	const matches = (definition: ProviderIntegrationDefinition) =>
		definition.name === ref.name &&
		(ref.source === undefined ||
			ref.source === null ||
			definition.source === ref.source)
	const fromTest = testDefinitions?.find(matches)
	if (fromTest) return fromTest
	return providerIntegrationDefinitions.find(matches) ?? null
}

// Resolves the provider plugin's `providerConfigFor`, which owns the
// credentials/config → TF config mapping under a strict schema. Closed
// fallback: if no plugin is registered for `ref`, the API never silently
// forwards loose JSON to a TF provider it knows nothing about — it fails the
// operation closed. The plugin registry is the security boundary.
export function providerConfigForIntegration(
	ref: { name: string; source?: string | null },
	integration: Integration,
): Record<string, unknown> {
	const definition = findProviderIntegrationDefinition(ref)
	if (!definition?.providerConfigFor) {
		throw new IntegrationUnknownProvider({ providerName: ref.name })
	}
	return definition.providerConfigFor(integration)
}
