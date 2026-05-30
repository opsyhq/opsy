import { useQuery } from "@tanstack/react-query"
import { Copy } from "lucide-react"
import { toast } from "sonner"
import { FloatingPanel } from "@/components/FloatingPanel"
import {
	ACTIVITY_RAIL_WIDTH_COLLAPSED,
	PANEL_EDGE_INSET,
	RESOURCE_DETAIL_SHEET_WIDTH,
} from "@/components/layout/railWidths"
import {
	OperationKindBadge,
	OperationStatusBadge,
} from "@/components/StatusBadge"
import { Skeleton } from "@/components/ui/skeleton"
import { operationQueryOptions } from "@/lib/operationReactQuery"
import { relativeTime } from "@/lib/utils"
import { OPERATION_STATUS_REGISTRY } from "./registry"

export function OperationDetailSheet({
	operationId,
	slug,
	onClose,
}: {
	operationId: string | null
	slug: string
	onClose: () => void
}) {
	const { data, isLoading } = useQuery(
		operationQueryOptions({ id: operationId ?? "", enabled: !!operationId }),
	)

	const operation = data?.operation
	const resourceSlug = data?.resource?.slug ?? "project"

	// Sit immediately left of the resource-detail sheet, leaving the same gap
	// that sheet leaves to the collapsed activity rail (PANEL_EDGE_INSET).
	const rightOffset =
		RESOURCE_DETAIL_SHEET_WIDTH +
		ACTIVITY_RAIL_WIDTH_COLLAPSED +
		PANEL_EDGE_INSET

	const entry = operation ? OPERATION_STATUS_REGISTRY[operation.status] : null

	return (
		<FloatingPanel
			open={!!operationId}
			onClose={onClose}
			title={
				<span className="flex min-w-0 items-center gap-2">
					<span className="truncate font-mono">{resourceSlug}</span>
					{operation ? <OperationKindBadge kind={operation.kind} /> : null}
				</span>
			}
			headerRight={
				operation ? (
					<span className="text-[11px] font-light text-muted-foreground">
						{relativeTime(operation.createdAt)}
					</span>
				) : undefined
			}
			defaultWidth={380}
			minWidth={380}
			maxWidth={800}
			defaultHeight="fill"
			rightOffset={rightOffset}
			topOffset={44}
			bodyClassName="flex flex-col"
		>
			{isLoading ? (
				<div className="flex flex-col gap-3 px-4 py-4">
					<Skeleton className="h-6 w-32" />
					<Skeleton className="h-20 w-full" />
					<Skeleton className="h-20 w-full" />
				</div>
			) : operation && entry ? (
				<div className="flex min-h-0 flex-1 flex-col gap-3 px-4 pb-6">
					<div className="flex items-center gap-3 py-1 text-sm">
						<OperationStatusBadge status={operation.status} />
						<button
							type="button"
							onClick={() => {
								if (!operationId) return
								navigator.clipboard.writeText(operationId)
								toast.success("Operation ID copied")
							}}
							className="ml-auto text-muted-foreground transition-colors hover:text-foreground"
							title="Copy operation ID"
							aria-label="Copy operation ID"
						>
							<Copy className="size-3.5" />
						</button>
					</div>
					<entry.Panel
						key={operation.id}
						operation={operation}
						projectSlug={slug}
					/>
				</div>
			) : null}
		</FloatingPanel>
	)
}
