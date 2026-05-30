import { useMutation } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { useCallback } from "react"
import { toast } from "sonner"
import { pruneBlanks } from "@/components/resource-fields/resolverSchema"
import { renderTaggedError } from "@/errors/error-toast"
import {
	type ChangeSet,
	stageChangeSetItemMutationOptions,
	updateChangeSetItemMutationOptions,
} from "@/lib/changeSetReactQuery"
import { queryClient } from "@/lib/query"
import type { RelatedCreateSource } from "@/lib/relatedResourceCreate"
import { writeRelatedReference } from "@/lib/relatedResourceCreate"
import type { ResourceSheetTarget } from "./-ResourceSheet.logic"
import { useRelatedCreateStore } from "./-relatedCreateStore"
import {
	type ResourceDraft,
	useResourceDraftStore,
} from "./-resourceDraftStore"
import {
	type ArchitectureDetail,
	type ArchitectureSearch,
	detailToSearch,
} from "./-search"

export function useRelatedCreateOrchestrator({
	projectSlug,
	changeSet,
	detail,
	stagedResourceDetailOpen,
	onResourceFocusRequested,
}: {
	projectSlug: string
	changeSet: ChangeSet | null
	detail: ArchitectureDetail | undefined
	stagedResourceDetailOpen: boolean
	// Called after the user saves a brand-new resource (from a draft) so the
	// canvas can pan/zoom to the freshly-revealed node — same as post-import.
	onResourceFocusRequested?: (slug: string) => void
}) {
	const navigate = useNavigate()
	const relatedCreate = useRelatedCreateStore((s) => s.state)
	const start = useRelatedCreateStore((s) => s.start)
	const setTargetStagedItem = useRelatedCreateStore(
		(s) => s.setTargetStagedItem,
	)
	const markReturning = useRelatedCreateStore((s) => s.markReturning)
	const clear = useRelatedCreateStore((s) => s.clear)
	const resourceDraft = useResourceDraftStore((s) => s.draft)
	const openDraft = useResourceDraftStore((s) => s.openDraft)
	const clearDraft = useResourceDraftStore((s) => s.clearDraft)

	const setDetail = useCallback(
		(next: ArchitectureDetail | undefined) =>
			navigate({
				to: ".",
				search: (prev: Record<string, unknown>) =>
					({ ...prev, ...detailToSearch(next) }) as ArchitectureSearch,
				replace: true,
			}),
		[navigate],
	)

	const setCreateOpen = useCallback(
		(open: boolean) =>
			navigate({
				to: ".",
				search: (prev: Record<string, unknown>) =>
					({ ...prev, create: open ? true : undefined }) as ArchitectureSearch,
				replace: true,
			}),
		[navigate],
	)

	const openStagedCreate = useCallback(
		(stagedItemId: string) =>
			navigate({
				to: ".",
				search: (prev: Record<string, unknown>) =>
					({
						...prev,
						create: undefined,
						...detailToSearch({
							kind: "staged",
							stagedItemId,
							mode: "create",
						}),
					}) as ArchitectureSearch,
				replace: true,
			}),
		[navigate],
	)

	const returnToSource = useCallback(
		(source: RelatedCreateSource) => {
			clear()
			if (source.kind === "live") {
				setDetail({ kind: "applied", resourceSlug: source.resourceSlug })
				return
			}
			if (source.returnMode === "create") {
				openStagedCreate(source.stagedItemId)
				return
			}
			setDetail({
				kind: "staged",
				stagedItemId: source.stagedItemId,
				mode: "detail",
			})
		},
		[clear, openStagedCreate, setDetail],
	)

	const stageLiveSourceMutation = useMutation({
		...stageChangeSetItemMutationOptions({ projectSlug, queryClient }),
		onSuccess: () => {
			const source = useRelatedCreateStore.getState().state?.source
			toast.success("Reference staged")
			if (source) returnToSource(source)
		},
		onError: (error) => renderTaggedError(toast, error),
	})
	const updateStagedSourceMutation = useMutation({
		...updateChangeSetItemMutationOptions({
			projectSlug,
			id: changeSet?.id ?? "",
			queryClient,
		}),
		onSuccess: () => {
			const source = useRelatedCreateStore.getState().state?.source
			toast.success("Reference staged")
			if (source) returnToSource(source)
		},
		onError: (error) => renderTaggedError(toast, error),
	})

	const resourceSheetTarget: ResourceSheetTarget = resourceDraft
		? { kind: "draft", draft: resourceDraft }
		: relatedCreate?.step === "creating-target" &&
				relatedCreate.targetStagedItemId
			? { stagedItemId: relatedCreate.targetStagedItemId, mode: "create" }
			: detail?.kind === "staged" && !stagedResourceDetailOpen
				? { stagedItemId: detail.stagedItemId, mode: detail.mode }
				: null

	const onTargetConfigured = useCallback(
		(stagedItemId: string, nextChangeSet?: ChangeSet) => {
			if (!relatedCreate || relatedCreate.targetStagedItemId !== stagedItemId) {
				// First save of a brand-new resource (draft → staged): drop the
				// draft, open its detail, and frame it on the canvas.
				const wasDraft = !!useResourceDraftStore.getState().draft
				if (wasDraft) clearDraft()
				setDetail({ kind: "staged", stagedItemId, mode: "detail" })
				if (wasDraft && onResourceFocusRequested) {
					const savedItem = (nextChangeSet?.items ?? changeSet?.items ?? []).find(
						(candidate) => candidate.id === stagedItemId,
					)
					const savedChanges =
						savedItem?.changes &&
						typeof savedItem.changes === "object" &&
						!Array.isArray(savedItem.changes)
							? (savedItem.changes as Record<string, unknown>)
							: null
					const savedSlug =
						typeof savedChanges?.slug === "string" ? savedChanges.slug : null
					if (savedSlug) onResourceFocusRequested(savedSlug)
				}
				return
			}

			const targetItem = (nextChangeSet?.items ?? changeSet?.items ?? []).find(
				(item) => item.id === stagedItemId,
			)
			const targetChanges =
				targetItem?.changes &&
				typeof targetItem.changes === "object" &&
				!Array.isArray(targetItem.changes)
					? (targetItem.changes as Record<string, unknown>)
					: null
			const targetSlug =
				typeof targetChanges?.slug === "string" ? targetChanges.slug : null
			if (!targetSlug) {
				toast.error("Save the related resource slug before linking it")
				return
			}

			const ref = `${targetSlug}.${relatedCreate.targetEndpoint.path}`
			markReturning()

			if (relatedCreate.source.kind === "live") {
				const nextValues = pruneBlanks(
					writeRelatedReference({
						values: relatedCreate.source.values,
						fieldPath: relatedCreate.source.fieldPath,
						ref,
						cardinality: relatedCreate.source.cardinality,
					}),
				)
				stageLiveSourceMutation.mutate({
					kind: "update_resource",
					targetResourceSlug: relatedCreate.source.resourceSlug,
					changes: { inputs: nextValues },
				})
				return
			}

			if (!changeSet?.id) {
				toast.error("No active change set to update")
				return
			}

			const stagedSource = relatedCreate.source
			const sourceItem = changeSet?.items.find(
				(item) => item.id === stagedSource.stagedItemId,
			)
			if (!sourceItem) {
				toast.error("Source change set item not found")
				return
			}
			if (
				sourceItem.kind !== "create_resource" &&
				sourceItem.kind !== "update_resource"
			) {
				toast.error(
					`Cannot wire a reference into a ${sourceItem.kind} change set item`,
				)
				return
			}
			const nextInputs = writeRelatedReference({
				values: stagedSource.changes.inputs ?? {},
				fieldPath: stagedSource.fieldPath,
				ref,
				cardinality: stagedSource.cardinality,
			})
			updateStagedSourceMutation.mutate({
				itemId: stagedSource.stagedItemId,
				body: { kind: sourceItem.kind, changes: { inputs: nextInputs } },
			})
		},
		[
			changeSet?.id,
			changeSet?.items,
			clearDraft,
			markReturning,
			onResourceFocusRequested,
			relatedCreate,
			setDetail,
			stageLiveSourceMutation,
			updateStagedSourceMutation,
		],
	)

	const onResourceSheetOpenChange = useCallback(
		(open: boolean) => {
			if (open) return
			// Cancel from the draft editor: just drop the in-memory draft. Nothing
			// was staged, so there's nothing to delete on the server.
			if (useResourceDraftStore.getState().draft) {
				clearDraft()
				return
			}
			if (
				relatedCreate?.step === "creating-target" &&
				relatedCreate.targetStagedItemId
			) {
				returnToSource(relatedCreate.source)
				return
			}
			setDetail(undefined)
		},
		[clearDraft, relatedCreate, returnToSource, setDetail],
	)

	const onCreateDialogDraftReady = useCallback(
		(draft: ResourceDraft) => {
			openDraft(draft)
			setCreateOpen(false)
		},
		[openDraft, setCreateOpen],
	)

	const onCreateDialogOpenChange = useCallback(
		(open: boolean) => {
			setCreateOpen(open)
			if (open) return
			const state = useRelatedCreateStore.getState().state
			if (state?.step === "creating-target" && !state.targetStagedItemId) {
				clear()
			}
		},
		[clear, setCreateOpen],
	)

	const onCreateDialogStagedItem = useCallback(
		(stagedItemId: string) => {
			if (useRelatedCreateStore.getState().state?.step === "creating-target") {
				setTargetStagedItem(stagedItemId)
				setCreateOpen(false)
				return
			}
			openStagedCreate(stagedItemId)
		},
		[openStagedCreate, setCreateOpen, setTargetStagedItem],
	)

	return {
		start,
		createDialogTarget:
			relatedCreate?.step === "creating-target"
				? relatedCreate.targetEndpoint
				: null,
		resourceSheetTarget,
		onCreateDialogOpenChange,
		onCreateDialogStagedItem,
		onCreateDialogDraftReady,
		onResourceSheetOpenChange,
		onTargetConfigured,
	}
}
