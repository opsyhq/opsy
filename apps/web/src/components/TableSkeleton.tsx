import { Skeleton } from "@/components/ui/skeleton"

export function TableSkeleton({ rows = 3 }: { rows?: number }) {
	return (
		<div className="flex flex-col gap-2">
			{Array.from({ length: rows }, (_, i) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: skeleton rows are static placeholders
				<Skeleton key={i} className="h-10 w-full" />
			))}
		</div>
	)
}
