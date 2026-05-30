import type { SearchHit } from "@opsy/api"
import { useInfiniteQuery } from "@tanstack/react-query"
import { Box, Loader2, Search } from "lucide-react"
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react"
import { ProviderLogo } from "@/components/ProviderLogo"
import { ResourceTypeIconForType } from "@/components/ResourceTypeIcon"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { getProviderMeta } from "@/lib/providerMeta"
import { resourceTypeSearchQueryOptions } from "@/lib/providerReactQuery"
import { cn } from "@/lib/utils"

function useDebouncedValue<T>(value: T, delayMs: number): T {
	const [debounced, setDebounced] = useState(value)
	useEffect(() => {
		const handle = window.setTimeout(() => setDebounced(value), delayMs)
		return () => window.clearTimeout(handle)
	}, [value, delayMs])
	return debounced
}

// Shared between the create and import flows so both render the exact same
// shell, integration step, type search and type rows — the action verb is
// the only thing that differs (Create vs Import).
export type Integration = {
	id: string
	slug: string
	provider: string
	status?: string | null
}

export function TypeRow({
	hit,
	pending,
	actionLabel,
	onStage,
}: {
	hit: SearchHit
	pending: boolean
	actionLabel: string
	onStage: (hit: SearchHit, metadataName?: string | null) => void
}) {
	const provider = getProviderMeta(hit.provider)
	const metadata = hit.artifacts.metadata
	const metadataGenerating =
		metadata !== null &&
		(metadata.status === "pending" || metadata.status === "running")
	const generatedName = metadata?.data?.name?.trim()
	const displayName = metadataGenerating ? null : generatedName
	const description = hit.description?.trim()
	const deprecated = hit.deprecated ?? false

	return (
		<div className="flex w-full min-w-0 items-center gap-3 rounded-lg border bg-background px-3 py-2">
			<ResourceTypeIconForType
				provider={provider}
				type={hit.type}
				icon={hit.artifacts.icon}
				size="md"
			/>
			<div className="min-w-0 flex-1">
				<div className="flex min-w-0 items-center gap-2">
					<div
						className={cn(
							"min-w-0 flex-1 truncate text-xs font-medium",
							!displayName && "font-mono",
						)}
					>
						{displayName ?? hit.type}
					</div>
					{metadataGenerating && (
						<Loader2
							className="size-3.5 shrink-0 animate-spin text-muted-foreground"
							aria-label="Loading type metadata"
						/>
					)}
					{deprecated && (
						<Badge variant="outline" className="shrink-0 text-[10px]">
							Deprecated
						</Badge>
					)}
				</div>
				{description && (
					<p className="mt-1 max-h-8 overflow-hidden text-[11px] leading-4 text-muted-foreground">
						{description}
					</p>
				)}
			</div>
			<div className="flex shrink-0 items-center gap-2">
				<Button
					type="button"
					size="xs"
					variant="outline"
					onClick={() => onStage(hit, metadata?.data?.name)}
					disabled={pending}
					className="h-7 px-3"
				>
					{actionLabel}
				</Button>
			</div>
		</div>
	)
}

function ProviderStep({
	integrations,
	pending,
	emptyOption,
	onProvider,
	emptyIntegrationsMessage,
}: {
	integrations: Integration[]
	pending: boolean
	emptyOption?: { title: string; subtitle: string; onSelect: () => void }
	onProvider: (integration: Integration) => void
	emptyIntegrationsMessage: string
}) {
	if (integrations.length === 0 && !emptyOption) {
		return (
			<div className="flex min-h-0 flex-1 items-center justify-center px-4 py-3">
				<div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
					{emptyIntegrationsMessage}
				</div>
			</div>
		)
	}

	return (
		<div className="scrollbar-soft mr-1 flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto py-3 pl-4 pr-3">
			{emptyOption && (
				<button
					type="button"
					onClick={emptyOption.onSelect}
					disabled={pending}
					className="flex w-full cursor-pointer items-center gap-3 rounded-lg border bg-background px-3 py-2 text-left transition hover:border-primary/40 hover:bg-muted/30 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
				>
					<Box className="size-4 shrink-0 text-muted-foreground" />
					<div className="min-w-0 flex-1">
						<div className="truncate text-xs font-medium">
							{emptyOption.title}
						</div>
						<p className="truncate text-[11px] text-muted-foreground">
							{emptyOption.subtitle}
						</p>
					</div>
				</button>
			)}

			{integrations.map((integration) => {
				const provider = getProviderMeta(integration.provider)
				return (
					<button
						key={integration.id}
						type="button"
						onClick={() => onProvider(integration)}
						disabled={pending}
						className="flex w-full cursor-pointer items-center gap-3 rounded-lg border bg-background px-3 py-2 text-left transition hover:border-primary/40 hover:bg-muted/30 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
					>
						<ProviderLogo provider={provider} size="sm" />
						<div className="min-w-0 flex-1">
							<div className="truncate text-xs font-medium">
								{integration.slug}
							</div>
							<div className="truncate font-mono text-[11px] text-muted-foreground">
								{integration.slug}
							</div>
						</div>
					</button>
				)
			})}
		</div>
	)
}

