import { useMutation, useQuery } from "@tanstack/react-query"
import { Link, useNavigate, useRouterState } from "@tanstack/react-router"
import { ArrowLeft, Loader2, RefreshCw, Trash2 } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { OperationDetailSheet } from "@/components/operations/OperationDetailSheet"
import {
	RESOURCE_EDIT_FORM_ID,
	ResourceConfigurationPanel,
} from "@/components/resource-detail/ResourceConfigurationPanel"
import {
	buildDraftSubmitChanges,
	computeDisplayValues,
	computeEditSeed,
	getResourceDetailSections,
	type ResourceDetailSubject,
	toDraftResource,
} from "@/components/resource-detail/ResourceDetail.logic"
import { ResourceDetailFrame } from "@/components/resource-detail/ResourceDetailFrame"
import { ResourceDetailMessage } from "@/components/resource-detail/ResourceDetailMessage"
import { ResourceOperationsTable } from "@/components/resource-detail/ResourceOperationsTable"
import { resolveTypeView } from "@/components/resource-detail/resolvedTypeView"
import { StageResourceRemovalAction } from "@/components/resource-detail/StageResourceRemovalAction"
import { pruneBlanks } from "@/components/resource-fields/resolverSchema"
import { ResourceStatusBadge } from "@/components/StatusBadge"
import { Button } from "@/components/ui/button"
import { renderTaggedError } from "@/errors/error-toast"
import {
	type ChangeSetItem,
	dryRunQueryOptions,
	deleteChangeSetItemMutationOptions,
	stageChangeSetItemMutationOptions,
	updateChangeSetItemMutationOptions,
} from "@/lib/changeSetReactQuery"
import type { ProjectResource } from "@/lib/projectReactQuery"
import { projectOperationsQueryOptions } from "@/lib/projectReactQuery"
import {
	typeArtifactsQueryOptions,
	typeSchemaQueryOptions,
} from "@/lib/providerReactQuery"
import { queryClient } from "@/lib/query"
import type {
	RelatedCreateFieldRequest,
	RelatedCreateSource,
} from "@/lib/relatedResourceCreate"
import {
	readResourceMutationOptions,
	resourceQueryOptions,
} from "@/lib/resourceReactQuery"
import { cn, relativeTime } from "@/lib/utils"

type ResourceTab = "configuration" | "operations"

const VALID_TABS: ResourceTab[] = ["configuration", "operations"]

function coerceTab(v: unknown): ResourceTab | undefined {
	return typeof v === "string" && (VALID_TABS as string[]).includes(v)
		? (v as ResourceTab)
		: undefined
}

type ExistingResourceDetailProps = {
	projectSlug: string
	resourceSlug: string
	initialResource?: ProjectResource
	variant?: "page" | "sheet"
	onCreateReferenceTarget?: (request: {
		source: RelatedCreateSource
		targetEndpoint: RelatedCreateFieldRequest["targetEndpoint"]
	}) => void
}

type DraftResourceDetailProps = {
	projectSlug: string
	changeSetId?: string | null
	draftItem: ChangeSetItem
	onClose: () => void
	variant?: "sheet"
	onCreateReferenceTarget?: (request: {
		source: RelatedCreateSource
		targetEndpoint: RelatedCreateFieldRequest["targetEndpoint"]
	}) => void
}

type ResourceDetailProps =
	| ExistingResourceDetailProps
	| DraftResourceDetailProps

