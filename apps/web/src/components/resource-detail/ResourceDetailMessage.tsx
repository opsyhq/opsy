import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

export function ResourceDetailMessage({
	children,
	className,
}: {
	children: ReactNode
	className?: string
}) {
	return (
		<div
			className={cn(
				"flex min-h-[240px] items-center justify-center text-center text-sm font-light text-muted-foreground/30",
				className,
			)}
		>
			{children}
		</div>
	)
}
