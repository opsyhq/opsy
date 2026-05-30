import { Link, useMatchRoute, useRouteContext } from "@tanstack/react-router"
import {
	Cable,
	ChevronsLeft,
	ChevronsRight,
	LayoutGrid,
	Settings,
	Users,
	Workflow,
} from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { AvatarMenu } from "@/components/layout/AvatarMenu"
import {
	APP_RAIL_WIDTH_COLLAPSED,
	APP_RAIL_WIDTH_OPEN,
} from "@/components/layout/railWidths"
import { useActiveProjectSlug } from "@/components/layout/use-project-slug"
import { WorkspaceSwitcher } from "@/components/layout/WorkspaceSwitcher"
import { Button } from "@/components/ui/button"
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn, getUserInitials } from "@/lib/utils"

const orgItems = [
	{ to: "/projects", label: "Projects", icon: LayoutGrid },
	{ to: "/members", label: "Members", icon: Users },
	{ to: "/settings/organization", label: "Settings", icon: Settings },
] as const

const projectItems = [
	{
		to: "/projects/$projectSlug/architecture",
		label: "Architecture",
		icon: Workflow,
	},
	{
		to: "/projects/$projectSlug/integrations",
		label: "Integrations",
		icon: Cable,
	},
	{
		to: "/projects/$projectSlug/settings",
		label: "Project Settings",
		icon: Settings,
	},
] as const

function readBool(key: string, fallback: boolean): boolean {
	if (typeof window === "undefined") return fallback
	const v = window.localStorage.getItem(key)
	if (v === null) return fallback
	return v === "1"
}

export function AppRail({
	onSignOut,
	isSigningOut,
	floating = false,
	onWidthChange,
}: {
	onSignOut: () => void
	isSigningOut: boolean
	floating?: boolean
	onWidthChange?: (width: number) => void
}) {
	const session = useRouteContext({
		from: "__root__",
		select: (context) => context.session,
	})
	const matchRoute = useMatchRoute()
	const projectSlug = useActiveProjectSlug()

	const initials = getUserInitials(session?.user?.name, session?.user?.email)
	const userName = session?.user?.name ?? session?.user?.email ?? "Account"
	const userEmail = session?.user?.email ?? ""

	const inProject = !!projectSlug
	const items: RailItem[] = inProject
		? projectItems.map((item) => ({
				to: item.to,
				label: item.label,
				icon: item.icon,
				params: { projectSlug },
			}))
		: orgItems.map((item) => ({
				to: item.to,
				label: item.label,
				icon: item.icon,
			}))

	return (
		<Rail
			key={inProject ? "project" : "landing"}
			items={items}
			matchRoute={matchRoute}
			initials={initials}
			userName={userName}
			userEmail={userEmail}
			onSignOut={onSignOut}
			isSigningOut={isSigningOut}
			storagePrefix={
				inProject ? "opsy.appRail.project" : "opsy.appRail.landing"
			}
			floating={floating}
			onWidthChange={onWidthChange}
			// Workspace-level rail (Projects / Members / Settings) stays pinned
			// open — no collapse affordance. The project-scoped rail keeps the
			// hover-expand + pin behavior so the canvas can claim more space.
			alwaysExpanded={!inProject}
		/>
	)
}

type RailItem = {
	to: string
	label: string
	icon: React.ComponentType<{ className?: string }>
	params?: Record<string, string>
}

type RailProps = {
	items: RailItem[]
	matchRoute: ReturnType<typeof useMatchRoute>
	initials: string
	userName: string
	userEmail: string
	onSignOut: () => void
	isSigningOut: boolean
	storagePrefix: string
	floating: boolean
	onWidthChange?: (width: number) => void
	alwaysExpanded?: boolean
}

