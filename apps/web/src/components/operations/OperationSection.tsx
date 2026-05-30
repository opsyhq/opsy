import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

export function OperationSection({
	title,
	children,
	className,
	bodyClassName,
}: {
	title: string
	children: ReactNode
	className?: string
	bodyClassName?: string
}) {
	return (
		<div className={cn("flex min-h-0 flex-col gap-1.5", className)}>
			<span className="text-sm font-medium text-foreground">{title}</span>
			<div
				className={cn(
					"overflow-hidden rounded-lg border border-border bg-background",
					bodyClassName,
				)}
			>
				{children}
			</div>
		</div>
	)
}
