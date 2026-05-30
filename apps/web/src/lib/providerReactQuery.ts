import type {
	ResourceTypeArtifactsResponse,
	SearchHit,
	TypeIdentityResponse,
} from "@opsy/api"
import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query"
import type { InferResponseType } from "hono/client"
import { api, throwingJson } from "@/lib/api"

export type ResourceKind = "resource" | "data"

// Provider logos are local icon names. Generated per-type icons are S3 asset
// URLs carried separately on TypeIconMetadata.
type IconKey = string

export type ResourceCategory =
	| "compute"
	| "storage"
	| "network"
	| "database"
	| "identity"
	| "observability"
	| "messaging"
	| "other"

export type ProviderMetaRecord = {
	id: string
	name: string
	short: string
	logo?: IconKey
	color: string
	docsUrl?: string
}

export type ResourceDisplay = "card" | "compact" | "chip"

export type ResourceTypeArtifacts = NonNullable<ResourceTypeArtifactsResponse>
export type TypeIconLookup = ResourceTypeArtifacts["icon"]
export type ThinkingBlockArtifactStatus = TypeIconLookup["status"]

// Single source of truth: the API owns this shape (structured identity vs.
// raw import-id fallback). Re-exported so import UI can discriminate on `mode`.
export type TypeIdentity = TypeIdentityResponse

type SearchTypesResponse = {
	results: SearchHit[]
	truncated: boolean
}

function hasGeneratingTypeSearchArtifacts(hits: SearchHit[]): boolean {
	return hits.some((hit) => {
		const { icon, metadata } = hit.artifacts
		const iconGenerating =
			icon !== null && (icon.status === "pending" || icon.status === "running")
		const metadataGenerating =
			metadata !== null &&
			(metadata.status === "pending" || metadata.status === "running")
		return iconGenerating || metadataGenerating
	})
}

export function searchTypesQueryOptions(input: {
	provider: string
	q?: string
	kind?: ResourceKind | "both"
	limit?: number
	offset?: number
	enabled?: boolean
}) {
	const limit = input.limit ?? 200
	const offset = input.offset ?? 0
	return queryOptions({
		queryKey: [
			"providers",
			input.provider,
			"types",
			input.q ?? "",
			input.kind ?? "both",
			limit,
			offset,
		],
		queryFn: async (): Promise<SearchHit[]> => {
			const data = await searchTypes(input)
			return data.results
		},
		enabled: input.enabled ?? true,
	})
}

export function resourceTypeSearchQueryOptions(input: {
	provider: string
	q?: string
	limit?: number
	enabled?: boolean
}) {
	const limit = input.limit ?? 50
	return infiniteQueryOptions({
		queryKey: [
			"providers",
			input.provider,
			"types",
			"resource-search",
			input.q ?? "",
			limit,
		],
		queryFn: ({ pageParam }) =>
			searchTypes({
				provider: input.provider,
				q: input.q || undefined,
				kind: "resource",
				limit,
				offset: pageParam,
			}),
		initialPageParam: 0,
		getNextPageParam: (lastPage, allPages) =>
			lastPage.truncated
				? allPages.reduce((sum, page) => sum + page.results.length, 0)
				: undefined,
		enabled: (input.enabled ?? true) && input.provider.length > 0,
		refetchInterval: (query) => {
			const hits = query.state.data?.pages.flatMap((page) => page.results) ?? []
			return hasGeneratingTypeSearchArtifacts(hits) ? 2000 : false
		},
	})
}

export async function searchTypes(input: {
	provider: string
	q?: string
	kind?: ResourceKind | "both"
	limit?: number
	offset?: number
}): Promise<SearchTypesResponse> {
	const limit = input.limit ?? 200
	const offset = input.offset ?? 0
	const res = await api.providers[":provider"].types.$get({
		param: { provider: input.provider },
		query: {
			...(input.q ? { q: input.q } : {}),
			...(input.kind ? { kind: input.kind } : {}),
			limit: String(limit),
			offset: String(offset),
		},
	})
	return throwingJson<SearchTypesResponse>(res, "Failed to search types")
}

function artifactsPollInterval(
	artifacts: ResourceTypeArtifactsResponse | null | undefined,
): 2000 | false {
	if (!artifacts) return false
	const statuses = [
		artifacts.icon.status,
		artifacts.metadata.status,
		artifacts.fieldMetadata.status,
		artifacts.relationshipRules.status,
		artifacts.fieldLayout.status,
	]
	return statuses.some((status) => status === "pending" || status === "running")
		? 2000
		: false
}

export function typeArtifactsQueryOptions(input: {
	provider: string
	type: string
	kind: ResourceKind
	enabled?: boolean
}) {
	return queryOptions({
		queryKey: typeArtifactsQueryKey(input.provider, input.type, input.kind),
		queryFn: async (): Promise<ResourceTypeArtifactsResponse | null> => {
			const res = await api.providers[":provider"].types[
				":type"
			].artifacts.$get({
				param: { provider: input.provider, type: input.type },
				query: { kind: input.kind },
			})
			return throwingJson<ResourceTypeArtifactsResponse | null>(
				res,
				"Failed to fetch type artifacts",
			)
		},
		enabled: input.enabled ?? true,
		staleTime: Number.POSITIVE_INFINITY,
		refetchInterval: (query) => artifactsPollInterval(query.state.data),
	})
}

function typeArtifactsQueryKey(
	provider: string,
	type: string,
	kind: ResourceKind,
): readonly [string, string, string, string, string, ResourceKind] {
	return ["providers", provider, "types", type, "artifacts", kind] as const
}

export type TypeSchemaResponse = InferResponseType<
	(typeof api.providers)[":provider"]["types"][":type"]["$get"],
	200
>

export function typeSchemaQueryOptions(input: {
	provider: string
	type: string
	kind: ResourceKind
	enabled?: boolean
}) {
	return queryOptions({
		queryKey: [
			"providers",
			input.provider,
			"types",
			input.type,
			"schema",
			input.kind,
		],
		queryFn: async (): Promise<TypeSchemaResponse> => {
			const res = await api.providers[":provider"].types[":type"].$get({
				param: { provider: input.provider, type: input.type },
				query: { kind: input.kind, format: "detailed" },
			})
			return throwingJson<TypeSchemaResponse>(
				res,
				"Failed to fetch type schema",
			)
		},
		enabled: input.enabled ?? true,
	})
}

export function typeIdentityQueryOptions(input: {
	provider: string
	type: string
	enabled?: boolean
}) {
	return queryOptions({
		queryKey: ["providers", input.provider, "types", input.type, "identity"],
		queryFn: async (): Promise<TypeIdentity> => {
			const res = await api.providers[":provider"].types[":type"].identity.$get(
				{
					param: { provider: input.provider, type: input.type },
				},
			)
			return throwingJson<TypeIdentity>(res, "Failed to fetch type identity")
		},
		enabled: input.enabled ?? true,
	})
}
