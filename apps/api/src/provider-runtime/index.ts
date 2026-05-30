import type { BridgeClient } from "@opsy/bridge-client"
import { TerraformDynamicRuntime } from "./terraform"
import type { OpsyProviderRuntime } from "./types"

export {
	providerIdentityPatch,
	providerRefFromCreateBody,
	providerRefFromIntegration,
	providerRefFromProviderName,
} from "./refs"
export {
	findTerraformProviderByName,
	setTerraformProviderCatalogForTest,
} from "./terraform-catalog"
export type {
	ProviderCreateRefInput,
	ProviderRef,
} from "./types"

const terraformRuntime = new TerraformDynamicRuntime()

export function setTerraformBridgeClientForTest(
	bridge: BridgeClient | null,
): void {
	terraformRuntime.setBridgeForTest(bridge)
}

export function clearTerraformRuntimeCacheForTest(): void {
	terraformRuntime.clearCacheForTest()
}

export const providerRuntime: OpsyProviderRuntime = {
	require(ref) {
		return terraformRuntime.require(ref)
	},
	dispatch(ref, op, ctx) {
		return terraformRuntime.dispatch(ref, op, ctx)
	},
	listInstalled() {
		return terraformRuntime.listInstalled()
	},
	requireEntry(ref, type) {
		return terraformRuntime.requireEntry(ref, type)
	},
	requireDataEntry(ref, type) {
		return terraformRuntime.requireDataEntry(ref, type)
	},
}
