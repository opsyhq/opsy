import {
	mutationOptions,
	type QueryClient,
	queryOptions,
} from "@tanstack/react-query"
import type { InferRequestType } from "hono/client"
import { api } from "@/lib/api"
import {
	invalidateProjectOperationsQueries,
	invalidateProjectResourcesQueries,
} from "@/lib/projectReactQuery"

// Kept off the project's `resources` graph key tree so that graph
// invalidations (polling, SSE, mutations targeting the canvas) do not
// cascade-refetch the per-resource detail endpoint.
export const resourceQueryKeys = {
	detail: (projectSlug: string, resourceSlug: string) =>
		["resources", "detail", projectSlug, resourceSlug] as const,
}

const resourceMutationKeys = {
	import: (projectSlug: string) =>
		["resources", "mutation", "import", projectSlug] as const,
	read: (projectSlug: string, resourceSlug: string) =>
		["resources", "mutation", "read", projectSlug, resourceSlug] as const,
	updateLayout: (projectSlug: string, resourceSlug: string) =>
		[
			"resources",
			"mutation",
			"update-layout",
			projectSlug,
			resourceSlug,
		] as const,
	bulkUpdateLayout: (projectSlug: string) =>
		["resources", "mutation", "bulk-update-layout", projectSlug] as const,
}

type LayoutPosition = { x: number; y: number } | null
type LayoutSize = { w: number; h: number } | null

export function resourceQueryOptions(input: {
	projectSlug: string
	resourceSlug: string
}) {
	return queryOptions({
		queryKey: resourceQueryKeys.detail(input.projectSlug, input.resourceSlug),
		queryFn: async () => {
			const res = await api.projects[":project"].resources[":slug"].$get({
				param: { project: input.projectSlug, slug: input.resourceSlug },
			})
			if (!res.ok) throw new Error("Failed to fetch resource")
			return res.json()
		},
	})
}

// The API's importResourceBody is the single authority for the import
// contract (providerId XOR identity); derive the body shape from the route
// rather than restating it here.
export type ImportResourceInput = InferRequestType<
	(typeof api.projects)[":project"]["resources"]["import"]["$post"]
>["json"]

// Import is a direct operation — it does not stage a changeset item. The
// route creates the resource and kicks off the import workflow immediately.
export function importResourceMutationOptions(input: {
	projectSlug: string
	queryClient: QueryClient
}) {
	return mutationOptions({
		mutationKey: resourceMutationKeys.import(input.projectSlug),
		mutationFn: async (body: ImportResourceInput) => {
			const res = await api.projects[":project"].resources.import.$post({
				param: { project: input.projectSlug },
				json: body,
			})
			if (!res.ok) throw new Error("Failed to import resource")
			return res.json()
		},
		onSettled: () => {
			void Promise.all([
				invalidateProjectResourcesQueries(input.queryClient, input.projectSlug),
				invalidateProjectOperationsQueries(
					input.queryClient,
					input.projectSlug,
				),
			])
		},
	})
}

export function readResourceMutationOptions(input: {
	projectSlug: string
	resourceSlug: string
	queryClient: QueryClient
}) {
	return mutationOptions({
		mutationKey: resourceMutationKeys.read(
			input.projectSlug,
			input.resourceSlug,
		),
		mutationFn: async () => {
			const res = await api.projects[":project"].resources[":slug"].read.$post({
				param: { project: input.projectSlug, slug: input.resourceSlug },
			})
			if (!res.ok) throw new Error("Failed to read resource")
			return res.json()
		},
		// Fire-and-forget the detail refresh so the mutation settles immediately;
		// returning the invalidateQueries promise would keep the mutation in
		// `pending` until the detail refetch completes (v5 awaits onSettled).
		// The project graph + operations list refresh via the SSE stream when
		// the server emits running/succeeded for this op.
		onSettled: () => {
			void input.queryClient.invalidateQueries({
				queryKey: resourceQueryKeys.detail(
					input.projectSlug,
					input.resourceSlug,
				),
			})
		},
	})
}

export function updateResourceLayoutMutationOptions(input: {
	projectSlug: string
	queryClient: QueryClient
}) {
	return mutationOptions({
		mutationFn: async (body: {
			slug: string
			position?: LayoutPosition
			size?: LayoutSize
			collapsed?: boolean
		}) => {
			const { slug, position, size, collapsed } = body
			const res = await api.projects[":project"].resources[
				":slug"
			].layout.$patch({
				param: { project: input.projectSlug, slug },
				json: { position, size, collapsed },
			})
			if (!res.ok) throw new Error("Failed to save layout")
			return res.json()
		},
		onSettled: () =>
			invalidateProjectResourcesQueries(input.queryClient, input.projectSlug),
	})
}

export function bulkUpdateResourceLayoutMutationOptions(input: {
	projectSlug: string
	queryClient: QueryClient
}) {
	return mutationOptions({
		mutationKey: resourceMutationKeys.bulkUpdateLayout(input.projectSlug),
		mutationFn: async (
			layouts: Array<{
				slug: string
				position?: LayoutPosition
				size?: LayoutSize
			}>,
		) => {
			const res = await api.projects[":project"].resources.layout.$patch({
				param: { project: input.projectSlug },
				json: { layouts },
			})
			if (!res.ok) throw new Error("Failed to save layouts")
			return res.json()
		},
		onSettled: () =>
			invalidateProjectResourcesQueries(input.queryClient, input.projectSlug),
	})
}
