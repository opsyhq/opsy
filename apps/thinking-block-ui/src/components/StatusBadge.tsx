import { Badge } from "@/components/ui/badge"
import type { ArtifactStatus } from "@/lib/thinking-block-api"
import { cn } from "@/lib/utils"

const statusClasses: Record<ArtifactStatus, string> = {
	pending:
		"border-amber-300/60 bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200",
	running:
		"border-sky-300/60 bg-sky-50 text-sky-800 dark:bg-sky-500/15 dark:text-sky-200",
	ready:
		"border-emerald-300/60 bg-emerald-50 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200",
	rejected:
		"border-orange-300/60 bg-orange-50 text-orange-800 dark:bg-orange-500/15 dark:text-orange-200",
	failed:
		"border-red-300/60 bg-red-50 text-red-800 dark:bg-red-500/15 dark:text-red-200",
	superseded:
		"border-zinc-300/60 bg-zinc-100 text-zinc-700 dark:bg-zinc-500/15 dark:text-zinc-200",
}

export function StatusBadge({
	status,
	className,
}: {
	status: ArtifactStatus | string | null | undefined
	className?: string
}) {
	if (!status) return <span className="text-muted-foreground">-</span>
	return (
		<Badge
			variant="outline"
			className={cn(
				"rounded-md px-1.5 py-0 text-[0.7rem] font-medium capitalize",
				status in statusClasses
					? statusClasses[status as ArtifactStatus]
					: "border-border bg-muted text-muted-foreground",
				className,
			)}
		>
			{status}
		</Badge>
	)
}
