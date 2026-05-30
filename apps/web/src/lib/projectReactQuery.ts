import {
	mutationOptions,
	type QueryClient,
	queryOptions,
} from "@tanstack/react-query"
import type { InferRequestType, InferResponseType } from "hono/client"
import { api, throwingJson } from "@/lib/api"
import { resourceQueryKeys } from "@/lib/resourceReactQuery"

type ProjectOperationsQuery = InferRequestType<
	(typeof api.projects)[":project"]["operations"]["$get"]
>["query"]

type ProjectOperationFilters = {
	resourceSlug?: string
	kind?: string
	status?: string
	cursorCreatedAt?: string
	cursorId?: string
	limit?: number
}

export const projectQueryKeys = {
	all: ["projects"] as const,
	list: () => ["projects", "list"] as const,
	detail: (slug: string) => ["projects", "detail", slug] as const,
	resources: (slug: string) =>
		["projects", "detail", slug, "resources"] as const,
	operations: (slug: string, filters?: ProjectOperationFilters) =>
		filters
			? (["projects", "detail", slug, "operations", filters] as const)
			: (["projects", "detail", slug, "operations"] as const),
	changesets: (slug: string) =>
		["projects", "detail", slug, "changesets"] as const,
	integrations: (slug: string) =>
		["projects", "detail", slug, "integrations"] as const,
}

export const projectMutationKeys = {
	create: () => ["projects", "mutation", "create"] as const,
	update: (slug: string) => ["projects", "mutation", "update", slug] as const,
	scan: (slug: string) => ["projects", "mutation", "scan", slug] as const,
	deleteAny: () => ["projects", "mutation", "delete"] as const,
}

export function invalidateProjectQueries(
	queryClient: QueryClient,
	scope?: { slug?: string },
) {
	if (scope?.slug) {
		return queryClient.invalidateQueries({
			queryKey: projectQueryKeys.detail(scope.slug),
		})
	}
	return queryClient.invalidateQueries({ queryKey: projectQueryKeys.all })
}

export function invalidateProjectOperationsQueries(
	queryClient: QueryClient,
	slug: string,
) {
	return queryClient.invalidateQueries({
		queryKey: projectQueryKeys.operations(slug),
	})
}

export function invalidateProjectChangeSetQueries(
	queryClient: QueryClient,
	slug: string,
) {
	return queryClient.invalidateQueries({
		queryKey: projectQueryKeys.changesets(slug),
	})
}

export function invalidateProjectIntegrationsQueries(
	queryClient: QueryClient,
	slug: string,
) {
	return queryClient.invalidateQueries({
		queryKey: projectQueryKeys.integrations(slug),
	})
}

export function projectsQueryOptions() {
	return queryOptions({
		queryKey: projectQueryKeys.list(),
		queryFn: async () => {
			const res = await api.projects.$get()
			if (!res.ok) throw new Error("Failed to fetch projects")
			return res.json()
		},
	})
}

export function projectQueryOptions(input: { slug: string }) {
	return queryOptions({
		queryKey: projectQueryKeys.detail(input.slug),
		queryFn: async () => {
			const res = await api.projects[":project"].$get({
				param: { project: input.slug },
			})
			if (!res.ok) throw new Error("Failed to fetch project")
			return res.json()
		},
	})
}

export type ProjectResourcesResponse = InferResponseType<
	(typeof api.projects)[":project"]["resources"]["$get"],
	200
>
export type ProjectResource = ProjectResourcesResponse["resources"][number]

export function projectResourcesQueryOptions(input: { slug: string }) {
	return queryOptions({
		queryKey: projectQueryKeys.resources(input.slug),
		queryFn: async (ctx): Promise<ProjectResourcesResponse> => {
			const res = await api.projects[":project"].resources.$get({
				param: { project: input.slug },
			})
			const data = await throwingJson<ProjectResourcesResponse>(
				res,
				"Failed to fetch resources",
			)
			for (const r of data.resources) {
				ctx.client.setQueryData(
					resourceQueryKeys.detail(input.slug, r.slug),
					r,
				)
			}
			return data
		},
		staleTime: Number.POSITIVE_INFINITY,
	})
}

export function invalidateProjectResourcesQueries(
	queryClient: QueryClient,
	slug: string,
) {
	return queryClient.invalidateQueries({
		queryKey: projectQueryKeys.resources(slug),
	})
}

export type ProjectOperationListResponse = InferResponseType<
	(typeof api.projects)[":project"]["operations"]["$get"],
	200
>
export type ProjectOperation =
	ProjectOperationListResponse["operations"][number]
export type ProjectOpenOperation = ProjectOperation
export type ProjectOperationUpdate = Pick<
	ProjectOperation,
	| "id"
	| "projectId"
	| "resourceId"
	| "changeSetItemId"
	| "kind"
	| "status"
	| "createdAt"
	| "updatedAt"
	| "closedAt"