function Rail({
	items,
	matchRoute,
	initials,
	userName,
	userEmail,
	onSignOut,
	isSigningOut,
	storagePrefix,
	floating,
	onWidthChange,
	alwaysExpanded = false,
}: RailProps) {
	const pinnedKey = `${storagePrefix}.pinned`

	const [pinned, setPinned] = useState<boolean>(() => readBool(pinnedKey, true))
	const [hovered, setHovered] = useState(false)
	const [menuOpen, setMenuOpen] = useState(false)

	// Any of these signals expresses "keep the rail expanded right now."
	const wantsExpanded = alwaysExpanded || pinned || hovered || menuOpen

	// Debounced expanded state. Expand is immediate; collapse waits ~150ms so
	// transient signal drops (portal unmount, menu close while cursor is over
	// the rail, brief cursor exit between trigger and menu) don't snap-shut/open.
	// Hand-rolled because neither shadcn Sidebar nor Radix DropdownMenu ships
	// this — shadcn's Sidebar is click-only, Radix has no "keep anchor parent
	// expanded" hook. Standard sidebar UX pattern (macOS Finder, Notion).
	const [expanded, setExpanded] = useState<boolean>(() => wantsExpanded)
	useEffect(() => {
		if (wantsExpanded) {
			setExpanded(true)
			return
		}
		const id = window.setTimeout(() => setExpanded(false), 150)
		return () => window.clearTimeout(id)
	}, [wantsExpanded])

	const handleMenuOpenChange = useCallback((open: boolean) => {
		setMenuOpen(open)
	}, [])

	useEffect(() => {
		if (typeof window === "undefined") return
		window.localStorage.setItem(pinnedKey, pinned ? "1" : "0")
	}, [pinned, pinnedKey])

	useEffect(() => {
		onWidthChange?.(expanded ? APP_RAIL_WIDTH_OPEN : APP_RAIL_WIDTH_COLLAPSED)
	}, [expanded, onWidthChange])

	const togglePinned = () => {
		setPinned((p) => {
			const next = !p
			if (!next) setHovered(false)
			return next
		})
	}

	const navStyle: React.CSSProperties = {
		width: expanded ? APP_RAIL_WIDTH_OPEN : APP_RAIL_WIDTH_COLLAPSED,
		transition: alwaysExpanded ? undefined : "width 200ms ease-out",
	}

	return (
		<nav
			data-app-rail
			className={cn(
				"relative flex shrink-0 flex-col overflow-hidden border bg-background",
				!expanded && "items-center gap-1 py-3",
				floating ? "rounded-[10px]" : "rounded-r-[10px]",
				expanded && "z-[60]",
			)}
			style={navStyle}
			onMouseEnter={alwaysExpanded ? undefined : () => setHovered(true)}
			onMouseLeave={alwaysExpanded ? undefined : () => setHovered(false)}
		>
			{expanded ? (
				<>
					{alwaysExpanded ? (
						<WorkspaceSwitcher />
					) : (
						<div className="flex h-9 shrink-0 items-center justify-end border-b px-3">
							<Tooltip>
								<TooltipTrigger asChild>
									<Button
										variant="ghost"
										size="icon-xs"
										aria-label={
											pinned ? "Collapse sidebar" : "Pin sidebar open"
										}
										onClick={togglePinned}
										className="text-muted-foreground hover:bg-transparent hover:text-foreground dark:hover:bg-transparent"
									>
										{pinned ? (
											<ChevronsLeft className="size-4" />
										) : (
											<ChevronsRight className="size-4" />
										)}
									</Button>
								</TooltipTrigger>
								<TooltipContent side="right">
									{pinned ? "Collapse sidebar" : "Pin sidebar open"}
								</TooltipContent>
							</Tooltip>
						</div>
					)}
					<div className="flex min-w-0 flex-col gap-0.5 p-2">
						{items.map((item) => {
							// biome-ignore lint/suspicious/noExplicitAny: TanStack Router union of all routes
							const active = !!matchRoute({ to: item.to as any, fuzzy: true })
							return (
								<Button
									key={item.to}
									asChild
									variant="ghost"
									size="sm"
									className={cn(
										"min-w-0 justify-start gap-2 px-2 text-sm font-light text-muted-foreground hover:bg-transparent hover:text-foreground dark:hover:bg-transparent",
										active && "text-foreground hover:text-foreground",
									)}
								>
									{/* biome-ignore lint/suspicious/noExplicitAny: TanStack Router union of all routes */}
									<Link to={item.to as any} params={item.params as any}>
										<item.icon className="size-4 shrink-0" />
										<span className="min-w-0 truncate">{item.label}</span>
									</Link>
								</Button>
							)
						})}
					</div>
				</>
			) : (
				<>
					{items.map((item) => {
						// biome-ignore lint/suspicious/noExplicitAny: TanStack Router union of all routes
						const active = !!matchRoute({ to: item.to as any, fuzzy: true })
						return (
							<Tooltip key={item.to}>
								<TooltipTrigger asChild>
									<Button
										asChild
										variant="ghost"
										size="icon-sm"
										aria-label={item.label}
										className={cn(
											"size-9 text-muted-foreground hover:bg-transparent hover:text-foreground dark:hover:bg-transparent",
											active && "text-foreground hover:text-foreground",
										)}
									>
										{/* biome-ignore lint/suspicious/noExplicitAny: TanStack Router union of all routes */}
										<Link to={item.to as any} params={item.params as any}>
											<item.icon className="size-4" />
										</Link>
									</Button>
								</TooltipTrigger>
								<TooltipContent side="right">{item.label}</TooltipContent>
							</Tooltip>
						)
					})}
				</>
			)}

			{/*
			 * The AvatarMenu sits OUTSIDE the expanded/!expanded branches so its
			 * DropdownMenu doesn't unmount when the rail toggles. Otherwise opening
			 * the dropdown from a collapsed rail expands it, swaps tree position,
			 * unmounts the menu, and produces a close/open flash.
			 */}
			<div className="mt-auto">
				<AvatarMenu
					initials={initials}
					userName={userName}
					userEmail={userEmail}
					onSignOut={onSignOut}
					isSigningOut={isSigningOut}
					compact={!expanded}
					onOpenChange={handleMenuOpenChange}
				/>
			</div>
		</nav>
	)
}
