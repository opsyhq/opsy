import { useInfiniteQuery } from "@tanstack/react-query"
import { Link, useParams } from "@tanstack/react-router"
import { useCallback } from "react"
import { CopyButton } from "@/components/CopyButton"
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
import { getArtifacts } from "@/lib/thinking-block-api"
import { useInfiniteSentinel } from "@/lib/use-infinite-sentinel"

export function ResourceArtifactsPage() {
	const { identityRef } = useParams({ strict: false }) as {
		identityRef: string
	}
	const query = useInfiniteQuery({
		queryKey: ["thinking-block-artifacts", identityRef],
		initialPageParam: null as string | null,
		queryFn: ({ pageParam }) => getArtifacts(identityRef, pageParam),
		getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
		refetchInterval: (state) =>
			state.state.data?.pages.some((page) =>
				page.artifacts.some(
					(artifact) =>
						artifact.status === "pending" || artifact.status === "running",
				),
			)
				? 2000
				: false,
	})
	const artifacts = query.data?.pages.flatMap((page) => page.artifacts) ?? []
	const identity = query.data?.pages[0]?.identity
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
					{identity ? (
						<>
							<span className="px-2">/</span>
							<Link
								to="/blocks/$blockName"
								params={{ blockName: identity.blockName }}
								className="hover:text-foreground"
							>
								{identity.blockName}
							</Link>
						</>
					) : null}
				</div>
				<div className="flex min-w-0 items-center gap-2">
					<h1 className="truncate text-lg font-semibold tracking-normal">
						{identity
							? `${identity.blockVersion} / ${truncateMiddle(identity.identityKey, 18)}`
							: "Resource identity"}
					</h1>
					{identity ? (
						<CopyButton
							value={identity.identityKey}
							label="Copy identity key"
							className="size-7"
						/>
					) : null}
				</div>
			</div>
			{query.isLoading ? <TableSkeleton columns={10} /> : null}
			{query.isError ? (
				<div className="p-4">
					<ErrorState error={query.error} />
				</div>
			) : null}
			{!query.isLoading && !query.isError && artifacts.length === 0 ? (
				<EmptyState title="No artifact versions found" />
			) : null}
			{artifacts.length > 0 ? (
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Artifact</TableHead>
							<TableHead>Status</TableHead>
							<TableHead>Phase</TableHead>
							<TableHead>Duration</TableHead>
							<TableHead className="text-right">Runs</TableHead>
							<TableHead className="text-right">Model calls</TableHead>
							<TableHead className="text-right">Validations</TableHead>
							<TableHead>Created</TableHead>
							<TableHead>Updated</TableHead>
							<TableHead>Supersession</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{artifacts.map((artifact) => (
							<TableRow key={artifact.id}>
								<TableCell className="max-w-[240px]">
									<div className="flex items-center gap-1">
										<Link
											to="/artifacts/$artifactId"
											params={{ artifactId: artifact.id }}
											className="truncate font-mono text-xs hover:underline"
										>
											{truncateMiddle(artifact.id, 10)}
										</Link>
										<CopyButton
											value={artifact.id}
											label="Copy artifact ID"
											className="size-6"
										/>
									</div>
								</TableCell>
								<TableCell>
									<StatusBadge status={artifact.status} />
								</TableCell>
								<TableCell>
									{artifact.phaseLabel ?? artifact.phase ?? "-"}
								</TableCell>
								<TableCell>
									{formatDuration(artifact.latestDurationMs)}
								</TableCell>
								<TableCell className="text-right tabular-nums">
									{artifact.runCount}
								</TableCell>
								<TableCell className="text-right tabular-nums">
									{artifact.modelCallCount}
								</TableCell>
								<TableCell className="text-right tabular-nums">
									{artifact.validationCount}
								</TableCell>
								<TableCell>{formatDateTime(artifact.createdAt)}</TableCell>
								<TableCell>{formatDateTime(artifact.updatedAt)}</TableCell>
								<TableCell className="font-mono text-xs">
									{artifact.supersededBy
										? truncateMiddle(artifact.supersededBy, 8)
										: artifact.supersededAt
											? formatDateTime(artifact.supersededAt)
											: "-"}
								</TableCell>
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