>

export async function fetchProjectOperations(
	input: { slug: string } & ProjectOperationFilters,
): Promise<ProjectOperationListResponse> {
	const { slug, resourceSlug, kind, status, cursorCreatedAt, cursorId } = input
	const limit = input.limit ?? 20
	const res = await api.projects[":project"].operations.$get({
		param: { project: slug },
		query: {
			...(resourceSlug && { resourceSlug }),
			...(kind && { kind: kind as ProjectOperationsQuery["kind"] }),
			...(status && { status: status as ProjectOperationsQuery["status"] }),
			...(cursorCreatedAt && { cursorCreatedAt }),
			...(cursorId && { cursorId }),
			limit: String(limit),
		},
	})
	if (!res.ok) throw new Error("Failed to fetch operations")
	return res.json()
}

export function projectOperationsQueryOptions(
	input: { slug: string } & ProjectOperationFilters,
) {
	const { slug, resourceSlug, kind, status, cursorCreatedAt, cursorId, limit } =
		input
	const filters: ProjectOperationFilters = {
		...(resourceSlug && { resourceSlug }),
		...(kind && { kind }),
		...(status && { status }),
		...(cursorCreatedAt && { cursorCreatedAt }),
		...(cursorId && { cursorId }),
		limit: limit ?? 20,
	}
	return queryOptions({
		queryKey: projectQueryKeys.operations(slug, filters),
		queryFn: () => fetchProjectOperations(input),
	})
}

export function projectIntegrationsQueryOptions(input: { slug: string }) {
	return queryOptions({
		queryKey: projectQueryKeys.integrations(input.slug),
		queryFn: async () => {
			const res = await api.projects[":project"].integrations.$get({
				param: { project: input.slug },
			})
			if (!res.ok) throw new Error("Failed to fetch integrations")
			return res.json()
		},
	})
}

export type ProjectIntegrationListResponse = InferResponseType<
	(typeof api.projects)[":project"]["integrations"]["$get"],
	200
>
export type ProjectIntegration =
	ProjectIntegrationListResponse["integrations"][number]

export function createProjectMutationOptions(input: {
	queryClient: QueryClient
}) {
	return mutationOptions({
		mutationKey: projectMutationKeys.create(),
		mutationFn: async (slug: string) => {
			const res = await api.projects.$post({ json: { slug } })
			if (!res.ok) throw new Error("Failed to create project")
			return res.json()
		},
		onSettled: () =>
			input.queryClient.invalidateQueries({
				queryKey: projectQueryKeys.list(),
			}),
	})
}

export function deleteProjectMutationOptions(input: {
	queryClient: QueryClient
}) {
	return mutationOptions({
		mutationKey: projectMutationKeys.deleteAny(),
		mutationFn: async (slug: string) => {
			const res = await api.projects[":project"].$delete({
				param: { project: slug },
				query: {},
			})
			if (!res.ok) throw new Error("Failed to delete project")
			return res.json()
		},
		onSettled: () =>
			input.queryClient.invalidateQueries({
				queryKey: projectQueryKeys.list(),
			}),
	})
}

export function updateProjectMutationOptions(input: {
	slug: string
	queryClient: QueryClient
}) {
	return mutationOptions({
		mutationKey: projectMutationKeys.update(input.slug),
		mutationFn: async (body: {
			approvalPolicy?: string[]
			scanInterval?: "off" | "hourly" | "daily"
		}) => {
			const res = await api.projects[":project"].$patch({
				param: { project: input.slug },
				json: body,
			})
			if (!res.ok) throw new Error("Failed to update project")
			return res.json()
		},
		onSettled: () =>
			input.queryClient.invalidateQueries({
				queryKey: projectQueryKeys.detail(input.slug),
				exact: true,
			}),
	})
}

export function scanProjectMutationOptions(input: {
	slug: string
	queryClient: QueryClient
}) {
	return mutationOptions({
		mutationKey: projectMutationKeys.scan(input.slug),
		mutationFn: async () => {
			const res = await api.projects[":project"].scan.$post({
				param: { project: input.slug },
			})
			if (!res.ok) throw new Error("Failed to start project scan")
			return res.json()
		},
		onSettled: () =>
			Promise.all([
				input.queryClient.invalidateQueries({
					queryKey: projectQueryKeys.detail(input.slug),
					exact: true,
				}),
				input.queryClient.invalidateQueries({
					queryKey: projectQueryKeys.resources(input.slug),
				}),
				input.queryClient.invalidateQueries({
					queryKey: projectQueryKeys.operations(input.slug),
				}),
			]),
	})
}
