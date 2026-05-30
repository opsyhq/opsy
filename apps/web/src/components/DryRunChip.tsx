import { Badge } from "@/components/ui/badge"
import type { ResourceDryRun } from "@/lib/changeSetReactQuery"
import { cn } from "@/lib/utils"
import { operationStatusColors, statusColors } from "./StatusBadge"

export function isAlarmingDryRun(dryRun: ResourceDryRun | null): boolean {
	if (!dryRun) return false
	return (
		dryRun.action === "error" ||
		dryRun.action === "replace" ||
		dryRun.action === "deferred"
	)
}

export function DryRunChip({
	dryRun,
	className,
}: {
	dryRun: ResourceDryRun | null
	className?: string
}) {
	if (!dryRun) return null
	if (dryRun.action === "error") {
		return (
			<Badge
				variant="outline"
				title={dryRun.error?.message}
				className={cn(operationStatusColors.failed, className)}
			>
				Dry run error
			</Badge>
		)
	}
	if (dryRun.action === "deferred") {
		return (
			<Badge variant="outline" className={cn(statusColors.deleted, className)}>
				Waiting
			</Badge>
		)
	}
	return null
}

export function DryRunErrorNote({
	dryRun,
	className,
}: {
	dryRun: ResourceDryRun | null
	className?: string
}) {
	const message = dryRun?.error?.message
	if (!message) return null
	const isError = dryRun.action === "error"
	const tone = isError
		? "border-destructive/30 bg-destructive/5"
		: "border-muted-foreground/30 bg-muted/30 text-muted-foreground"
	const heading = isError ? "Dry run error" : "Waiting on dependencies"
	return (
		<div className={cn("rounded-md border px-3 py-2 text-xs", tone, className)}>
			<div className="font-medium">{heading}</div>
			<div className="mt-1 font-mono break-words whitespace-pre-wrap">
				{message}
			</div>
		</div>
	)
}
