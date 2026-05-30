import {
	ProviderUnknown,
	ProviderVersionUnavailable,
} from "@opsy/contracts/errors"
import type { IntegrationRow } from "../lib/db/schema"
import {
	findTerraformProviderByName,
	findTerraformProviderBySource,
	type TerraformProviderCatalogEntry,
} from "./terraform-catalog"
import type { ProviderCreateRefInput, ProviderRef } from "./types"

export function requireTerraformEntry(
	ref: Pick<ProviderRef, "name" | "source" | "version">,
): TerraformProviderCatalogEntry {
	const entry =
		findTerraformProviderBySource(ref.source) ??
		findTerraformProviderByName(ref.name)
	if (!entry || entry.source !== ref.source) {
		throw new ProviderUnknown({ providerName: ref.name })
	}
	if (!entry.versions.includes(ref.version)) {
		throw new ProviderVersionUnavailable({
			providerName: ref.name,
			requestedVersion: ref.version,
			availableVersion: entry.versions[0] ?? "none",
		})
	}
	return entry
}

export function providerRefFromProviderName(
	name: string,
	version?: string | null,
): ProviderRef {
	const entry = findTerraformProviderByName(name)
	if (!entry) throw new ProviderUnknown({ providerName: name })
	const ref = {
		name: entry.name,
		source: entry.source,
		version: version ?? entry.versions[0],
	}
	requireTerraformEntry(ref)
	return ref
}

export function providerRefFromCreateBody(
	body: ProviderCreateRefInput,
): ProviderRef {
	const entry = body.providerSource
		? findTerraformProviderBySource(body.providerSource)
		: findTerraformProviderByName(body.provider)
	if (!entry) throw new ProviderUnknown({ providerName: body.provider })
	const ref = {
		name: entry.name,
		source: body.providerSource ?? entry.source,
		version: body.providerVersion ?? entry.versions[0],
	}
	requireTerraformEntry(ref)
	return ref
}

export function providerRefFromIntegration(row: IntegrationRow): ProviderRef {
	const source =
		row.providerSource ??
		findTerraformProviderByName(row.provider)?.source ??
		row.provider
	const ref = {
		name: row.provider,
		source,
		version:
			row.providerVersion ??
			findTerraformProviderBySource(source)?.versions[0] ??
			"",
	}
	requireTerraformEntry(ref)
	return ref
}

export function providerIdentityPatch(ref: ProviderRef): {
	providerSource: string
	providerVersion: string
} {
	return {
		providerSource: ref.source,
		providerVersion: ref.version,
	}
}
