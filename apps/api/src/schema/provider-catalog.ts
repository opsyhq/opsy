import {
	ProviderUnknown,
	SchemaResourceTypeNoSchema,
	SchemaTypeUnknown,
	SchemaUnknownProvider,
} from "@opsy/contracts/errors"
import type { ProviderListEntry } from "@opsy/contracts"
import type { OpsyProvider, ResourceTypeSchema } from "@opsy/provider"
import { actorRendersArtifacts } from "../lib/actor"
import {
	findTerraformProviderByName,
	type ProviderCreateRefInput,
	type ProviderRef,
	providerRefFromCreateBody,
	providerRefFromProviderName,
	providerRuntime,
} from "../provider-runtime"
import type { ThinkingBlockLookup } from "@opsy/thinking-blocks"
import {
	type GeneratedTypeIconData,
	resourceTypeIconBlock,
	resourceTypeIconWireData,
} from "../resources/artifacts/icon/block"
import {
	type GeneratedResourceTypeDisplayMetadata,
	resourceTypeDisplayMetadataBlock,
} from "../resources/artifacts/metadata/block"
import { thinkingBlockInputHash } from "@opsy/thinking-blocks"
import type { Actor } from "../types"
import { stripSchema } from "./compact"
import type {
	GetProviderDetailQuery,
	GetTypeSchemaQuery,
	SearchTypesQuery,
} from "./schemas"

interface ProviderDetail extends ProviderListEntry {
	schema: ResourceTypeSchema | null
}

export interface SearchHit {
	provider: string
	type: string
	kinds: Array<"resource" | "data">
	// Schema-derived facts about the type — always available when the hit's
	// kind-scoped schema was loaded (the kind-specific search branch). The
	// cross-provider branch can't afford a per-hit schema fetch, so these stay
	// undefined there.
	description?: string
	deprecated?: boolean
	deprecationMessage?: string
	artifacts: {
		icon: ThinkingBlockLookup<GeneratedTypeIconData> | null
		metadata: ThinkingBlockLookup<GeneratedResourceTypeDisplayMetadata> | null
	}
}

interface SearchResponse {
	results: SearchHit[]
	truncated: boolean
}

interface TypeSchemaResponse {
	provider: string
	type: string
	version: string | null
	kinds: Array<"resource" | "data">
	resource?: ResourceTypeSchema
	data?: ResourceTypeSchema
}

type ProviderRefQuery = Pick<
	ProviderCreateRefInput,
	"providerSource" | "providerVersion"
>

export async function requireSchemaProvider(
	name: string,
	query: ProviderRefQuery = {},
): Promise<{ ref: ProviderRef; provider: OpsyProvider }> {
	try {
		const ref = query.providerSource
			? providerRefFromCreateBody({ provider: name, ...query })
			: providerRefFromProviderName(name, query.providerVersion)
		return { ref, provider: await providerRuntime.require(ref) }
	} catch (err) {
		if (err instanceof ProviderUnknown)
			throw new SchemaUnknownProvider({ name })
		throw err
	}
}

function providerToListEntry(
	ref: ProviderRef,
	provider: OpsyProvider,
): ProviderListEntry {
	const versions = findTerraformProviderByName(ref.name)?.versions ?? []
	return {
		name: ref.name,
		source: provider.info.tfSource,
		version: provider.info.version,
		versions,
		resourceCount: provider.capabilities.resourceCount,
		dataSourceCount: provider.capabilities.dataSourceCount,
	}
}

export async function listProviders(): Promise<{
	providers: ProviderListEntry[]
}> {
	const entries = await Promise.all(
		providerRuntime
			.listInstalled()
			.map(async (ref) =>
				providerToListEntry(ref, await providerRuntime.require(ref)),
			),
	)
	return { providers: entries }
}

export async function getProvider(
	name: string,
	query: GetProviderDetailQuery,
): Promise<ProviderDetail> {
	const { ref, provider } = await requireSchemaProvider(name, query)
	const base = providerToListEntry(ref, provider)
	const raw = (await provider.getProviderConfigSchema()) ?? null
	const schema =
		raw === null ? null : query.format === "detailed" ? raw : stripSchema(raw)
	return { ...base, schema }
}

