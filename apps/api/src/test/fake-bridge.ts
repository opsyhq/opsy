import {
	type BridgeClient,
	BridgeTransportError,
	type ProviderTypeIdentityRequest,
	type ProviderTypeResolveRequest,
	type ProviderTypeSchemaRequest,
	type ProviderTypesSearchRequest,
	type ProviderTypesSearchResponse,
	type ResourceIdentitySchema,
	type ResourceSchema,
} from "@opsy/bridge-client"

type Kind = "resource" | "data"

interface FakeBridgeOptions {
	providerSource?: string
	providerVersion?: string
	provider?: ResourceSchema | null
	resourceSchemas?: Record<string, ResourceSchema>
	dataSourceSchemas?: Record<string, ResourceSchema>
	// Structured import identity per resource type. Absent → the resource
	// exists but advertises no identity (caller falls back to raw import ID).
	identities?: Record<string, ResourceIdentitySchema>
	overrides?: Record<string, unknown>
}

export function createSchemaBridgeForTest(
	opts: FakeBridgeOptions = {},
): BridgeClient {
	const providerSource = opts.providerSource ?? "fakecorp/fake"
	const providerVersion = opts.providerVersion ?? "0.0.0"
	const provider = opts.provider ?? { version: 0, block: {} }
	const resourceSchemas = opts.resourceSchemas ?? {}
	const dataSourceSchemas = opts.dataSourceSchemas ?? {}

	const kindsFor = (type: string): Kind[] => {
		const kinds: Kind[] = []
		if (resourceSchemas[type]) kinds.push("resource")
		if (dataSourceSchemas[type]) kinds.push("data")
		return kinds
	}
	const selectedSchema = (
		type: string,
		kind: Kind,
	): ResourceSchema | undefined =>
		kind === "resource" ? resourceSchemas[type] : dataSourceSchemas[type]

	return {
		baseUrl: "http://fake",
		getSummary: async () => ({
			provider_source: providerSource,
			provider_version: providerVersion,
			resource_count: Object.keys(resourceSchemas).length,
			data_source_count: Object.keys(dataSourceSchemas).length,
			server_capabilities: {
				plan_destroy: false,
				get_provider_schema_optional: false,
				move_resource_state: false,
			},
		}),
		searchTypes: async (req: ProviderTypesSearchRequest) => {
			const byType = new Map<string, Set<Kind>>()
			const add = (kind: Kind, schemas: Record<string, ResourceSchema>) => {
				for (const type of Object.keys(schemas)) {
					const queryTokens =
						req.q
							?.trim()
							.toLowerCase()
							.split(/[^a-z0-9]+/)
							.filter(Boolean) ?? []
					if (
						queryTokens.length > 0 &&
						!queryTokens.every((token) => type.toLowerCase().includes(token))
					) {
						continue
					}
					const kinds = byType.get(type) ?? new Set<Kind>()
					kinds.add(kind)
					byType.set(type, kinds)
				}
			}
			if (
				req.kind === undefined ||
				req.kind === "resource" ||
				req.kind === "both"
			) {
				add("resource", resourceSchemas)
			}
			if (
				req.kind === undefined ||
				req.kind === "data" ||
				req.kind === "both"
			) {
				add("data", dataSourceSchemas)
			}
			const allResults: ProviderTypesSearchResponse["results"] = [
				...byType.entries(),
			]
				.sort(([a], [b]) => a.localeCompare(b))
				.map(([type, kinds]) => ({ type, kinds: [...kinds] }))
			const offset = req.offset ?? 0
			const limit = req.limit ?? 25
			return {
				results: allResults.slice(offset, offset + limit),
				truncated: allResults.length > offset + limit,
			}
		},
		resolveType: async (req: ProviderTypeResolveRequest) => {
			const kinds = kindsFor(req.type)
			if (kinds.length === 0) {
				throw new BridgeTransportError(
					"/providers/types/resolve",
					400,
					`unknown provider type ${req.type}`,
				)
			}
			return {
				type: req.type,
				kinds,
				...(resourceSchemas[req.type]
					? { resource_path: `resources/${req.type}.json` }
					: {}),
				...(dataSourceSchemas[req.type]
					? { data_source_path: `data-sources/${req.type}.json` }
					: {}),
			}
		},
		getTypeSchema: async (req: ProviderTypeSchemaRequest) => {
			const kind = req.kind as Kind
			const schema = selectedSchema(req.type, kind)
			if (!schema) {
				throw new BridgeTransportError(
					"/providers/types/schema",
					400,
					`unknown ${kind} schema ${req.type}`,
				)
			}
			return { type: req.type, kind, schema }
		},
		getTypeIdentity: async (req: ProviderTypeIdentityRequest) => {
			// Identity is keyed off the resource shard, mirroring the real
			// bridge's per-type cached read: an unknown resource type 400s,
			// a known one returns its identity (omitted → import-id fallback).
			if (!resourceSchemas[req.type]) {
				throw new BridgeTransportError(
					"/providers/types/identity",
					400,
					`unknown resource type ${req.type}`,
				)
			}
			const identity = (opts.identities ?? {})[req.type]
			return { type: req.type, ...(identity ? { identity } : {}) }
		},
		getProviderConfigSchema: async () => ({
			...(provider ? { schema: provider } : {}),
		}),
		...opts.overrides,
	} as unknown as BridgeClient
}
