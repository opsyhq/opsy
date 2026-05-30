import { useQuery } from "@tanstack/react-query"
import { useEffect } from "react"
import { FloatingPanel } from "@/components/FloatingPanel"
import { ResourceDetail } from "@/components/ResourceDetail"
import { EmptyResourceEditor } from "@/components/resource-sheet/EmptyResourceEditor"
import {
	ProviderResourceEditor,
	ProviderResourceTitle,
} from "@/components/resource-sheet/ProviderResourceEditor"
import { StagedChangeBody } from "@/components/resource-sheet/StagedChangeBody"
import type { Integration } from "@/components/resource-sheet/shared"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import {
	activeChangeSetQueryOptions,
	type ChangeSet,
} from "@/lib/changeSetReactQuery"
import type {
	RelatedCreateFieldRequest,
	RelatedCreateSource,
} from "@/lib/relatedResourceCreate"
import {
	buildResourceSheetModel,
	type ResourceSheetTarget,
} from "./-ResourceSheet.logic"

export function ResourceSheet({
	projectSlug,
	integrations,
	target,
	onOpenChange,
	onConfigured,
	onCreateReferenceTarget,
}: {
	projectSlug: string
	integrations: Integration[]
	target: ResourceSheetTarget
	onOpenChange: (open: boolean) => void
	onConfigured: (stagedItemId: string, changeSet?: ChangeSet) => void
	onCreateReferenceTarget?: (request: {
		source: RelatedCreateSource
		targetEndpoint: RelatedCreateFieldRequest["targetEndpoint"]
	}) => void
}) {
	const { data: activeChangeSetData } = useQuery(
		activeChangeSetQueryOptions({ projectSlug }),
	)
	const activeChangeSet = activeChangeSetData?.draft ?? null
	const model = buildResourceSheetModel({
		target,
		items: activeChangeSet?.items ?? [],
	})

	useEffect(() => {
		if (
			!model.open ||
			!model.stagedItemId ||
			activeChangeSetData === undefined
		) {
			return
		}
		if (!model.stagedItem) onOpenChange(false)
	}, [
		activeChangeSetData,
		model.open,
		model.stagedItem,
		model.stagedItemId,
		onOpenChange,
	])

	// Create-like states (typed provider resources, empty resources, and
	// not-yet-staged drafts) share the same floating panel chrome; only the
	// inner editor differs.
	if (
		model.stagedProviderItem ||
		model.stagedEmptyItem ||
		model.resourceDraft
	) {
		const stagedProviderItem = model.stagedProviderItem
		const stagedEmptyItem = model.stagedEmptyItem
		const resourceDraft = model.resourceDraft
		return (
			<FloatingPanel
				open={model.open}
				onClose={() => onOpenChange(false)}
				title={
					stagedProviderItem && !model.showProviderDetail ? (
						<ProviderResourceTitle stagedItem={stagedProviderItem} />
					) : (
						model.providerPanelTitle
					)
				}
				placement="center"
				defaultWidth={800}
				defaultHeight={710}
				defaultHeightHint={710}
				minWidth={500}
				maxWidth={1200}
				// Center on the viewport rather than the canvas-between-rails area —
				// the create/edit editor reads as a focused modal task.
				leftOffset={0}
				rightOffset={0}
			>
				{stagedProviderItem && model.showProviderDetail ? (
					<ResourceDetail
						key={stagedProviderItem.id}
						projectSlug={projectSlug}
						changeSetId={activeChangeSet?.id}
						draftItem={stagedProviderItem}
						onClose={() => onOpenChange(false)}
						variant="sheet"
						onCreateReferenceTarget={onCreateReferenceTarget}
					/>
				) : stagedProviderItem ? (
					<ProviderResourceEditor
						key={stagedProviderItem.id}
						projectSlug={projectSlug}
						integrations={integrations}
						onClose={() => onOpenChange(false)}
						onSaved={(changeSet, stagedItemId) =>
							onConfigured(stagedItemId, changeSet)
						}
						onCreateReferenceTarget={onCreateReferenceTarget}
						changeSetId={activeChangeSet?.id}
						mode={{ kind: "edit", stagedItem: stagedProviderItem }}
					/>
				) : resourceDraft ? (
					<ProviderResourceEditor
						key={resourceDraft.slug}
						projectSlug={projectSlug}
						integrations={integrations}
						onClose={() => onOpenChange(false)}
						onSaved={(changeSet, stagedItemId) =>
							onConfigured(stagedItemId, changeSet)
						}
						changeSetId={activeChangeSet?.id}
						mode={{ kind: "draft", draft: resourceDraft }}
					/>
				) : stagedEmptyItem ? (
					<EmptyResourceEditor
						key={stagedEmptyItem.id}
						projectSlug={projectSlug}
						changeSetId={activeChangeSet?.id}
						stagedItem={stagedEmptyItem}
						onClose={() => onOpenChange(false)}
					/>
				) : null}
			</FloatingPanel>
		)
	}

	return (
		<Sheet open={model.open} onOpenChange={onOpenChange} modal={false}>
			<SheetContent
				showOverlay={false}
				showCloseButton={false}
				className="sm:max-w-xl flex flex-col p-0 gap-0"
				onPointerDownOutside={(event) => event.preventDefault()}
				onInteractOutside={(event) => event.preventDefault()}
				onEscapeKeyDown={(event) => event.preventDefault()}
			>
				{model.stagedItem ? (
					<StagedChangeBody
						projectSlug={projectSlug}
						changeSetId={activeChangeSet?.id}
						stagedItem={model.stagedItem}
						onClose={() => onOpenChange(false)}
					/>
				) : null}
			</SheetContent>
		</Sheet>
	)
}
