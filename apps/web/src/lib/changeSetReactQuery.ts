import type { ResourceTypeArtifactsResponse } from "@opsy/api"
import {
	mutationOptions,
	type QueryClient,
	queryOptions,
} from "@tanstack/react-query"
import { api } from "@/lib/api"
import { isRecord } from "@/lib/changeDiff"
import {
	invalidateProjectChangeSetQueries,
	invalidateProjectOperationsQueries,
	invalidateProjectResourcesQueries,
	projectQueryKeys,
} from "@/lib/projectReactQuery"

type ChangeSetItemKind =
	| "create_resource"
	| "update_resource"
	| "delete_resource"
	| "import_resource"

export type DryRunAction =
	| "pending"
	| "noop"
	| "create"
	| "update"
	| "delete"
	| "replace"
	| "deferred"
	| "error"

export type ResourceDryRun = {
	action: DryRunAction
	priorState: unknown | null
	plannedState: unknown | null
	requiresReplace: string[][] | null
	error: { message: string } | null
	updatedAt: string
}

export type ChangeSetItem = {
	id: string
	kind: ChangeSetItemKind
	targetResourceSlug: string | null
	resourceType: string | null
	changes: unknown
	display?: ResourceTypeArtifactsResponse | null
	source: "user" | "llm" | "canvas_drag_drop" | "import"
	createdAt: string
	dryRun: ResourceDryRun | null
	validationStatus: "valid" | "invalid"
	validationResult: { message: string } | null
	applyStatus: "pending" | "succeeded" | "failed"
	applyError: { message?: string } | null
}

// `ChangeSetItem.changes` is `unknown` because each `kind` carries its own
// partial schema (see `PartialCreateResourceChanges` etc. below). Callers
// that need to read individual fields off the blob go through this safe
// cast rather than asserting at every site.
export function changesRecord(item: ChangeSetItem): Record<string, unknown> {
	return isRecord(item.changes) ? item.changes : {}
}

export type ChangeSet = {
	id: string
	status: "draft" | "applying" | "applied" | "discarded" | "canceled"
	title: string | null
	items: ChangeSetItem[]
	createdAt: string
	updatedAt: string
}

export type ApplyChangeSetResult = {
	changeSet: ChangeSet
}

const changeSetMutationKeys = {
	ensureActive: (projectSlug: string) =>
		["changesets", "mutation", "ensure-active", projectSlug] as const,
	stageItem: (projectSlug: string) =>
		["changesets", "mutation", "stage-item", projectSlug] as const,
	refreshDryRuns: (projectSlug: string, id: string) =>
		["changesets", "mutation", "refresh-dry-runs", projectSlug, id] as const,
	apply: (projectSlug: string, id: string) =>
		["changesets", "mutation", "apply", projectSlug, id] as const,
	discard: (projectSlug: string, id: string) =>
		["changesets", "mutation", "discard", projectSlug, id] as const,
	deleteItem: (projectSlug: string, id: string) =>
		["changesets", "mutation", "delete-item", projectSlug, id] as const,
	updateItem: (projectSlug: string, id: string) =>
		["changesets", "mutation", "update-item", projectSlug, id] as const,
}

// Partial shapes mirroring the backend's `partial*ResourceChanges` schemas in
// `apps/api/src/changesets/schemas.ts`. The route validates these; the service
// merges branch-by-branch onto the existing row, so unknown keys here would
// just leak into the jsonb column.
type PartialCreateResourceChanges = Partial<{
	slug: string
	type: string
	integrationSlug: string
	displayName: string
	inputs: Record<string, unknown>
	position: { x: number; y: number }
}>

type PartialImportResourceChanges = Partial<{
	slug: string
	type: string
	integrationSlug: string
	providerId: string
	identity: Record<string, string>
	position: { x: number; y: number }
}>

type PartialUpdateResourceChanges = Partial<{
	inputs: Record<string, unknown>
}>

type PartialDeleteResourceChanges = Partial<{
	mode: "delete" | "forget"
}>

export type UpdateChangeSetItemBody =
	| {
			kind: "create_resource"
			source?: ChangeSetItem["source"]
			changes?: PartialCreateResourceChanges
	  }
	| {
			kind: "import_resource"
			source?: ChangeSetItem["source"]
			changes?: PartialImportResourceChanges
	  }
	| {
			kind: "update_resource"
			source?: ChangeSetItem["source"]
			targetResourceId?: string | null
			targetResourceSlug?: string | null
			changes?: PartialUpdateResourceChanges
	  }
	| {
			kind: "delete_resource"
			source?: ChangeSetItem["source"]
			targetResourceId?: string | null
			targetResourceSlug?: string | null
			changes?: PartialDeleteResourceChanges
	  }

