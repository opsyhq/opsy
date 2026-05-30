export interface ProviderMetaRecord {
	id: string
	name: string
	short: string
	logo?: string
	color: string
	docsUrl?: string
}

export function getProviderMeta(id: string): ProviderMetaRecord {
	return {
		id,
		name: id,
		short: id.toUpperCase(),
		color: "#666666",
	}
}
