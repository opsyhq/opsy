import { ResourceDetailMessage } from "@/components/resource-detail/ResourceDetailMessage"
import {
	OperationKindBadge,
	OperationStatusBadge,
} from "@/components/StatusBadge"
import { relativeTime } from "@/lib/utils"

type ResourceOperation = {
	id: string
	kind: string
	status: string
	createdAt: string
}

export function ResourceOperationsTable({
	operations,
	onSelectOperation,
}: {
	operations: ResourceOperation[]
	onSelectOperation: (id: string) => void
}) {
	if (operations.length === 0) {
		return (
			<ResourceDetailMessage className="min-h-[560px]">
				No operations for this resource yet.
			</ResourceDetailMessage>
		)
	}
	return (
		<div className="grid gap-2">
			<div className="grid grid-cols-3 items-center gap-2 px-3 text-sm font-medium text-foreground">
				<span>Kind</span>
				<span>Status</span>
				<span>Created</span>
			</div>
			<div className="divide-y divide-border overflow-hidden rounded-lg border border-border">
				{operations.map((a) => (
					<button
						key={a.id}
						type="button"
						onClick={() => onSelectOperation(a.id)}
						className="grid w-full cursor-pointer grid-cols-3 items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-border"
					>
						<span className="min-w-0">
							<OperationKindBadge kind={a.kind} />
						</span>
						<span className="min-w-0">
							<OperationStatusBadge status={a.status} />
						</span>
						<span className="min-w-0 text-xs text-muted-foreground">
							{relativeTime(a.createdAt)}
						</span>
					</button>
				))}
			</div>
		</div>
	)
}
