import {
	findProviderIntegrationDefinition,
	type ProviderIntegrationDefinition,
	setTestProviderIntegrationDefinitions,
} from "@opsy/provider"
import { env } from "../lib/env"

const DEFAULT_TERRAFORM_PROVIDER_CATALOG = "aws=hashicorp/aws@6.44.0"

export interface TerraformProviderCatalogEntry {
	name: string
	source: string
	versions: string[]
	checksums?: Record<string, string>
}

function inferName(source: string): string {
	return source.slice(source.lastIndexOf("/") + 1)
}

function parseEntry(raw: string): TerraformProviderCatalogEntry | null {
	const trimmed = raw.trim()
	if (!trimmed) return null
	const [left, versionPart] = trimmed.split("@")
	if (!left || !versionPart) {
		throw new Error(
			`invalid OPSY_TERRAFORM_PROVIDERS entry "${raw}" — expected name=source@version or source@version, with optional pipe-delimited versions`,
		)
	}
	const [maybeName, maybeSource] = left.includes("=")
		? left.split("=")
		: [inferName(left), left]
	if (!maybeName || !maybeSource) {
		throw new Error(
			`invalid OPSY_TERRAFORM_PROVIDERS entry "${raw}" — missing provider name or source`,
		)
	}
	const versions = versionPart
		.split("|")
		.map((v) => v.trim())
		.filter(Boolean)
	if (versions.length === 0) {
		throw new Error(
			`invalid OPSY_TERRAFORM_PROVIDERS entry "${raw}" — missing version`,
		)
	}
	return { name: maybeName.trim(), source: maybeSource.trim(), versions }
}

export function parseTerraformProviderCatalog(
	value: string,
): TerraformProviderCatalogEntry[] {
	const entries = value
		.split(",")
		.map(parseEntry)
		.filter((entry): entry is TerraformProviderCatalogEntry => entry !== null)
	const bySource = new Map<string, TerraformProviderCatalogEntry>()
	for (const entry of entries) {
		const existing = bySource.get(entry.source)
		if (!existing) {
			bySource.set(entry.source, { ...entry, versions: [...entry.versions] })
			continue
		}
		const versions = new Set([...existing.versions, ...entry.versions])
		bySource.set(entry.source, {
			...existing,
			versions: Array.from(versions).sort((a, b) => a.localeCompare(b)),
		})
	}
	return Array.from(bySource.values()).sort((a, b) =>
		a.name.localeCompare(b.name),
	)
}

let overrideCatalog: TerraformProviderCatalogEntry[] | null = null

export function terraformProviderCatalog(): TerraformProviderCatalogEntry[] {
	return (
		overrideCatalog ??
		parseTerraformProviderCatalog(
			env.OPSY_TERRAFORM_PROVIDERS.trim()
				? env.OPSY_TERRAFORM_PROVIDERS
				: DEFAULT_TERRAFORM_PROVIDER_CATALOG,
		)
	)
}

export function setTerraformProviderCatalogForTest(
	entries: TerraformProviderCatalogEntry[] | null,
): void {
	overrideCatalog = entries
		? entries.map((entry) => ({
				...entry,
				versions: [...entry.versions],
				checksums: entry.checksums ? { ...entry.checksums } : undefined,
			}))
		: null
	// The production plugin registry is closed: unregistered providers fail at
	// `providerConfigForIntegration` instead of forwarding loose JSON. Tests
	// that exercise fake providers (e.g. `fakep`) need a matching plugin def
	// so the closed-fallback throw doesn't fire mid-test. Register a
	// passthrough definition for every entry that isn't already a real
	// production plugin (aws today).
	if (entries === null) {
		setTestProviderIntegrationDefinitions(null)
		return
	}
	const passthroughs = entries
		.filter((entry) => !findProviderIntegrationDefinition(entry))
		.map<ProviderIntegrationDefinition>((entry) => ({
			name: entry.name,
			source: entry.source,
			providerConfigFor: (integration) => ({
				...integration.config,
				...integration.credentials,
			}),
		}))
	setTestProviderIntegrationDefinitions(passthroughs.length ? passthroughs : null)
}

export function findTerraformProviderByName(
	name: string,
): TerraformProviderCatalogEntry | undefined {
	return terraformProviderCatalog().find((entry) => entry.name === name)
}

export function findTerraformProviderBySource(
	source: string,
): TerraformProviderCatalogEntry | undefined {
	return terraformProviderCatalog().find((entry) => entry.source === source)
}
