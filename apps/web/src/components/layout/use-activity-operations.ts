import { useInfiniteQuery } from "@tanstack/react-query"
import { useEffect, useMemo, useRef } from "react"
import type { OperationFiltersValue } from "@/components/operations/OperationFilters"
import {
	fetchProjectOperations,
	type ProjectOperation,
	projectQueryKeys,
} from "@/lib/projectReactQuery"

export function useActivityOperations({
	projectSlug,
	filters,
}: {
	projectSlug: string
	filters: OperationFiltersValue
}): {
	operations: ProjectOperation[]
	loadMoreRef: React.MutableRefObject<HTMLDivElement | null>
	hasNextPage: boolean
	isFetchingNextPage: boolean
} {
	const pageSize = filters.operationLimit ?? 20
	const { data, fetchNextPage, hasNextPage, isFetchingNextPage } =
		useInfiniteQuery({
			queryKey: [
				...projectQueryKeys.operations(projectSlug),
				"infinite",
				{
					resourceSlug: filters.operationResource,
					kind: filters.operationKind,
					status: filters.operationStatus,
					limit: pageSize,
				},
			] as const,
			queryFn: ({ pageParam }) =>
				fetchProjectOperations({
					slug: projectSlug,
					resourceSlug: filters.operationResource,
					kind: filters.operationKind,
					status: filters.operationStatus,
					limit: pageSize,
					...pageParam,
				}),
			initialPageParam: {} as { cursorCreatedAt?: string; cursorId?: string },
			getNextPageParam: (lastPage) => {
				const last = lastPage.operations.at(-1)
				return lastPage.operations.length === pageSize && last
					? { cursorCreatedAt: last.createdAt, cursorId: last.id }
					: undefined
			},
		})
	const operations = useMemo(
		() => data?.pages.flatMap((page) => page.operations) ?? [],
		[data?.pages],
	)
	const loadMoreRef = useRef<HTMLDivElement | null>(null)

	useEffect(() => {
		const target = loadMoreRef.current
		if (!target || !hasNextPage) return
		const observer = new IntersectionObserver((entries) => {
			if (
				entries.some((entry) => entry.isIntersecting) &&
				!isFetchingNextPage
			) {
				fetchNextPage().catch(() => undefined)
			}
		})
		observer.observe(target)
		return () => observer.disconnect()
	}, [fetchNextPage, hasNextPage, isFetchingNextPage])

	return {
		operations,
		loadMoreRef,
		hasNextPage: hasNextPage ?? false,
		isFetchingNextPage,
	}
}
