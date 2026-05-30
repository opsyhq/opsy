import { useEffect } from "react"
import { toast } from "sonner"
import { apiBaseUrl } from "@/lib/api"
import {
	formatOperationFailure,
	type OperationDetailResponse,
	operationQueryKeys,
	operationQueryOptions,
} from "@/lib/operationReactQuery"
import {
	invalidateProjectChangeSetQueries,
	invalidateProjectOperationsQueries,
	invalidateProjectResourcesQueries,
	type ProjectOperationUpdate,
	type ProjectResource,
	type ProjectResourcesResponse,
	projectQueryKeys,
} from "@/lib/projectReactQuery"
import { queryClient } from "@/lib/query"
import { resourceQueryKeys } from "@/lib/resourceReactQuery"
import { fetchProjectEvents, type ProjectEvent } from "@/lib/sse/fetch-sse"

export function projectEventStreamUrl(
	apiBase: string,
	projectSlug: string,
): string {
	return `${apiBase}/projects/${encodeURIComponent(projectSlug)}/events`
}

export interface ProjectEventHandlerDeps {
	invalidateOperationsList: () => Promise<unknown>
	invalidateOperationDetail: (operationId: string) => Promise<unknown>
	fetchOperation: (operationId: string) => Promise<OperationDetailResponse>
	onFailure: (message: string) => void
	patchResource: (resource: ProjectResource) => void
	removeResource: (resource: { id: string; slug: string }) => void
	invalidateChangesets: () => Promise<unknown>
	// Reconnect resync — SSE deltas applied while disconnected are lost, so
	// we refetch the lists on every reconnect to pick up missed state.
	resyncOnReconnect: () => Promise<unknown>
}

export interface ProjectEventHandler {
	handleEvent: (event: ProjectEvent) => void
	handleReconnect: () => void
}

export function createProjectEventHandler(
	deps: ProjectEventHandlerDeps,
): ProjectEventHandler {
	return {
		handleEvent(event) {
			switch (event.event) {
				case "operation.updated": {
					const op = event.data
					// Failures need the operation detail to format a toast; success and
					// cancel terminations rely on the resource.* events for canvas
					// state. The operation list is invalidated unconditionally so the
					// activity rail reflects status changes.
					if (op.status === "failed") {
						void deps
							.fetchOperation(op.id)
							.then((data) => {
								const failure = formatOperationFailure(data)
								if (failure) deps.onFailure(failure)
							})
							.catch(() => {})
					}
					void Promise.all([
						deps.invalidateOperationsList(),
						deps.invalidateOperationDetail(op.id),
					]).catch(() => {})
					return
				}
				case "resource.created":
				case "resource.updated":
					deps.patchResource(event.data)
					return
				case "resource.deleted":
					deps.removeResource(event.data)
					return
				case "changeset.updated":
					void deps.invalidateChangesets().catch(() => {})
					return
			}
		},
		handleReconnect() {
			void deps.resyncOnReconnect().catch(() => {})
		},
	}
}

async function runProjectEventStream(
	stream: AsyncIterable<ProjectEvent>,
	signal: AbortSignal,
	onEvent: (event: ProjectEvent) => void,
	onDisconnect: (message: string) => void,
) {
	try {
		for await (const event of stream) {
			onEvent(event)
		}
	} catch (err) {
		if (signal.aborted) return
		onDisconnect(err instanceof Error ? err.message : String(err))
	}
}

// One subscription per project tab. Resource events apply per-row deltas via
// setQueryData; operation events drive operations-list + per-op detail
// invalidations and the failure toast. Reconnect triggers a list resync since
// any deltas dropped during the disconnect window cannot be replayed.
export function useProjectEventStream(
	projectId: string | null,
	projectSlug: string | null,
	apiBase = apiBaseUrl,
): void {
	useEffect(() => {
		if (!projectId || !projectSlug) return
		const controller = new AbortController()
		const handler = createProjectEventHandler({
			invalidateOperationsList: () =>
				queryClient.invalidateQueries({
					queryKey: projectQueryKeys.operations(projectSlug),
				}),
			invalidateOperationDetail: (operationId) =>
				queryClient.invalidateQueries({
					queryKey: operationQueryKeys.detail(operationId),
				}),
			fetchOperation: (operationId) =>
				queryClient.fetchQuery(operationQueryOptions({ id: operationId })),
			onFailure: (message) => toast.error(message),
			patchResource: (resource) => {
				queryClient.setQueryData<ProjectResourcesResponse>(
					projectQueryKeys.resources(projectSlug),
					(prev) => {
						if (!prev) return prev
						const idx = prev.resources.findIndex((r) => r.id === resource.id)
						if (idx === -1) {
							return { ...prev, resources: [...prev.resources, resource] }
						}
						const next = prev.resources.slice()
						next[idx] = resource
						return { ...prev, resources: next }
					},
				)
				queryClient.setQueryData(
					resourceQueryKeys.detail(projectSlug, resource.slug),
					resource,
				)
			},
			removeResource: (resource) => {
				queryClient.setQueryData<ProjectResourcesResponse>(
					projectQueryKeys.resources(projectSlug),
					(prev) =>
						prev && {
							...prev,
							resources: prev.resources.filter((r) => r.id !== resource.id),
						},
				)
				queryClient.removeQueries({
					queryKey: resourceQueryKeys.detail(projectSlug, resource.slug),
				})
			},
			invalidateChangesets: () =>
				invalidateProjectChangeSetQueries(queryClient, projectSlug),
			resyncOnReconnect: () =>
				Promise.all([
					invalidateProjectResourcesQueries(queryClient, projectSlug),
					invalidateProjectChangeSetQueries(queryClient, projectSlug),
					invalidateProjectOperationsQueries(queryClient, projectSlug),
				]),
		})

		void runProjectEventStream(
			fetchProjectEvents({
				url: projectEventStreamUrl(apiBase, projectSlug),
				signal: controller.signal,
				reconnect: true,
				onReconnect: handler.handleReconnect,
			}),
			controller.signal,
			handler.handleEvent,
			(message) => toast.error(`Live updates disconnected: ${message}`),
		)

		return () => {
			controller.abort()
		}
	}, [projectId, projectSlug, apiBase])
}
