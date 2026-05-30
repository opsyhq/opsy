import { ChevronsLeft, ChevronsRight, SlidersHorizontal } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import {
	ACTIVITY_RAIL_WIDTH_COLLAPSED,
	ACTIVITY_RAIL_WIDTH_OPEN,
} from "@/components/layout/railWidths"
import { useActivityOperations } from "@/components/layout/use-activity-operations"
import { useIsMobile } from "@/components/layout/use-mobile"
import {
	OperationFilters,
	type OperationFiltersValue,
} from "@/components/operations/OperationFilters"
import {
	OperationKindBadge,
	operationStatusTextColors,
} from "@/components/StatusBadge"
import { Button } from "@/components/ui/button"
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip"
import type { ProjectOperation } from "@/lib/projectReactQuery"
import { cn, relativeTime } from "@/lib/utils"

type Operation = ProjectOperation

const PINNED_KEY = "opsy.activityRail.v3.pinned"

function readBool(key: string, fallback: boolean): boolean {
	if (typeof window === "undefined") return fallback
	const v = window.localStorage.getItem(key)
	if (v === null) return fallback
	return v === "1"
}

function dayKey(iso: string): string {
	const d = new Date(iso)
	const dd = String(d.getDate()).padStart(2, "0")
	const mm = String(d.getMonth() + 1).padStart(2, "0")
	const yyyy = d.getFullYear()
	return `${dd}/${mm}/${yyyy}`
}

