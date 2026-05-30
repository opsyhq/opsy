import {
	mutationOptions,
	type QueryClient,
	queryOptions,
} from "@tanstack/react-query"
import type { InferResponseType } from "hono/client"
import { api } from "@/lib/api"
import {
	invalidateProjectOperationsQueries,
	invalidateProjectResourcesQueries,
} from "@/lib/projectReactQuery"

export type OperationDetailResponse = InferResponseType<
	(typeof api.operations)[":id"]["$get"],
	200
>

// The user-facing message for a terminally-failed operation, or null when the
// operation is still open or didn't fail. #13's failed-create visibility used
// to be silent; keeping the contract pure makes it table-testable without the
// SSE hook. error is opaque jsonb, so message is narrowed at runtime.
export function formatOperationFailure(
	detail: OperationDetailResponse,
): string | null {
	const { operation, resource } = detail
	if (!operation.closedAt) return null
	if (operation.status !== "failed") return null
	const errMsg = operation.error?.message
	const reason = typeof errMsg === "string" ? errMsg : null
	const subject = resource?.slug ?? "resource"
	return `${operation.kind} ${subject} failed${reason ? `: ${reason}` : ""}`
}

export const operationQueryKeys = {
	all: ["operations"] as const,
	detail: (id: string) => ["operations", "detail", id] as const,
}

const operationMutationKeys = {
	approve: (id: string) => ["operations", "mutation", "approve", id] as const,
	cancel: (id: string) => ["operations", "mutation", "cancel", id] as const,
	retry: (id: string) => ["operations", "mutation", "retry", id] as const,
}

export function invalidateOperationQueries(
	queryClient: QueryClient,
	scope?: { id?: string },
) {
	if (scope?.id) {
		return queryClient.invalidateQueries({
			queryKey: operationQueryKeys.detail(scope.id),
		})
	}
	return queryClient.invalidateQueries({ queryKey: operationQueryKeys.all })
}

export function operationQueryOptions(input: {
	id: string
	enabled?: boolean
}) {
	return queryOptions({
		queryKey: operationQueryKeys.detail(input.id),
		queryFn: async () => {
			const res = await api.operations[":id"].$get({ param: { id: input.id } })
			if (!res.ok) throw new Error("Failed to fetch operation")
			return res.json()
		},
		enabled: input.enabled ?? true,
	})
}

function invalidateOperationAndProjectQueries(
	queryClient: QueryClient,
	id: string,
	projectSlug: string,
) {
	return Promise.all([
		invalidateOperationQueries(queryClient, { id }),
		invalidateProjectOperationsQueries(queryClient, projectSlug),
		invalidateProjectResourcesQueries(queryClient, projectSlug),
	])
}

export function approveOperationMutationOptions(input: {
	id: string
	projectSlug: string
	queryClient: QueryClient
}) {
	return mutationOptions({
		mutationKey: operationMutationKeys.approve(input.id),
		mutationFn: async () => {
			const res = await api.operations[":id"].approve.$post({
				param: { id: input.id },
			})
			if (!res.ok) throw new Error("Failed to approve operation")
			return res.json()
		},
		onSettled: () =>
			invalidateOperationAndProjectQueries(
				input.queryClient,
				input.id,
				input.projectSlug,
			),
	})
}

export function cancelOperationMutationOptions(input: {
	id: string
	projectSlug: string
	queryClient: QueryClient
}) {
	return mutationOptions({
		mutationKey: operationMutationKeys.cancel(input.id),
		mutationFn: async () => {
			const res = await api.operations[":id"].cancel.$post({
				param: { id: input.id },
			})
			if (!res.ok) throw new Error("Failed to cancel operation")
			return res.json()
		},
		onSettled: () =>
			invalidateOperationAndProjectQueries(
				input.queryClient,
				input.id,
				input.projectSlug,
			),
	})
}

export function retryOperationMutationOptions(input: {
	id: string
	projectSlug: string
	queryClient: QueryClient
}) {
	return mutationOptions({
		mutationKey: operationMutationKeys.retry(input.id),
		mutationFn: async () => {
			const res = await api.operations[":id"].retry.$post({
				param: { id: input.id },
			})
			if (!res.ok) throw new Error("Failed to retry operation")
			return res.json()
		},
		onSettled: () =>
			invalidateOperationAndProjectQueries(
				input.queryClient,
				input.id,
				input.projectSlug,
			),
	})
}