export async function search(
	actor: Actor,
	query: SearchTypesQuery,
): Promise<SearchResponse> {
	const wantsArtifacts = actorRendersArtifacts(actor)
	if (query.provider) {
		const ref = query.providerSource
			? providerRefFromCreateBody({
					provider: query.provider,
					providerSource: query.providerSource,
					providerVersion: query.providerVersion,
				})
			: providerRefFromProviderName(query.provider, query.providerVersion)
		const provider = await providerRuntime.require(ref)
		const page = await provider.searchTypes({
			q: query.q,
			kind: query.kind,
			limit: query.limit,
			offset: query.offset,
		})

		const kind = query.kind
		const iconLookups =
			wantsArtifacts && query.kind === "resource"
				? await resourceTypeIconBlock.getMany(
						page.results.map((hit) => ({
							provider: ref.name,
							type: hit.type,
						})),
						{ mode: "background", trigger: "type_search" },
					)
				: null

		const metadataPairs =
			wantsArtifacts && (kind === "resource" || kind === "data")
				? await (async () => {
						const requests = await Promise.all(
							page.results.map(async (hit) => {
								const schema = await provider.getSchema(hit.type, kind)
								if (!schema) {
									throw new SchemaResourceTypeNoSchema({
										providerName: ref.name,
										type: hit.type,
										kind,
									})
								}
								return {
									provider: ref.name,
									providerVersion: provider.info.version,
									kind,
									type: hit.type,
									schema,
									schemaHash: thinkingBlockInputHash(schema.identity),
								}
							}),
						)
						const lookups = await resourceTypeDisplayMetadataBlock.getMany(
							requests,
							{ mode: "background", trigger: "type_search" },
						)
						return requests.map((request, index) => ({
							request,
							lookup: lookups[index],
						}))
					})()
				: null

		return {
			results: page.results.map((hit, index) => {
				const iconLookup = iconLookups ? iconLookups[index] : null
				const metadataPair = metadataPairs ? metadataPairs[index] : null
				const identity = metadataPair?.request.schema.identity
				return {
					provider: ref.name,
					type: hit.type,
					kinds: hit.kinds,
					...(identity?.description ? { description: identity.description } : {}),
					...(identity ? { deprecated: identity.deprecated } : {}),
					...(identity?.deprecationMessage
						? { deprecationMessage: identity.deprecationMessage }
						: {}),
					artifacts: {
						icon: iconLookup
							? {
									...iconLookup,
									data: resourceTypeIconWireData(iconLookup.data),
								}
							: null,
						metadata: metadataPair?.lookup ?? null,
					},
				}
			}),
			truncated: page.truncated,
		}
	}

	const hits: SearchHit[] = []
	let providerTruncated = false

	for (const ref of providerRuntime.listInstalled()) {
		const provider = await providerRuntime.require(ref)
		const page = await provider.searchTypes({
			q: query.q,
			kind: query.kind,
			limit: Math.min(query.offset + query.limit + 1, 100),
			offset: 0,
		})
		providerTruncated ||= page.truncated
		for (const hit of page.results) {
			hits.push({
				provider: ref.name,
				type: hit.type,
				kinds: hit.kinds,
				artifacts: { icon: null, metadata: null },
			})
		}
	}

	const truncated =
		providerTruncated || hits.length > query.offset + query.limit
	const results = hits.slice(query.offset, query.offset + query.limit)
	return { results, truncated }
}

export async function pickKindSchema(
	providerName: string,
	type: string,
	kind: "resource" | "data",
	query: ProviderRefQuery = {},
): Promise<{
	ref: ProviderRef
	provider: OpsyProvider
	schema: ResourceTypeSchema
}> {
	const { ref, provider } = await requireSchemaProvider(providerName, query)
	const schema = await provider.getSchema(type, kind)
	if (!schema) {
		if (!(await provider.getType(type))) {
			throw new SchemaTypeUnknown({ providerName, type })
		}
		throw new SchemaResourceTypeNoSchema({ providerName, type, kind })
	}
	return { ref, provider, schema }
}

export async function getType(
	providerName: string,
	type: string,
	query: GetTypeSchemaQuery,
): Promise<TypeSchemaResponse> {
	const { provider } = await requireSchemaProvider(providerName, query)
	const schema = query.kind
		? await provider.getSchema(type, query.kind)
		: await provider.getSchema(type)
	if (!schema) {
		if (query.kind && (await provider.getType(type))) {
			throw new SchemaResourceTypeNoSchema({
				providerName,
				type,
				kind: query.kind,
			})
		}
		throw new SchemaTypeUnknown({ providerName, type })
	}

	const detailed = query.format === "detailed"
	const kinds: Array<"resource" | "data"> = []
	const response: TypeSchemaResponse = {
		provider: providerName,
		type,
		version: provider.info.version,
		kinds,
	}
	const resourceSchema =
		query.kind === "resource"
			? (schema as ResourceTypeSchema)
			: query.kind
				? undefined
				: (schema as { resource?: ResourceTypeSchema }).resource
	const dataSchema =
		query.kind === "data"
			? (schema as ResourceTypeSchema)
			: query.kind
				? undefined
				: (schema as { data?: ResourceTypeSchema }).data
	if (resourceSchema) {
		response.resource = detailed ? resourceSchema : stripSchema(resourceSchema)
		kinds.push("resource")
	}
	if (dataSchema) {
		response.data = detailed ? dataSchema : stripSchema(dataSchema)
		kinds.push("data")
	}
	if (kinds.length === 0) {
		throw new SchemaResourceTypeNoSchema({
			providerName,
			type,
			kind: query.kind ?? "any",
		})
	}
	return response
}