export type StageChangeSetItemBody =
	| {
			kind: "create_resource"
			source?: ChangeSetItem["source"]
			changes:
				| {
						slug: string
						displayName?: string
						type: string
						integrationSlug?: string
						position?: { x: number; y: number }
						inputs: Record<string, unknown>
				  }
				| {
						slug: string
						displayName?: string
						position?: { x: number; y: number }
				  }
	  }
	| {
			kind: "import_resource"
			source?: ChangeSetItem["source"]
			changes: {
				slug: string
				type: string
				providerId: string
				integrationSlug?: string
				position?: { x: number; y: number }
			}
	  }
	| {
			kind: "update_resource"
			source?: ChangeSetItem["source"]
			targetResourceSlug: string
			changes: { inputs: Record<string, unknown> }
	  }
	| {
			kind: "delete_resource"
			source?: ChangeSetItem["source"]
			targetResourceSlug: string
			changes: { mode?: "delete" | "forget" }
	  }

export type ActiveChangeSets = {
	draft: ChangeSet | null
	applying: ChangeSet[]
}

export function dryRunQueryOptions(input: {
	projectSlug: string
	changeSetId: string
	itemId: string
	initialData?: ResourceDryRun | null
	enabled?: boolean
}) {
	const initial = input.initialData ?? undefined
	const enabled =
		input.enabled !== false &&
		!!input.projectSlug &&
		!!input.changeSetId &&
		!!input.itemId
	return queryOptions({
		queryKey: [
			...projectQueryKeys.changesets(input.projectSlug),
			input.changeSetId,
			"item",
			input.itemId,
			"dry-run",
		] as const,
		queryFn: async (): Promise<ResourceDryRun> => {
			const res = await api.projects[":project"].changesets[":id"].items[
				":itemId"
			]["dry-run"].$get({
				param: {
					project: input.projectSlug,
					id: input.changeSetId,
					itemId: input.itemId,
				},
			})
			if (!res.ok) throw new Error("Failed to fetch dry-run")
			return (await res.json()) as ResourceDryRun
		},
		initialData: initial,
		// Without this, TanStack treats `initialData` as infinitely stale and
		// fires a GET on mount even though `staleTime: Infinity` is set.
		initialDataUpdatedAt: initial ? () => Date.now() : undefined,
		enabled,
		staleTime: Number.POSITIVE_INFINITY,
		refetchInterval: (query) =>
			query.state.data?.action === "pending" ? 1000 : false,
	})
}

export function activeChangeSetQueryOptions(input: { projectSlug: string }) {
	return queryOptions({
		queryKey: [...projectQueryKeys.changesets(input.projectSlug), "active"],
		queryFn: async (): Promise<ActiveChangeSets> => {
			const res = await api.projects[":project"].changesets.active.$get({
				param: { project: input.projectSlug },
			})
			if (!res.ok) throw new Error("Failed to fetch active changeset")
			return res.json() as Promise<ActiveChangeSets>
		},
		refetchInterval: (query) =>
			(query.state.data?.applying.length ?? 0) > 0 ? 1000 : false,
	})
}

export function stageChangeSetItemMutationOptions(input: {
	projectSlug: string
	queryClient: QueryClient
}) {
	return mutationOptions({
		mutationKey: changeSetMutationKeys.stageItem(input.projectSlug),
		mutationFn: async (body: StageChangeSetItemBody) => {
			const activeRes = await api.projects[":project"].changesets.active.$post({
				param: { project: input.projectSlug },
			})
			if (!activeRes.ok) throw new Error("Failed to create active changeset")
			const changeSet = (await activeRes.json()) as ChangeSet
			const itemRes = await api.projects[":project"].changesets[
				":id"
			].items.$post({
				param: { project: input.projectSlug, id: changeSet.id },
				json: body,
			})
			if (!itemRes.ok) throw new Error("Failed to stage change")
			const next = (await itemRes.json()) as ChangeSet
			input.queryClient.setQueryData<ActiveChangeSets>(
				[...projectQueryKeys.changesets(input.projectSlug), "active"],
				(prev) => ({ draft: next, applying: prev?.applying ?? [] }),
			)
			return next
		},
		onSettled: () =>
			invalidateProjectChangeSetQueries(input.queryClient, input.projectSlug),
	})
}