export function ActivityRail({
	projectSlug,
	filters,
	onFiltersChange,
	selectedOperationId,
	onSelectOperation,
	resourceSlugById,
	floating = false,
}: {
	projectSlug: string
	filters: OperationFiltersValue
	onFiltersChange: (patch: Partial<OperationFiltersValue>) => void
	selectedOperationId: string | null
	onSelectOperation: (id: string | null) => void
	resourceSlugById: Map<string, string>
	floating?: boolean
}) {
	const isMobile = useIsMobile()

	const [pinned, setPinned] = useState<boolean>(() =>
		readBool(PINNED_KEY, false),
	)
	const [hovered, setHovered] = useState(false)
	const expanded = pinned || hovered
	const [showFilters, setShowFilters] = useState(false)

	useEffect(() => {
		if (typeof window === "undefined") return
		window.localStorage.setItem(PINNED_KEY, pinned ? "1" : "0")
	}, [pinned])

	const { operations, loadMoreRef, isFetchingNextPage } = useActivityOperations(
		{ projectSlug, filters },
	)

	const grouped = useMemo(() => {
		const m = new Map<string, Operation[]>()
		for (const a of operations) {
			const key = dayKey(a.createdAt)
			const bucket = m.get(key)
			if (bucket) bucket.push(a)
			else m.set(key, [a])
		}
		return Array.from(m.entries())
	}, [operations])

	const togglePinned = () => {
		setPinned((p) => {
			const next = !p
			if (!next) setHovered(false)
			return next
		})
	}

	if (isMobile) return null

	const asideStyle: React.CSSProperties = {
		width: expanded ? ACTIVITY_RAIL_WIDTH_OPEN : ACTIVITY_RAIL_WIDTH_COLLAPSED,
		transition: "width 260ms ease-out",
	}

	return (
		<aside
			className={cn(
				"relative flex shrink-0 overflow-hidden border bg-background",
				floating ? "rounded-lg" : "rounded-l-lg",
				expanded && "z-[60]",
			)}
			style={asideStyle}
			onMouseEnter={() => setHovered(true)}
			onMouseLeave={() => setHovered(false)}
		>
			<div
				aria-hidden={expanded}
				className={cn(
					"absolute inset-0 flex flex-col items-center py-2 transition-opacity duration-150 ease-out",
					expanded ? "pointer-events-none opacity-0" : "opacity-100",
				)}
				style={{ width: ACTIVITY_RAIL_WIDTH_COLLAPSED }}
			>
				<span
					className="mt-2 rotate-180 text-[10px] uppercase tracking-wider text-muted-foreground"
					style={{ writingMode: "vertical-rl" }}
				>
					Activity
				</span>
			</div>

			<div
				aria-hidden={!expanded}
				className={cn(
					"absolute inset-y-0 left-0 flex flex-col transition-opacity ease-out",
					expanded
						? "opacity-100 duration-200 delay-75"
						: "pointer-events-none opacity-0 duration-100",
				)}
				style={{ width: ACTIVITY_RAIL_WIDTH_OPEN }}
			>
				<div className="flex h-9 shrink-0 items-center justify-between border-b px-3">
					<span className="text-[11px] font-semibold uppercase tracking-wider">
						Activity
					</span>
					<div className="flex items-center gap-0.5">
						<Button
							variant="ghost"
							size="icon-xs"
							aria-label="Filters"
							onClick={() => setShowFilters((v) => !v)}
							tabIndex={expanded ? 0 : -1}
							className={cn(
								showFilters && "bg-muted text-foreground",
								"text-muted-foreground",
							)}
						>
							<SlidersHorizontal className="size-3.5" />
						</Button>
						<Tooltip>
							<TooltipTrigger asChild>
								<Button
									variant="ghost"
									size="icon-xs"
									aria-label={
										pinned ? "Collapse activity" : "Pin activity open"
									}
									onClick={togglePinned}
									tabIndex={expanded ? 0 : -1}
									className="text-muted-foreground"
								>
									{pinned ? (
										<ChevronsRight className="size-4" />
									) : (
										<ChevronsLeft className="size-4" />
									)}
								</Button>
							</TooltipTrigger>
							<TooltipContent side="left">
								{pinned ? "Collapse activity" : "Pin activity open"}
							</TooltipContent>
						</Tooltip>
					</div>
				</div>

				{showFilters && (
					<div className="shrink-0 border-b px-3 py-2">
						<OperationFilters value={filters} onChange={onFiltersChange} />
					</div>
				)}

				<div className="min-h-0 flex-1 cursor-default overflow-y-auto">
					{grouped.length === 0 && (
						<p className="p-4 text-center text-xs text-muted-foreground">
							No operations.
						</p>
					)}
					{grouped.map(([day, items]) => (
						<div key={day} className="px-2 pt-2">
							<div className="mb-2 px-1 py-1 text-[11px] font-thin uppercase tracking-widest text-muted-foreground">
								{day}
							</div>
							<ul className="flex flex-col gap-2">
								{items.map((a) => {
									const resourceLabel = a.resourceId
										? (resourceSlugById.get(a.resourceId) ??
											a.resourceId.slice(0, 6))
										: "—"
									const selected = selectedOperationId === a.id
									return (
										<li key={a.id}>
											<button
												type="button"
												onClick={() => onSelectOperation(a.id)}
												tabIndex={expanded ? 0 : -1}
												className={cn(
													"flex w-full cursor-pointer flex-col gap-2 rounded-lg border bg-background px-3 py-2.5 text-left transition-colors hover:border-primary/40 hover:bg-muted/30",
													selected && "border-primary/40 bg-muted/30",
												)}
											>
												<div className="flex items-start justify-between gap-2">
													<span className="min-w-0 truncate font-mono text-xs font-medium">
														{resourceLabel}
													</span>
													<span className="shrink-0 text-[10px] text-muted-foreground">
														{relativeTime(a.createdAt)}
													</span>
												</div>
												<div className="flex items-center justify-between gap-2">
													<OperationKindBadge kind={a.kind} />
													<span
														className={cn(
															"text-xs",
															operationStatusTextColors[a.status] ??
																"text-muted-foreground",
														)}
													>
														{a.status.replace("_", " ")}
													</span>
												</div>
											</button>
										</li>
									)
								})}
							</ul>
						</div>
					))}
					<div
						ref={loadMoreRef}
						className="h-8 py-2 text-center text-xs text-muted-foreground"
					>
						{isFetchingNextPage ? "Loading more…" : ""}
					</div>
				</div>
			</div>
		</aside>
	)
}
