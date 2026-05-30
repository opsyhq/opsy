import { AlertCircleIcon, Loader2Icon } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { ApiError } from "@/lib/thinking-block-api"

export function TableSkeleton({ columns = 6 }: { columns?: number }) {
	const columnIds = Array.from(
		{ length: columns },
		(_, index) => `column-${index}`,
	)
	return (
		<div className="space-y-2 border-y py-3">
			{[
				"row-one",
				"row-two",
				"row-three",
				"row-four",
				"row-five",
				"row-six",
				"row-seven",
			].map((row) => (
				<div
					className="grid gap-3 px-4"
					key={row}
					style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
				>
					{columnIds.map((column) => (
						<Skeleton className="h-7 rounded-md" key={column} />
					))}
				</div>
			))}
		</div>
	)
}

export function InlineSpinner({ label }: { label: string }) {
	return (
		<div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
			<Loader2Icon className="size-4 animate-spin" />
			<span>{label}</span>
		</div>
	)
}

export function EmptyState({ title }: { title: string }) {
	return (
		<div className="border-y px-4 py-12 text-center text-sm text-muted-foreground">
			{title}
		</div>
	)
}

export function ErrorState({ error }: { error: unknown }) {
	const notFound = error instanceof ApiError && error.status === 404
	return (
		<Alert variant={notFound ? "default" : "destructive"}>
			<AlertCircleIcon />
			<AlertTitle>{notFound ? "Not found" : "Request failed"}</AlertTitle>
			<AlertDescription>
				{error instanceof Error ? error.message : "Unable to load data."}
			</AlertDescription>
		</Alert>
	)
}
