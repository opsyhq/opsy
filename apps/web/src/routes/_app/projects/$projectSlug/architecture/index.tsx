import { isOpsyError } from "@opsy/contracts/errors"
import { useSuspenseQuery } from "@tanstack/react-query"
import {
	createFileRoute,
	type ErrorComponentProps,
	useNavigate,
} from "@tanstack/react-router"
import { ReactFlowProvider, type Viewport } from "@xyflow/react"
import { AlertTriangle, Download, Plus } from "lucide-react"
import { useCallback, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { useRightRailSlot } from "@/components/layout/RightRailSlot"
import { OperationDetailSheet } from "@/components/operations/OperationDetailSheet"
import type { OperationFiltersValue } from "@/components/operations/OperationFilters"
import { isCreateLikeStagedItem } from "@/components/resource-sheet/shared"
import { TableSkeleton } from "@/components/TableSkeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
	activeChangeSetQueryOptions,
	changesRecord,
} from "@/lib/changeSetReactQuery"
import {
	projectIntegrationsQueryOptions,
	projectOperationsQueryOptions,
	projectResourcesQueryOptions,
} from "@/lib/projectReactQuery"
import { typeArtifactsQueryOptions } from "@/lib/providerReactQuery"
import { ActivityRail } from "./-ActivityRail"
import { nextStagedResourcePosition } from "./-canvasPlacement"
import { DeployingBars } from "./-DeployingBar"
import { DetailSheet } from "./-DetailSheet"
import { useCanvasModel } from "./-hooks/useCanvasModel"
import { ImportDialog } from "./-ImportDialog"
import { NodeSearch } from "./-NodeSearch"
import { ResourceCanvas } from "./-ResourceCanvas"
import { ResourceCreateDialog } from "./-ResourceCreateDialog"
import { ResourceSheet } from "./-ResourceSheet"
import { StagedChangesBar } from "./-StagedChangesBar"
import {
	type ArchitectureDetail,
	type ArchitectureSearch,
	architectureSearchSchema,
	detailFromSearch,
	detailToSearch,
} from "./-search"
import { useApplyCompletionToast } from "./-useApplyCompletionToast"
import { useRelatedCreateOrchestrator } from "./-useRelatedCreateOrchestrator"

export const Route = createFileRoute(
	"/_app/projects/$projectSlug/architecture/",
)({
	validateSearch: architectureSearchSchema,
	loader: ({ context, params }) => {
		const slug = params.projectSlug
		const resourcesThenArtifacts = context.queryClient
			.ensureQueryData(projectResourcesQueryOptions({ slug }))
			.then((data) =>
				Promise.all(
					Object.values(
						data.resources.reduce<
							Record<
								string,
								{ provider: string; type: string; kind: "resource" }
							>
						>(
							(acc, r) =>
								r.provider
									? {
											...acc,
											[`${r.provider}:${r.type}`]: {
												provider: r.provider,
												type: r.type,
												kind: "resource" as const,
											},
										}
									: acc,
							{},
						),
					).map((entry) =>
						context.queryClient.ensureQueryData(
							typeArtifactsQueryOptions(entry),
						),
					),
				),
			)
		return Promise.all([
			resourcesThenArtifacts,
			// Canvas reads in-flight ops for changeset item runtime; rail filters must
			// not narrow this set, so the route loads it unfiltered. Activity rail
			// owns its own filtered query separately.
			context.queryClient.ensureQueryData(
				projectOperationsQueryOptions({ slug }),
			),
			context.queryClient.ensureQueryData(
				projectIntegrationsQueryOptions({ slug }),
			),
			context.queryClient.ensureQueryData(
				activeChangeSetQueryOptions({ projectSlug: slug }),
			),
		])
	},
	component: ArchitectureView,
	pendingComponent: () => <TableSkeleton />,
	errorComponent: ArchitectureError,
})

function ArchitectureError({ error, reset }: ErrorComponentProps) {
	const tag = isOpsyError(error) ? error._tag : null
	const message = error instanceof Error ? error.message : String(error)
	return (
		<div className="flex h-full min-h-0 min-w-0 flex-1 items-center justify-center overflow-hidden px-6 py-8">
			<Alert
				variant="destructive"
				className="max-h-full max-w-lg overflow-hidden"
			>
				<AlertTriangle />
				<AlertTitle>Couldn't load this project</AlertTitle>
				<AlertDescription>
					<p className="max-h-64 overflow-y-auto whitespace-pre-wrap break-all font-mono text-xs">
						{message}
					</p>
					{tag ? (
						<p className="text-muted-foreground text-xs">Code: {tag}</p>
					) : null}
					<Button size="sm" variant="outline" onClick={reset}>
						Retry
					</Button>
				</AlertDescription>
			</Alert>
		</div>
	)
}

