import type { ProviderMetaRecord } from "@/lib/providerReactQuery"

// Mirror of apps/api/src/schema/providerMeta.ts. Kept in sync manually until the
// view endpoint becomes the only source of truth for provider chrome (today
// the picker still uses search hits which don't carry meta).
const PROVIDER_META: Record<string, ProviderMetaRecord> = {
	aws: {
		id: "aws",
		name: "Amazon Web Services",
		short: "AWS",
		logo: "aws",
		color: "#FF9900",
	},
}

export function getProviderMeta(id: string): ProviderMetaRecord {
	return (
		PROVIDER_META[id] ?? {
			id,
			name: id,
			short: id.toUpperCase(),
			color: "#666666",
		}
	)
}
