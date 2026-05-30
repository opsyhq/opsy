import type { LucideIcon } from "lucide-react"

export function EmptyState({
	icon: Icon,
	title,
	description,
	children,
}: {
	icon: LucideIcon
	title: string
	description?: string
	children?: React.ReactNode
}) {
	return (
		<div className="flex flex-col items-center justify-center py-12 text-center">
			<Icon
				className="size-11 text-muted-foreground/30"
				strokeWidth={1.25}
			/>
			<h3 className="mt-2 text-lg font-light text-muted-foreground/30">
				{title}
			</h3>
			{description && (
				<p className="mt-1 text-sm text-muted-foreground">{description}</p>
			)}
			{children}
		</div>
	)
}
