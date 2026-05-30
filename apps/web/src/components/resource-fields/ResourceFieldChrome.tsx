import { AlertTriangle, CircleHelp } from "lucide-react"
import { cloneElement, type ReactElement } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip"

export function FieldHelpLabel({
	label,
	help,
}: {
	label: string
	help?: string
}) {
	if (!help)
		return <span className="min-w-0 cursor-default truncate">{label}</span>
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<span
					className="min-w-0 cursor-default truncate hover:text-foreground"
					aria-label={`Field help for ${label}`}
				>
					{label}
				</span>
			</TooltipTrigger>
			<TooltipContent className="max-w-xs">{help}</TooltipContent>
		</Tooltip>
	)
}

export function FieldHelpWrap({
	label,
	help,
	children,
}: {
	label: string
	help?: string
	children: ReactElement
}) {
	if (!help) return children
	// Carry the accessible help affordance onto the trigger itself, matching
	// FieldHelpLabel/FieldHelpTooltip. The help text otherwise lives only in
	// portaled TooltipContent — unreachable for screen readers (and static
	// render) until hover.
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				{cloneElement(children as ReactElement<{ "aria-label"?: string }>, {
					"aria-label": `Field help for ${label}`,
				})}
			</TooltipTrigger>
			<TooltipContent className="max-w-xs">{help}</TooltipContent>
		</Tooltip>
	)
}

export function FieldHelpTooltip({
	label,
	help,
}: {
	label: string
	help?: string
}) {
	if (!help) return null
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<Button
					type="button"
					size="icon-xs"
					variant="ghost"
					className="size-5 cursor-help rounded-sm text-muted-foreground hover:text-foreground"
					aria-label={`Field help for ${label}`}
				>
					<CircleHelp className="size-3.5" />
				</Button>
			</TooltipTrigger>
			<TooltipContent className="max-w-xs">{help}</TooltipContent>
		</Tooltip>
	)
}

export function DeprecatedBadge() {
	return (
		<Badge
			variant="outline"
			className="gap-1 border-amber-500/50 text-[10px] text-amber-600 dark:text-amber-400"
		>
			<AlertTriangle className="size-3" />
			deprecated
		</Badge>
	)
}
