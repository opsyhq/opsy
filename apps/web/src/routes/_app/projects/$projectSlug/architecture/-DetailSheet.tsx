import { Suspense } from "react"
import { FloatingPanel } from "@/components/FloatingPanel"
import {
	ACTIVITY_RAIL_WIDTH_COLLAPSED,
	APP_RAIL_WIDTH_OPEN,
	RESOURCE_DETAIL_SHEET_WIDTH,
} from "@/components/layout/railWidths"
import { ResourceDetail } from "@/components/ResourceDetail"
import { ResourceStatusBadge } from "@/components/StatusBadge"
import { Skeleton } from "@/components/ui/skeleton"
import { type ChangeSetItem, changesRecord } from "@/lib/changeSetReactQuery"
import type { ProjectResource } from "@/lib/projectReactQuery"
import type {
	RelatedCreateFieldRequest,
	RelatedCreateSource,
} from "@/lib/relatedResourceCreate"
import { relativeTime } from "@/lib/utils"

export function DetailSheet({
	projectSlug,
	resourceSlug,
	resource,
	stagedItem,
	changeSetId,
	onClose,
	onCreateReferenceTarget,
}: {
	projectSlug: string
	resourceSlug: string | undefined
	resource?: ProjectResource
	stagedItem?: ChangeSetItem | null
	changeSetId?: string | null
	onClose: () => void
	onCreateReferenceTarget?: (request: {
		source: RelatedCreateSource
		targetEndpoint: RelatedCreateFieldRequest["targetEndpoint"]
	}) => void
}) {
	const open = !!resourceSlug || !!stagedItem
	const stagedChanges = stagedItem ? changesRecord(stagedItem) : null
	const stagedTitle =
		typeof stagedChanges?.slug === "string"
			? stagedChanges.slug
			: (stagedItem?.resourceType ?? stagedItem?.id)

	return (
		<FloatingPanel
			open={open}
			onClose={onClose}
			panelClassName="opsy-resource-detail-panel rounded-lg border-border bg-background"
			dividerClassName="border-border"
			bodyClassName="scrollbar-soft"
			closeButtonClassName="hover:bg-transparent dark:hover:bg-transparent"
			title={
				resource ? (
					<span className="inline-flex items-center gap-2">
						<span>{resource.slug}</span>
						<ResourceStatusBadge status={resource.status} />
					</span>
				) : (
					(resourceSlug ?? stagedTitle ?? "Resource")
				)
			}
			headerRight={
				resource ? (
					<span className="text-xs text-muted-foreground">
						Updated {relativeTime(resource.updatedAt)}
					</span>
				) : undefined
			}
			placement="top-right"
			defaultWidth={RESOURCE_DETAIL_SHEET_WIDTH}
			defaultHeight="fill"
			minWidth={500}
			maxWidth={1200}
			disableDragging
			topOffset={44}
			leftOffset={APP_RAIL_WIDTH_OPEN}
			rightOffset={ACTIVITY_RAIL_WIDTH_COLLAPSED}
		>
			{resourceSlug ? (
				<Suspense
					fallback={
						<div className="flex flex-col gap-3 px-4 py-4">
							<Skeleton className="h-6 w-40" />
							<Skeleton className="h-24 w-full" />
							<Skeleton className="h-24 w-full" />
						</div>
					}
				>
					<ResourceDetail
						key={resourceSlug}
						projectSlug={projectSlug}
						resourceSlug={resourceSlug}
						initialResource={resource}
						variant="sheet"
						onCreateReferenceTarget={onCreateReferenceTarget}
					/>
				</Suspense>
			) : stagedItem ? (
				<ResourceDetail
					key={stagedItem.id}
					projectSlug={projectSlug}
					changeSetId={changeSetId}
					draftItem={stagedItem}
					onClose={onClose}
					variant="sheet"
					onCreateReferenceTarget={onCreateReferenceTarget}
				/>
			) : null}
		</FloatingPanel>
	)
}
