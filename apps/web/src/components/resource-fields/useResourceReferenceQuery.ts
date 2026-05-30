import { useQueries, useQuery } from "@tanstack/react-query"
import { useMemo } from "react"
import { getResourceTypeKey } from "@/components/project-canvas/resourceRelationships"
import { referencePathsFromArtifacts } from "@/components/resource-detail/resolvedTypeView"
import {
	type ProjectResource,
	projectResourcesQueryOptions,
} from "@/lib/projectReactQuery"
import { typeArtifactsQueryOptions } from "@/lib/providerReactQuery"
import {
	type ResourceReferenceCandidate,
	selectResourceReferenceCandidates,
} from "@/lib/resourceRefs"

export type ResourceReferenceQuery = {
	isLoading: boolean
	isError: boolean
	resources: readonly ProjectResource[]
	candidates: ResourceReferenceCandidate[]
}

export const EMPTY_REFERENCE_QUERY: ResourceReferenceQuery = {
	isLoading: false,
	isError: false,
	resources: [],
	candidates: [],
}

export function useResourceReferenceQuery(input: {
	projectSlug?: string
	enabled: boolean
}): ResourceReferenceQuery {
	const query = useQuery({
		...projectResourcesQueryOptions({
			slug: input.projectSlug ?? "",
		}),
		enabled: Boolean(input.projectSlug) && input.enabled,
	})
	const resources = query.data?.resources ?? []
	const distinctTypes = useMemo(() => {
		const seen = new Map<
			string,
			{ provider: string; type: string; kind: "resource" }
		>()
		for (const resource of resources) {
			if (!resource.provider) continue
			const key = getResourceTypeKey(resource)
			if (key && !seen.has(key)) {
				seen.set(key, {
					provider: resource.provider,
					type: resource.type,
					kind: "resource",
				})
			}
		}
		return Array.from(seen.values())
	}, [resources])
	const artifactQueries = useQueries({
		queries: distinctTypes.map((entry) =>
			typeArtifactsQueryOptions({
				...entry,
				enabled: input.enabled,
			}),
		),
	})
	const referenceFieldsByTypeKey = useMemo(() => {
		const map = new Map<string, string[]>()
		artifactQueries.forEach((artifactQuery, index) => {
			const entry = distinctTypes[index]
			if (!entry || !artifactQuery.data) return
			const key = getResourceTypeKey(entry)
			if (key) map.set(key, referencePathsFromArtifacts(artifactQuery.data))
		})
		return map
	}, [artifactQueries, distinctTypes])
	const candidates = useMemo(
		() =>
			selectResourceReferenceCandidates({
				resources,
				referenceFieldsByTypeKey,
			}),
		[resources, referenceFieldsByTypeKey],
	)
	return {
		isLoading: query.isLoading,
		isError: query.isError,
		resources,
		candidates,
	}
}
