import { useInfiniteQuery } from "@tanstack/react-query"
import { Link, useParams } from "@tanstack/react-router"
import { useCallback, useDeferredValue, useState } from "react"
import { CopyButton } from "@/components/CopyButton"
import { ListFiltersBar } from "@/components/ListFilters"
import {
	EmptyState,
	ErrorState,
	InlineSpinner,
	TableSkeleton,
} from "@/components/PageState"
import { StatusBadge } from "@/components/StatusBadge"
import { Button } from "@/components/ui/button"
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table"
import { formatDateTime, formatDuration, truncateMiddle } from "@/lib/format"
import { getResources, type ListFilters } from "@/lib/thinking-block-api"
import { useInfiniteSentinel } from "@/lib/use-infinite-sentinel"

export function BlockResourcesPage() {
	const { blockName } = useParams({ strict: false }) as { blockName: string }
	const [filters, setFilters] = useState<ListFilters>({ status: "all" })
	const deferredFilters = useDeferredValue(filters)
	const query = useInfiniteQuery({
		queryKey: ["thinking-block-resources", blockName, deferredFilters],
		initialPageParam: null as string | null,
		queryFn: ({ pageParam }) =>
			getResources(blockName, {
				...deferredFilters,
				cursor: pageParam,
				limit: 50,
			}),
		getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
		refetchInterval: (state) =>
			state.state.data?.pages.some((page) =>
				page.resources.some(
					(resource) =>
						resource.latestStatus === "pending" ||
						resource.latestStatus === "running" ||
						resource.statusCounts.pending > 0 ||
						resource.statusCounts.running > 0,
				),
			)
				? 2000
				: false,
	})
	const resources = query.data?.pages.flatMap((page) => page.resources) ?? []
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
				<div className="text-xs text-muted-foreground">
					<Link to="/" className="hover:text-foreground">
						Blocks
					</Link>
					<span className="px-2">/</span>
					<span>{blockName}</span>
				</div>
				<h1 className="break-all text-lg font-semibold tracking-normal">
					{blockName}
				</h1>
			</div>
			<ListFiltersBar value={filters} onChange={setFilters} />
			{query.isLoading ? <TableSkeleton columns={8} /> : null}
			{query.isError ? (
				<div className="p-4">
					<ErrorState error={query.error} />
				</div>
			) : null}
			{!query.isLoading && !query.isError && resources.length === 0 ? (
				<EmptyState title="No resource identities found" />
			) : null}
			{resources.length > 0 ? (
				<div className="overflow-x-auto">
					<Table>
						<TableHeader>
							<TableRow>
								<SortHead
									label="Identity key"
									sortBy="identityKey"
									filters={filters}
									onChange={setFilters}
								/>
								<TableHead>Version</TableHead>
								<TableHead>Status</TableHead>
								<SortHead
									label="Artifacts"
									sortBy="totalArtifacts"
									filters={filters}
									onChange={setFilters}
									className="text-right"
								/>
								<TableHead>Duration</TableHead>
								<SortHead
									label="Updated"
									sortBy="latestUpdatedAt"
									filters={filters}
									onChange={setFilters}
								/>
								<TableHead>Latest artifact</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{resources.map((resource) => (
								<TableRow key={resource.identityRef}>
									<TableCell className="max-w-[260px]">
										<div className="flex items-center gap-1">
											<Link
												to="/resources/$identityRef"
												params={{ identityRef: resource.identityRef }}
												className="truncate font-mono text-xs hover:underline"
											>
												{truncateMiddle(resource.identityKey, 12)}
											</Link>
											<CopyButton
												value={resource.identityKey}
												label="Copy identity key"
												className="size-6"
											/>
										</div>
									</TableCell>
									<TableCell className="font-mono text-xs">
										{resource.blockVersion}
									</TableCell>
									<TableCell>
										<StatusBadge status={resource.latestStatus} />
									</TableCell>
									<TableCell className="text-right tabular-nums">
										{resource.totalArtifacts.toLocaleString()}
									</TableCell>
									<TableCell>
										{formatDuration(resource.latestDurationMs)}
									</TableCell>
									<TableCell>
										{formatDateTime(resource.latestUpdatedAt)}
									</TableCell>
									<TableCell className="max-w-[220px]">
										{resource.latestArtifactId ? (
											<div className="flex items-center gap-1">
												<Link
													to="/artifacts/$artifactId"
													params={{ artifactId: resource.latestArtifactId }}
													className="truncate font-mono text-xs hover:underline"
												>
													{truncateMiddle(resource.latestArtifactId, 8)}
												</Link>
												<CopyButton
													value={resource.latestArtifactId}
													label="Copy artifact ID"
													className="size-6"
												/>
											</div>
										) : (
											"-"
										)}
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</div>
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

function SortHead({
	label,
	sortBy,
	filters,
	onChange,
	className,
}: {
	label: string
	sortBy: NonNullable<ListFilters["sortBy"]>
	filters: ListFilters
	onChange: (filters: ListFilters) => void
	className?: string
}) {
	const active = (filters.sortBy ?? "latestUpdatedAt") === sortBy
	const direction = filters.sortDirection ?? "desc"
	return (
		<TableHead className={className}>
			<button
				className="inline-flex items-center gap-1 whitespace-nowrap font-medium hover:text-foreground"
				onClick={() =>
					onChange({
						...filters,
						sortBy,
						sortDirection: active && direction === "asc" ? "desc" : "asc",
					})
				}
				type="button"
			>
				<span>{label}</span>
				<span className="text-[10px] text-muted-foreground">
					{active ? (direction === "asc" ? "up" : "down") : ""}
				</span>
			</button>
		</TableHead>
	)
}