function TypeStep({
	provider,
	pending,
	actionLabel,
	onStage,
}: {
	provider: string
	pending: boolean
	actionLabel: string
	onStage: (hit: SearchHit, metadataName?: string | null) => void
}) {
	const [query, setQuery] = useState("")
	const [scrolled, setScrolled] = useState(false)
	const debouncedQuery = useDebouncedValue(query.trim(), 200)
	const sentinelRef = useRef<HTMLDivElement | null>(null)
	const topSentinelRef = useRef<HTMLDivElement | null>(null)
	const pageSize = 50
	const meta = getProviderMeta(provider)
	const typeQuery = useInfiniteQuery(
		resourceTypeSearchQueryOptions({
			provider,
			q: debouncedQuery,
			limit: pageSize,
		}),
	)
	const results = useMemo(
		() => typeQuery.data?.pages.flatMap((page) => page.results) ?? [],
		[typeQuery.data],
	)

	useEffect(() => {
		const node = sentinelRef.current
		if (!node) return
		const observer = new IntersectionObserver((entries) => {
			if (
				entries.some((entry) => entry.isIntersecting) &&
				typeQuery.hasNextPage &&
				!typeQuery.isFetchingNextPage
			) {
				void typeQuery.fetchNextPage()
			}
		})
		observer.observe(node)
		return () => observer.disconnect()
	}, [
		typeQuery.hasNextPage,
		typeQuery.isFetchingNextPage,
		typeQuery.fetchNextPage,
	])

	useEffect(() => {
		const node = topSentinelRef.current
		if (!node) return
		const observer = new IntersectionObserver(([entry]) => {
			setScrolled(!entry.isIntersecting)
		})
		observer.observe(node)
		return () => observer.disconnect()
	}, [])

	return (
		<div className="flex min-h-0 flex-1 flex-col">
			<div className="shrink-0 px-4 pt-3 pb-3">
				<div className="group relative">
					<Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-foreground" />
					<Input
						autoFocus
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						placeholder={`Search ${meta.short} types...`}
						className="h-9 rounded-lg border-input bg-transparent pl-8 shadow-none placeholder:font-light placeholder:opacity-60 focus-visible:border-input focus-visible:ring-0 dark:bg-transparent"
					/>
				</div>
			</div>

			<div className="relative min-h-0 flex-1 pr-1">
				<div className="scrollbar-soft h-full overflow-y-auto pb-3 pl-4 pr-3">
					<div ref={topSentinelRef} aria-hidden className="h-px" />
					{typeQuery.isLoading && (
						<p className="py-2 text-xs text-muted-foreground/60">
							Loading types...
						</p>
					)}

					{!typeQuery.isLoading && results.length === 0 && (
						<div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
							No matching types.
						</div>
					)}

					<div className="flex min-w-0 flex-col gap-2">
						{results.map((hit) => (
							<TypeRow
								key={hit.type}
								hit={hit}
								pending={pending}
								actionLabel={actionLabel}
								onStage={onStage}
							/>
						))}
						<div ref={sentinelRef} className="h-1" />
						{typeQuery.isFetchingNextPage && (
							<div className="flex items-center justify-center gap-2 py-3 text-xs text-muted-foreground">
								<Loader2 className="size-3.5 animate-spin" />
								Loading more...
							</div>
						)}
					</div>
				</div>
				<div
					aria-hidden
					className={cn(
						"pointer-events-none absolute left-0 right-1 top-0 h-5 bg-gradient-to-b from-background to-transparent transition-opacity duration-150",
						scrolled ? "opacity-100" : "opacity-0",
					)}
				/>
			</div>
		</div>
	)
}

