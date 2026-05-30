import type {
	OpsyProvider,
	ProviderOp,
	ProviderResult,
	ProviderType,
} from "@opsy/provider"

export type ProviderRef = {
	name: string
	source: string
	version: string
}

export type ProviderCreateRefInput = {
	provider: string
	providerSource?: string | null
	providerVersion?: string | null
}

export interface OpsyProviderRuntime {
	require(ref: ProviderRef): Promise<OpsyProvider>
	dispatch<Op extends ProviderOp>(
		ref: ProviderRef,
		op: Op,
		ctx: Parameters<OpsyProvider["dispatch"]>[1],
	): Promise<ProviderResult<Op["kind"]>>
	listInstalled(): ProviderRef[]
	requireEntry(
		ref: ProviderRef,
		type: string,
	): Promise<{ provider: OpsyProvider; type: ProviderType }>
	requireDataEntry(
		ref: ProviderRef,
		type: string,
	): Promise<{ provider: OpsyProvider; type: ProviderType }>
}
