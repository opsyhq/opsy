import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

// Keyed by the derived `ResourceDisplayStatus` set. In-flight verbs share the
// amber "work happening" tone; `staged` is the clean-preview green.
export const statusColors: Record<string, string> = {
	live: "border-[#53D37D]/30 bg-[#53D37D]/10 text-[#53D37D]",
	staged: "border-[#53D37D]/30 bg-[#53D37D]/10 text-[#53D37D]",
	pending: "border-yellow-500/30 bg-yellow-500/10 text-yellow-700",
	creating: "border-yellow-500/30 bg-yellow-500/10 text-yellow-700",
	updating: "border-yellow-500/30 bg-yellow-500/10 text-yellow-700",
	deleting: "border-yellow-500/30 bg-yellow-500/10 text-yellow-700",
	importing: "border-yellow-500/30 bg-yellow-500/10 text-yellow-700",
	failed: "border-[#E94957]/30 bg-[#E94957]/10 text-[#E94957]",
	deleted: "border-muted-foreground/30 bg-muted text-muted-foreground",
	missing: "border-orange-500/30 bg-orange-500/10 text-orange-700",
}

export function ResourceStatusBadge({ status }: { status: string }) {
	return (
		<Badge variant="outline" className={cn(statusColors[status])}>
			{status}
		</Badge>
	)
}

export const operationStatusTextColors: Record<string, string> = {
	succeeded: "text-[#53D37D]",
	failed: "text-[#E94957]",
	running: "text-blue-500",
	pending: "text-yellow-500",
	awaiting_approval: "text-orange-500",
	canceling: "text-yellow-500",
	canceled: "text-muted-foreground",
}

export const operationStatusColors: Record<string, string> = {
	succeeded: "border-[#53D37D]/30 bg-[#53D37D]/10 text-[#53D37D]",
	failed: "border-[#E94957]/30 bg-[#E94957]/10 text-[#E94957]",
	running: "border-blue-500/30 bg-blue-500/10 text-blue-700",
	pending: "border-yellow-500/30 bg-yellow-500/10 text-yellow-700",
	awaiting_approval: "border-orange-500/30 bg-orange-500/10 text-orange-700",
	canceling: "border-yellow-500/30 bg-yellow-500/10 text-yellow-700",
	canceled: "border-muted-foreground/30 bg-muted text-muted-foreground",
}

export function OperationStatusBadge({ status }: { status: string }) {
	return (
		<span
			className={cn(
				"text-xs",
				operationStatusTextColors[status] ?? "text-muted-foreground",
			)}
		>
			{status.replace("_", " ")}
		</span>
	)
}

export const operationKindColors: Record<string, string> = {
	create: "border-[#5C9DFF]/30 bg-[#5C9DFF]/10 text-[#5C9DFF]",
	update: "border-[#A875FF]/30 bg-[#A875FF]/10 text-[#A875FF]",
	delete: "border-[#F97316]/30 bg-[#F97316]/10 text-[#F97316]",
	read: "border-[#38BDF8]/30 bg-[#38BDF8]/10 text-[#38BDF8]",
	import: "border-[#D946EF]/30 bg-[#D946EF]/10 text-[#D946EF]",
	lookup: "border-[#818CF8]/30 bg-[#818CF8]/10 text-[#818CF8]",
	scan: "border-[#14B8A6]/30 bg-[#14B8A6]/10 text-[#14B8A6]",
}

export function OperationKindBadge({ kind }: { kind: string }) {
	return (
		<Badge variant="outline" className={cn(operationKindColors[kind])}>
			{kind}
		</Badge>
	)
}