export function refreshDryRunsChangeSetMutationOptions(input: {
	projectSlug: string
	id: string
	queryClient: QueryClient
}) {
	return mutationOptions({
		mutationKey: changeSetMutationKeys.refreshDryRuns(
			input.projectSlug,
			input.id,
		),
		mutationFn: async () => {
			const res = await api.projects[":project"].changesets[":id"][
				"dry-runs"
			].refresh.$post({
				param: { project: input.projectSlug, id: input.id },
			})
			if (!res.ok) throw new Error("Failed to refresh dry runs")
			return res.json() as Promise<ChangeSet>
		},
		onSuccess: (next) => {
			for (const item of next.items) {
				if (!item.dryRun) continue
				input.queryClient.setQueryData(
					[
						...projectQueryKeys.changesets(input.projectSlug),
						next.id,
						"item",
						item.id,
						"dry-run",
					] as const,
					item.dryRun,
				)
			}
		},
		onSettled: () =>
			invalidateProjectChangeSetQueries(input.queryClient, input.projectSlug),
	})
}

export function applyChangeSetMutationOptions(input: {
	projectSlug: string
	id: string
	queryClient: QueryClient
}) {
	return mutationOptions({
		mutationKey: changeSetMutationKeys.apply(input.projectSlug, input.id),
		mutationFn: async () => {
			const res = await api.projects[":project"].changesets[":id"].apply.$post({
				param: { project: input.projectSlug, id: input.id },
			})
			if (!res.ok) throw new Error("Failed to apply changeset")
			return res.json() as Promise<ApplyChangeSetResult>
		},
		onSettled: () =>
			Promise.all([
				invalidateProjectChangeSetQueries(input.queryClient, input.projectSlug),
				invalidateProjectResourcesQueries(input.queryClient, input.projectSlug),
				invalidateProjectOperationsQueries(
					input.queryClient,
					input.projectSlug,
				),
			]),
	})
}

export function discardChangeSetMutationOptions(input: {
	projectSlug: string
	id: string
	queryClient: QueryClient
}) {
	return mutationOptions({
		mutationKey: changeSetMutationKeys.discard(input.projectSlug, input.id),
		mutationFn: async () => {
			const res = await api.projects[":project"].changesets[
				":id"
			].discard.$post({
				param: { project: input.projectSlug, id: input.id },
			})
			if (!res.ok) throw new Error("Failed to discard changeset")
			return res.json() as Promise<ChangeSet>
		},
		onSuccess: () =>
			input.queryClient.setQueryData<ActiveChangeSets>(
				[...projectQueryKeys.changesets(input.projectSlug), "active"],
				(prev) => ({ draft: null, applying: prev?.applying ?? [] }),
			),
		onSettled: () =>
			invalidateProjectChangeSetQueries(input.queryClient, input.projectSlug),
	})
}

export function deleteChangeSetItemMutationOptions(input: {
	projectSlug: string
	id: string
	queryClient: QueryClient
}) {
	return mutationOptions({
		mutationKey: changeSetMutationKeys.deleteItem(input.projectSlug, input.id),
		mutationFn: async (itemId: string) => {
			const res = await api.projects[":project"].changesets[":id"].items[
				":itemId"
			].$delete({
				param: { project: input.projectSlug, id: input.id, itemId },
			})
			if (!res.ok) throw new Error("Failed to delete changeset item")
			return res.json() as Promise<ChangeSet>
		},
		onSuccess: (next) => {
			if (next.status === "draft") {
				input.queryClient.setQueryData<ActiveChangeSets>(
					[...projectQueryKeys.changesets(input.projectSlug), "active"],
					(prev) => ({ draft: next, applying: prev?.applying ?? [] }),
				)
			}
		},
		onSettled: () =>
			invalidateProjectChangeSetQueries(input.queryClient, input.projectSlug),
	})
}

export function updateChangeSetItemMutationOptions(input: {
	projectSlug: string
	id: string
	queryClient: QueryClient
}) {
	return mutationOptions({
		mutationKey: changeSetMutationKeys.updateItem(input.projectSlug, input.id),
		mutationFn: async (vars: {
			itemId: string
			body: UpdateChangeSetItemBody
		}) => {
			const res = await api.projects[":project"].changesets[":id"].items[
				":itemId"
			].$patch({
				param: {
					project: input.projectSlug,
					id: input.id,
					itemId: vars.itemId,
				},
				json: vars.body,
			})
			if (!res.ok) throw new Error("Failed to update changeset item")
			return res.json() as Promise<ChangeSet>
		},
		onSuccess: (next) => {
			if (next.status === "draft") {
				input.queryClient.setQueryData<ActiveChangeSets>(
					[...projectQueryKeys.changesets(input.projectSlug), "active"],
					(prev) => ({ draft: next, applying: prev?.applying ?? [] }),
				)
			}
		},
		onSettled: () =>
			invalidateProjectChangeSetQueries(input.queryClient, input.projectSlug),
	})
}