export function ResourcePickerWizard({
	open,
	onOpenChange,
	title,
	description,
	integrations,
	pending,
	pendingLabel,
	actionLabel,
	emptyIntegrationsMessage,
	emptyOption,
	initialIntegrationSlug,
	onProviderAction,
	onPickType,
	renderTerminal,
}: {
	open: boolean
	onOpenChange: (open: boolean) => void
	title: string
	description?: string
	integrations: Integration[]
	pending: boolean
	pendingLabel: string
	actionLabel: string
	emptyIntegrationsMessage: string
	emptyOption?: { title: string; subtitle: string; onSelect: () => void }
	initialIntegrationSlug?: string
	// When set, the provider step is itself the terminal action (the related
	// target flow stages directly on provider pick — no type search).
	onProviderAction?: (integration: Integration) => void
	// Stage-on-click: invoked from a type row when there is no terminal step.
	onPickType?: (
		integration: Integration,
		hit: SearchHit,
		metadataName: string | null,
	) => void
	// When provided, picking a type advances to this terminal step instead of
	// performing the action immediately (the import identity form).
	renderTerminal?: (ctx: {
		integration: Integration
		hit: SearchHit
		onBack: () => void
	}) => ReactNode
}) {
	const [selectedIntegration, setSelectedIntegration] =
		useState<Integration | null>(null)
	const [selectedHit, setSelectedHit] = useState<SearchHit | null>(null)

	useEffect(() => {
		if (!open) return
		setSelectedIntegration(
			integrations.find((i) => i.slug === initialIntegrationSlug) ?? null,
		)
		setSelectedHit(null)
	}, [open, initialIntegrationSlug, integrations])

	const close = (nextOpen: boolean) => {
		onOpenChange(nextOpen)
		if (!nextOpen) {
			setSelectedIntegration(null)
			setSelectedHit(null)
		}
	}

	const onTypeStage = (hit: SearchHit, metadataName?: string | null) => {
		if (!selectedIntegration) return
		if (renderTerminal) {
			setSelectedHit(hit)
			return
		}
		onPickType?.(selectedIntegration, hit, metadataName ?? null)
	}

	const canGoBack = Boolean(selectedIntegration) && !onProviderAction

	return (
		<Dialog open={open} onOpenChange={close}>
			<DialogContent
				showCloseButton={false}
				overlayClassName="bg-transparent"
				className="flex h-[min(480px,calc(100%-5rem))] w-[min(520px,calc(100%-1.5rem))] max-w-none flex-col gap-0 overflow-hidden rounded-lg p-0 sm:max-w-none"
			>
				<header className="border-b px-4 py-3">
					<div className="min-w-0">
						<DialogTitle className="text-sm font-medium leading-none">
							{title}
						</DialogTitle>
						{description ? (
							<DialogDescription className="mt-1.5 text-xs">
								{description}
							</DialogDescription>
						) : (
							<DialogDescription className="sr-only">
								{title}
							</DialogDescription>
						)}
					</div>
				</header>

				<div className="flex min-h-0 flex-1 flex-col">
					{onProviderAction ? (
						<ProviderStep
							integrations={integrations}
							pending={pending}
							onProvider={onProviderAction}
							emptyIntegrationsMessage={emptyIntegrationsMessage}
						/>
					) : !selectedIntegration ? (
						<ProviderStep
							integrations={integrations}
							pending={pending}
							emptyOption={emptyOption}
							onProvider={setSelectedIntegration}
							emptyIntegrationsMessage={emptyIntegrationsMessage}
						/>
					) : renderTerminal && selectedHit ? (
						<div className="scrollbar-soft min-h-0 flex-1 overflow-y-auto px-4 py-3">
							{renderTerminal({
								integration: selectedIntegration,
								hit: selectedHit,
								onBack: () => setSelectedHit(null),
							})}
						</div>
					) : (
						<TypeStep
							provider={selectedIntegration.provider}
							pending={pending}
							actionLabel={actionLabel}
							onStage={onTypeStage}
						/>
					)}
				</div>

				<footer className="flex items-center justify-between gap-2 border-t px-4 py-2.5">
					{canGoBack ? (
						<Button
							type="button"
							variant="outline"
							size="xs"
							className="h-7 px-3"
							onClick={() =>
								selectedHit
									? setSelectedHit(null)
									: setSelectedIntegration(null)
							}
							disabled={pending}
						>
							Back
						</Button>
					) : (
						<div />
					)}
					<div className="flex items-center gap-3">
						{pending && (
							<div className="flex items-center gap-2 text-xs text-muted-foreground">
								<Loader2 className="size-3.5 animate-spin" />
								{pendingLabel}
							</div>
						)}
						<Button
							type="button"
							variant="outline"
							size="xs"
							className="h-7 px-3"
							onClick={() => close(false)}
							disabled={pending}
						>
							Cancel
						</Button>
					</div>
				</footer>
			</DialogContent>
		</Dialog>
	)
}
