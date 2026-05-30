import type { BridgeClient } from "@opsy/bridge-client"
import {
	ProviderDataSourceNotManaged,
	ProviderEntryNotManagedResource,
	ProviderTypeNotFound,
	ProviderTypeUnknownLookup,
} from "@opsy/contracts/errors"
import {
	composeProvider,
	findProviderIntegrationDefinition,
	type Integration as ProviderIntegration,
	type OpsyProvider,
	type ProviderOp,
	type ProviderResult,
	type ProviderType,
	providerConfigForIntegration,
} from "@opsy/provider"
import { getBridgeClient } from "../lib/providers"
import { requireTerraformEntry } from "./refs"
import { terraformProviderCatalog } from "./terraform-catalog"
import type { OpsyProviderRuntime, ProviderRef } from "./types"

export class TerraformDynamicRuntime implements OpsyProviderRuntime {
	private readonly cache = new Map<string, OpsyProvider>()
	private bridgeOverride: BridgeClient | null = null

	async require(ref: ProviderRef): Promise<OpsyProvider> {
		const entry = requireTerraformEntry(ref)
		const key = `${ref.source}@${ref.version}`
		const cached = this.cache.get(key)
		if (cached) return cached

		const bridge = await this.bridge()
		const provider = composeProvider({
			name: entry.name,
			bridge,
			tfSource: entry.source,
			providerConfigFor: (integration: ProviderIntegration) =>
				providerConfigForIntegration(entry, integration),
			integrationDefinition:
				findProviderIntegrationDefinition(entry) ?? undefined,
		})
		await provider.init(ref.version)
		this.cache.set(key, provider)
		return provider
	}

	async dispatch<Op extends ProviderOp>(
		ref: ProviderRef,
		op: Op,
		ctx: Parameters<OpsyProvider["dispatch"]>[1],
	): Promise<ProviderResult<Op["kind"]>> {
		return (await this.require(ref)).dispatch(op, ctx)
	}

	listInstalled(): ProviderRef[] {
		return terraformProviderCatalog().map((entry) => {
			const version = entry.versions[0]
			if (!version) {
				throw new Error(`terraform provider "${entry.name}" has no versions`)
			}
			return {
				name: entry.name,
				source: entry.source,
				version,
			}
		})
	}

	async requireEntry(
		ref: ProviderRef,
		type: string,
	): Promise<{ provider: OpsyProvider; type: ProviderType }> {
		const provider = await this.require(ref)
		const pt = await provider.getType(type)
		if (!pt) throw new ProviderTypeNotFound({ providerName: ref.name, type })
		if (!pt.capabilities.resource) {
			throw new ProviderDataSourceNotManaged({
				providerName: ref.name,
				type,
			})
		}
		return { provider, type: pt }
	}

	async requireDataEntry(
		ref: ProviderRef,
		type: string,
	): Promise<{ provider: OpsyProvider; type: ProviderType }> {
		const provider = await this.require(ref)
		const pt = await provider.getType(type)
		if (!pt) {
			throw new ProviderTypeUnknownLookup({ providerName: ref.name, type })
		}
		if (!pt.capabilities.data) {
			throw new ProviderEntryNotManagedResource({
				providerName: ref.name,
				type,
			})
		}
		return { provider, type: pt }
	}

	setBridgeForTest(bridge: BridgeClient | null): void {
		this.bridgeOverride = bridge
		this.cache.clear()
	}

	clearCacheForTest(): void {
		this.cache.clear()
	}

	private async bridge(): Promise<BridgeClient> {
		return this.bridgeOverride ?? (await getBridgeClient())
	}
}
