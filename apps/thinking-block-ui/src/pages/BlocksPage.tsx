import { useInfiniteQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { useCallback, useDeferredValue, useState } from "react"
import { ListFiltersBar } from "@/components/ListFilters"
import {
	EmptyState,
	ErrorState,
	InlineSpinner,
	TableSkeleton,
} from "@/components/PageState"
import { Button } from "@/components/ui/button"
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table"
import { formatDateTime, formatDuration } from "@/lib/format"
import { getBlocks, type ListFilters } from "@/lib/thinking-block-api"
import { useInfiniteSentinel } from "@/lib/use-infinite-sentinel"

export function BlocksPage() {
	const [filters, setFilters] = useState<ListFilters>({ status: "all" })
	const deferredFilters = useDeferredValue(filters)
	const query = useInfiniteQuery({
		queryKey: ["thinking-blocks", deferredFilters],
		initialPageParam: null as string | null,
		queryFn: ({ pageParam }) =>
			getBlocks({ ...deferredFilters, cursor: pageParam, limit: 50 }),
		getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
		refetchInterval: (state) =>
			state.state.data?.pages.some((page) =>
				page.blocks.some(
					(block) =>
						block.statusCounts.pending > 0 || block.statusCounts.running > 0,
				),
			)
				? 2000
				: false,
	})
	const blocks = query.data?.pages.flatMap((page) => page.blocks) ?? []
	const loadMore = useCallback(() => {
		if (query.hasNextPage && !query.isFetchingNextPage) {
			void query.fetchNextPage()
		}
	}, [query])
	const sentinelRef = useInfiniteSentinel(
		Boolean(query.hasNextPage && !query.isFetchingNextPage),
		loadMore,
	)

	return (
		<section className="overflow-hidden rounded-lg border bg-background">
			<div className="flex flex-col gap-1 px-4 py-3">
				<h1 className="text-lg font-semibold tracking-normal">Blocks</h1>
				<p className="text-sm text-muted-foreground">
					{blocks.length.toLocaleString()} visible groups
				</p>
			</div>
			<ListFiltersBar value={filters} onChange={setFilters} />
			{query.isLoading ? <TableSkeleton columns={11} /> : null}
			{query.isError ? (
				<div className="p-4">
					<ErrorState error={query.error} />
				</div>
			) : null}
			{!query.isLoading && !query.isError && blocks.length === 0 ? (
				<EmptyState title="No blocks found" />
			) : null}
			{blocks.length > 0 ? (
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Block</TableHead>
							<TableHead className="text-right">Artifacts</TableHead>
							<TableHead className="text-right">Ready</TableHead>
							<TableHead className="text-right">Running</TableHead>
							<TableHead className="text-right">Pending</TableHead>
							<TableHead className="text-right">Rejected</TableHead>
							<TableHead className="text-right">Failed</TableHead>
							<TableHead className="text-right">Superseded</TableHead>
							<TableHead>Latest</TableHead>
							<TableHead>Avg</TableHead>
							<TableHead>P95</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{blocks.map((block) => (
							<TableRow key={block.blockName}>
								<TableCell className="max-w-[360px] font-medium">
									<Link
										to="/blocks/$blockName"
										params={{ blockName: block.blockName }}
										className="truncate hover:underline"
									>
										{block.blockName}
									</Link>
								</TableCell>
								<TableCell className="text-right tabular-nums">
									{block.totalArtifacts.toLocaleString()}
								</TableCell>
								<TableCell className="text-right tabular-nums">
									{block.statusCounts.ready}
								</TableCell>
								<TableCell className="text-right tabular-nums">
									{block.statusCounts.running}
								</TableCell>
								<TableCell className="text-right tabular-nums">
									{block.statusCounts.pending}
								</TableCell>
								<TableCell className="text-right tabular-nums">
									{block.statusCounts.rejected}
								</TableCell>
								<TableCell className="text-right tabular-nums">
									{block.statusCounts.failed}
								</TableCell>
								<TableCell className="text-right tabular-nums">
									{block.statusCounts.superseded}
								</TableCell>
								<TableCell>{formatDateTime(block.latestActivityAt)}</TableCell>
								<TableCell>{formatDuration(block.duration.avgMs)}</TableCell>
								<TableCell>{formatDuration(block.duration.p95Ms)}</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			) : null}
			<div ref={sentinelRef} />
			{query.isFetchingNextPage ? <InlineSpinner label="Loading more" /> : null}
			{query.hasNextPage ? (
				<div className="flex justify-center border-t p-3">
					<Button
						type="button"
						variant="outline"
						onClick={() => void query.fetchNextPage()}
						disabled={query.isFetchingNextPage}
					>
						Load more
					</Button>
				</div>
			) : null}
		</section>
	)
}