function ArchitectureView() {
	const { projectSlug } = Route.useParams()
	const search = Route.useSearch()
	const detail = Route.useSearch({ select: detailFromSearch })
	const navigate = useNavigate({ from: Route.fullPath })
	const rightRailSlot = useRightRailSlot()

	const createOpen = search.create === true
	const importOpen = search.import === true || !!search.importIntegrationSlug

	const patchSearch = useCallback(
		(patch: Partial<ArchitectureSearch>) => {
			navigate({
				to: ".",
				search: (prev) => ({ ...prev, ...patch }) as ArchitectureSearch,
				replace: true,
			})
		},
		[navigate],
	)

	const setDetail = useCallback(
		(next: ArchitectureDetail | undefined) => patchSearch(detailToSearch(next)),
		[patchSearch],
	)
	const closeDetail = useCallback(() => setDetail(undefined), [setDetail])
	const openAppliedDetail = useCallback(
		(resourceSlug: string) => setDetail({ kind: "applied", resourceSlug }),
		[setDetail],
	)
	const openStagedDetail = useCallback(
		(stagedItemId: string) =>
			setDetail({ kind: "staged", stagedItemId, mode: "detail" }),
		[setDetail],
	)
	const openCreate = useCallback(
		() => patchSearch({ create: true }),
		[patchSearch],
	)
	const openImport = useCallback(
		() => patchSearch({ import: true }),
		[patchSearch],
	)
	const setImportOpen = useCallback(
		(open: boolean) => {
			if (open) {
				patchSearch({ import: true })
			} else {
				// Clear the integration-stage param when the dialog closes so the URL
				// doesn't reopen the sheet on next visit.
				patchSearch({ import: undefined, importIntegrationSlug: undefined })
			}
		},
		[patchSearch],
	)

	const { data: resourcesData } = useSuspenseQuery(
		projectResourcesQueryOptions({ slug: projectSlug }),
	)
	const { data: operationsData } = useSuspenseQuery(
		projectOperationsQueryOptions({ slug: projectSlug }),
	)
	const { data: integrationsData } = useSuspenseQuery(
		projectIntegrationsQueryOptions({ slug: projectSlug }),
	)
	const { data: activeChangeSetData } = useSuspenseQuery(
		activeChangeSetQueryOptions({ projectSlug }),
	)
	const activeChangeSet = activeChangeSetData.draft

	useApplyCompletionToast(projectSlug)
	const integrations = integrationsData.integrations
	const canvasModel = useCanvasModel({
		appliedResources: resourcesData.resources,
		draft: activeChangeSetData.draft,
		applying: activeChangeSetData.applying,
		openOperations: operationsData.operations,
	})
	// Applied resources with staged-fallback positions, surfaced for sibling UI
	// (search, dialogs, detail-sheet lookup). The canvas reads its own
	// projected list off canvasModel.resources.
	const resources = canvasModel.appliedResources
	const initialCreatePosition = useMemo(() => {
		const previewIndex = (activeChangeSet?.items ?? []).filter(
			(item) =>
				item.kind === "create_resource" || item.kind === "import_resource",
		).length
		return nextStagedResourcePosition({ resources, previewIndex })
	}, [activeChangeSet, resources])
	// `mode` distinguishes import framing ("fit": center on viewport, no panel
	// is open) from create-save framing ("panel": account for the detail panel
	// that opens on the right). See useCanvasSelection.
	const [pendingFocus, setPendingFocus] = useState<{
		slug: string
		mode: "fit" | "panel"
	} | null>(null)
	const stagedResourceDetailItem = useMemo(() => {
		if (detail?.kind !== "staged" || detail.mode !== "detail") {
			return null
		}
		const item = activeChangeSet?.items.find(
			(candidate) => candidate.id === detail.stagedItemId,
		)
		if (!item || !isCreateLikeStagedItem(item)) return null
		return typeof changesRecord(item).type === "string" ? item : null
	}, [activeChangeSet, detail])
	const relatedCreate = useRelatedCreateOrchestrator({
		projectSlug,
		changeSet: activeChangeSet,
		detail,
		stagedResourceDetailOpen: !!stagedResourceDetailItem,
		onResourceFocusRequested: (slug) => setPendingFocus({ slug, mode: "panel" }),
	})

	const resourceSlugById = useMemo(
		() => new Map(resources.map((r) => [r.id, r.slug])),
		[resources],
	)

	// Remember the last canvas viewport so re-mounts of ResourceCanvas open at
	// the same pan/zoom. ReactFlow reads `defaultViewport` once on mount.
	const viewportRef = useRef<Viewport | null>(null)
	const onViewportChange = useCallback((viewport: Viewport) => {
		viewportRef.current = viewport
	}, [])

	const onFocusConsumed = useCallback(() => setPendingFocus(null), [])

	const onFiltersChange = useCallback(
		(patch: Partial<OperationFiltersValue>) => {
			navigate({
				to: ".",
				search: (prev) => ({ ...prev, ...patch }) as ArchitectureSearch,
			})
		},
		[navigate],
	)

	const onSelectOperation = useCallback(
		(id: string | null) => {
			patchSearch({ op: id ?? undefined })
		},
		[patchSearch],
	)

	const closeOperationSheet = useCallback(
		() => onSelectOperation(null),
		[onSelectOperation],
	)
	const selectedResourceSlug =
		detail?.kind === "applied" ? detail.resourceSlug : null

	const filtersForRail: OperationFiltersValue = {
		operationResource: search.operationResource,
		operationKind: search.operationKind,
		operationStatus: search.operationStatus,
		operationLimit: search.operationLimit,
	}

	return (
		<ReactFlowProvider>
			<div className="flex min-w-0 flex-1 [&_button]:!rounded-lg">
				<div className="relative flex min-w-0 flex-1 flex-col">
					<div className="pointer-events-none absolute top-0 right-3 z-30 flex h-14 items-center gap-2">
						<div className="pointer-events-auto">
							<NodeSearch resources={resources} />
						</div>
						<Button
							size="icon-sm"
							aria-label="Add Resource"
							onClick={openCreate}
							disabled={integrations.length === 0}
							title={
								integrations.length === 0
									? "Create an integration first"
									: "Add Resource"
							}
							className="pointer-events-auto"
						>
							<Plus className="size-3.5" />
						</Button>
						<Button
							size="icon-sm"
							variant="outline"
							aria-label="Import"
							onClick={openImport}
							disabled={integrations.length === 0}
							title="Import"
							className="pointer-events-auto border bg-canvas-bg hover:bg-canvas-bg dark:bg-canvas-bg dark:hover:bg-canvas-bg"
						>
							<Download className="size-3.5" />
						</Button>
					</div>
					<ResourceCanvas
						projectSlug={projectSlug}
						model={canvasModel}
						onSelectStagedItem={openStagedDetail}
						onSelectResource={openAppliedDetail}
						defaultViewport={viewportRef.current ?? undefined}
						onViewportChange={onViewportChange}
						pendingFocusSlug={pendingFocus?.slug ?? null}
						pendingFocusMode={pendingFocus?.mode}
						onFocusConsumed={onFocusConsumed}
					/>
					<DeployingBars projectSlug={projectSlug} />
					{activeChangeSet?.status === "draft" &&
						activeChangeSet.items.length > 0 && (
							<StagedChangesBar
								projectSlug={projectSlug}
								changeSet={activeChangeSet}
							/>
						)}
				</div>

				{rightRailSlot &&
					createPortal(
						<ActivityRail
							projectSlug={projectSlug}
							filters={filtersForRail}
							onFiltersChange={onFiltersChange}
							selectedOperationId={search.op ?? null}
							onSelectOperation={onSelectOperation}
							resourceSlugById={resourceSlugById}
						/>,
						rightRailSlot,
					)}

				<DetailSheet
					projectSlug={projectSlug}
					resourceSlug={selectedResourceSlug ?? undefined}
					resource={
						resourcesData.resources.find(
							(resource) => resource.slug === selectedResourceSlug,
						) ?? undefined
					}
					stagedItem={stagedResourceDetailItem}
					changeSetId={activeChangeSet?.id}
					onClose={closeDetail}
					onCreateReferenceTarget={relatedCreate.start}
				/>

				<OperationDetailSheet
					operationId={search.op ?? null}
					slug={projectSlug}
					onClose={closeOperationSheet}
				/>

				<ImportDialog
					projectSlug={projectSlug}
					integrations={integrations}
					open={importOpen}
					onOpenChange={setImportOpen}
					initialIntegrationSlug={search.importIntegrationSlug}
					initialPosition={initialCreatePosition}
					onImported={(slug) => setPendingFocus({ slug, mode: "fit" })}
				/>

				<ResourceCreateDialog
					projectSlug={projectSlug}
					integrations={integrations}
					open={createOpen}
					onOpenChange={relatedCreate.onCreateDialogOpenChange}
					onStagedItem={relatedCreate.onCreateDialogStagedItem}
					onDraftReady={relatedCreate.onCreateDialogDraftReady}
					initialPosition={initialCreatePosition}
					relatedTarget={relatedCreate.createDialogTarget}
				/>

				<ResourceSheet
					projectSlug={projectSlug}
					integrations={integrations}
					target={relatedCreate.resourceSheetTarget}
					onOpenChange={relatedCreate.onResourceSheetOpenChange}
					onConfigured={relatedCreate.onTargetConfigured}
					onCreateReferenceTarget={relatedCreate.start}
				/>
			</div>
		</ReactFlowProvider>
	)
}