export function ResourceDetail(props: ResourceDetailProps) {
	const isDraft = "draftItem" in props
	const projectSlug = props.projectSlug
	const existingResourceSlug = isDraft ? "" : props.resourceSlug
	const initialResource = isDraft ? undefined : props.initialResource
	const draftItem = isDraft ? props.draftItem : null
	const changeSetId = isDraft ? props.changeSetId : null
	const onClose = isDraft ? props.onClose : undefined
	const variant = isDraft ? "sheet" : (props.variant ?? "page")
	const onCreateReferenceTarget = props.onCreateReferenceTarget

	const navigate = useNavigate()
	const searchTabParam = useRouterState({
		select: (s) => (s.location.search as { tab?: unknown }).tab,
	})
	const [selectedOperationId, setSelectedOperationId] = useState<string | null>(
		null,
	)
	const [editing, setEditing] = useState(false)
	const [selectedSectionValue, setSelectedSectionValue] = useState<
		string | null
	>(null)
	const [draftTab, setDraftTab] = useState<ResourceTab>("configuration")

	const existingResourceQuery = useQuery({
		...resourceQueryOptions({
			projectSlug,
			resourceSlug: existingResourceSlug,
		}),
		enabled: !isDraft,
		initialData:
			!isDraft && initialResource?.slug === existingResourceSlug
				? initialResource
				: undefined,
	})

	const draftDryRunQuery = useQuery(
		dryRunQueryOptions({
			projectSlug,
			changeSetId: changeSetId ?? "",
			itemId: draftItem?.id ?? "",
			initialData: draftItem?.dryRun ?? undefined,
			enabled: isDraft && !!changeSetId && !!draftItem,
		}),
	)

	const subject = useMemo<ResourceDetailSubject | null>(() => {
		if (draftItem)
			return {
				kind: "draft",
				resource: toDraftResource(draftItem),
			}
		return existingResourceQuery.data
			? { kind: "existing", resource: existingResourceQuery.data }
			: null
	}, [draftItem, existingResourceQuery.data])

	const resource = subject?.resource
	// Declared inputs drive edit mode + staging diffs (must stay `inputs`).
	const resourceValues = resource?.inputs ?? {}
	const displayValues = useMemo(
		() => computeDisplayValues(subject, draftDryRunQuery.data?.plannedState),
		[subject, draftDryRunQuery.data],
	)
	const editSeed = computeEditSeed(displayValues, resourceValues)
	const typeReady = !!resource?.provider && !!resource.type
	const schemaQuery = useQuery(
		typeSchemaQueryOptions({
			provider: resource?.provider ?? "",
			type: resource?.type ?? "",
			kind: "resource",
			enabled: typeReady,
		}),
	)
	const artifactsQuery = useQuery(
		typeArtifactsQueryOptions({
			provider: resource?.provider ?? "",
			type: resource?.type ?? "",
			kind: "resource",
			enabled: typeReady,
		}),
	)
	const view = useMemo(
		() =>
			resolveTypeView({
				schema: schemaQuery.data?.resource,
				artifacts: artifactsQuery.data ?? null,
			}) ?? undefined,
		[schemaQuery.data, artifactsQuery.data],
	)
	const sectionTabs = useMemo(() => getResourceDetailSections(view), [view])
	const resourceTab =
		subject?.kind === "draft"
			? draftTab
			: (coerceTab(searchTabParam) ?? "configuration")
	const selectedSection =
		sectionTabs.find((item) => item.value === selectedSectionValue) ??
		sectionTabs[0] ??
		null
	const tab =
		resourceTab === "configuration"
			? (selectedSection?.value ?? "configuration")
			: resourceTab
	const activeSection = sectionTabs.find((item) => item.value === tab)?.section
	const configurationSelected = resourceTab === "configuration"

	const operationsQuery = useQuery({
		...projectOperationsQueryOptions({
			slug: projectSlug,
			resourceSlug: resource?.slug ?? "",
			limit: 20,
		}),
		enabled: subject?.kind === "existing",
	})
	const refreshMutation = useMutation(
		readResourceMutationOptions({
			projectSlug,
			resourceSlug: resource?.slug ?? "",
			queryClient,
		}),
	)

	useEffect(() => {
		if (isDraft || !existingResourceSlug) return
		// setTimeout(0) defers past StrictMode's subscribe→unsubscribe→subscribe
		// cycle; calling mutate() directly in a mount effect orphans the v5
		// MutationObserver and the spinner sticks on pending forever.
		const id = setTimeout(() => refreshMutation.mutate(), 0)
		return () => clearTimeout(id)
	}, [existingResourceSlug, isDraft, refreshMutation.mutate])

	const stageUpdateMutation = useMutation({
		...stageChangeSetItemMutationOptions({
			projectSlug,
			queryClient,
		}),
		onSuccess: () => {
			toast.success("Update staged")
			setEditing(false)
		},
		onError: (err) =>
			toast.error(err instanceof Error ? err.message : "Failed to update"),
	})
	const updateDraftMutation = useMutation({
		...updateChangeSetItemMutationOptions({
			projectSlug,
			id: changeSetId ?? "",
			queryClient,
		}),
		onSuccess: () => {
			toast.success("Staged resource updated")
		},
		onError: (e) => renderTaggedError(toast, e),
	})
	const removeDraftMutation = useMutation({
		...deleteChangeSetItemMutationOptions({
			projectSlug,
			id: changeSetId ?? "",
			queryClient,
		}),
		onSuccess: () => {
			toast.success("Resource removed")
			onClose?.()
		},
		onError: (e) => renderTaggedError(toast, e),
	})

	const closeOperationSheet = useCallback(
		() => setSelectedOperationId(null),
		[],
	)
	const onTabChange = useCallback(
		(value: string) => {
			const next = coerceTab(value)
			if (!next) {
				setSelectedSectionValue(value)
			}
			if (subject?.kind === "draft") {
				setDraftTab(next ?? "configuration")
				return
			}
			navigate({
				to: ".",
				search: (prev) => ({
					...prev,
					tab: next ?? "configuration",
				}),
				replace: true,
			})
		},
		[navigate, subject?.kind],
	)

	if (!subject || !resource) {
		return (
			<ResourceDetailMessage>
				{existingResourceQuery.isError
					? "Couldn't load this resource"
					: "Loading resource…"}
			</ResourceDetailMessage>
		)
	}

	const submitConfiguration = (
		values: Record<string, unknown>,
		dirtyKeys: string[],
	) => {
		if (dirtyKeys.length === 0) {
			toast.info("No changes to stage")
			if (subject.kind === "existing") setEditing(false)
			return
		}
		// RHF owns "what changed"; layer only the edited fields onto the persisted
		// inputs so resolved defaults shown in the form aren't baked in.
		const edited = Object.fromEntries(
			dirtyKeys.map((key) => [key, values[key]]),
		)
		const persisted = pruneBlanks({ ...(resource.inputs ?? {}), ...edited })

		if (subject.kind === "draft") {
			updateDraftMutation.mutate({
				itemId: subject.resource.itemId,
				body: {
					kind:
						subject.resource.operation === "import"
							? "import_resource"
							: "create_resource",
					changes: buildDraftSubmitChanges(subject.resource, persisted),
				},
			})
			return
		}
		stageUpdateMutation.mutate({
			kind: "update_resource",
			targetResourceSlug: subject.resource.slug,
			changes: { inputs: persisted },
		})
	}

	// Existing-and-not-editing renders the full live provider state read-only
	// through the same layout/renderer; everything else is the editable inputs
	// form. One panel, one source of truth — view vs edit only swaps the values
	// fed in and the per-field disabled state.
	const viewing = subject.kind === "existing" && !editing
	const editPending =
		subject.kind === "draft"
			? updateDraftMutation.isPending
			: stageUpdateMutation.isPending

	return (
		<ResourceDetailFrame
			variant={variant}
			back={
				variant === "page" ? (
					<Button variant="ghost" size="sm" asChild className="mb-2">
						<Link to="/projects/$projectSlug" params={{ projectSlug }}>
							<ArrowLeft />
							Back to project
						</Link>
					</Button>
				) : null
			}
			hideTitle={variant === "sheet"}
			title={resource.slug}
			subtitle={
				subject.kind === "draft"
					? subject.resource.operation === "import"
						? "Import staged"
						: "Create staged"
					: `Updated ${relativeTime(subject.resource.updatedAt)}`
			}
			badges={
				subject.kind === "draft" ? (
					<span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-400">
						staged
					</span>
				) : subject.kind === "existing" ? (
					<ResourceStatusBadge status={subject.resource.status} />
				) : null
			}
			headerActions={
				editing ? undefined : (
					<>
						<Button
							size="icon-xs"
							variant="outline"
							className="size-7 rounded-md"
							onClick={() => {
								if (subject.kind !== "existing") return
								refreshMutation.mutate()
							}}
							disabled={subject.kind === "draft" || refreshMutation.isPending}
							aria-label="Refresh"
							title={
								subject.kind === "draft" ? "Available after deploy" : "Refresh"
							}
						>
							<RefreshCw
								className={cn(
									"size-3.5",
									refreshMutation.isPending && "animate-spin",
								)}
							/>
						</Button>
						{subject.kind === "draft" ? (
							<Button
								size="icon-xs"
								variant="destructive"
								className="size-7 rounded-md bg-[#e23a3a] text-white hover:bg-red-500 dark:bg-[#e23a3a] dark:hover:bg-red-500"
								onClick={() =>
									removeDraftMutation.mutate(subject.resource.itemId)
								}
								disabled={removeDraftMutation.isPending || !changeSetId}
								aria-label="Remove staged resource"
								title="Remove staged resource"
							>
								<Trash2 className="size-3.5" />
							</Button>
						) : (
							<StageResourceRemovalAction
								projectSlug={projectSlug}
								resourceSlug={subject.resource.slug}
							/>
						)}
					</>
				)
			}
			sectionTabs={sectionTabs}
			activeTab={tab}
			onTabChange={onTabChange}
			configurationSelected={configurationSelected}
			canEditConfiguration={
				subject.kind === "existing" &&
				subject.resource.provider !== null &&
				!editing
			}
			onEditConfiguration={() => setEditing(true)}
			configuration={
				<ResourceConfigurationPanel
					values={viewing ? (displayValues ?? null) : editSeed}
					displayValues={displayValues}
					view={view}
					provider={resource.provider}
					projectSlug={projectSlug}
					mode={viewing ? "view" : "edit"}
					activeSection={activeSection}
					onCreateReferenceTarget={
						onCreateReferenceTarget
							? (request) => {
									if (subject.kind === "draft") {
										onCreateReferenceTarget({
											targetEndpoint: request.targetEndpoint,
											source: {
												kind: "staged",
												stagedItemId: subject.resource.itemId,
												fieldPath: request.fieldPath,
												cardinality: request.cardinality,
												changes: buildDraftSubmitChanges(
													subject.resource,
													request.values,
												),
												returnMode: "detail",
											},
										})
										return
									}
									onCreateReferenceTarget({
										targetEndpoint: request.targetEndpoint,
										source: {
											kind: "live",
											resourceSlug: subject.resource.slug,
											fieldPath: request.fieldPath,
											cardinality: request.cardinality,
											values: request.values,
										},
									})
								}
							: undefined
					}
					onSubmit={submitConfiguration}
				/>
			}
			footer={
				variant === "sheet" && editing ? (
					<>
						<Button
							type="button"
							variant="outline"
							size="xs"
							className="h-7 px-3"
							onClick={() => setEditing(false)}
							disabled={editPending}
						>
							Cancel
						</Button>
						<Button
							type="submit"
							form={RESOURCE_EDIT_FORM_ID}
							size="xs"
							className="h-7 px-3"
							disabled={editPending}
						>
							{editPending && <Loader2 className="size-3.5 animate-spin" />}
							Save
						</Button>
					</>
				) : null
			}
			operations={
				subject.kind === "draft" ? (
					<ResourceDetailMessage className="min-h-[560px]">
						Operations will appear after this resource exists.
					</ResourceDetailMessage>
				) : operationsQuery.isLoading ? (
					<ResourceDetailMessage className="min-h-[560px]">
						Loading operations…
					</ResourceDetailMessage>
				) : (
					<ResourceOperationsTable
						operations={operationsQuery.data?.operations ?? []}
						onSelectOperation={setSelectedOperationId}
					/>
				)
			}
			operationDetail={
				subject.kind === "existing" ? (
					<OperationDetailSheet
						operationId={selectedOperationId}
						slug={projectSlug}
						onClose={closeOperationSheet}
					/>
				) : null
			}
		/>
	)
}
