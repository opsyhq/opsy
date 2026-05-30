import {
	createFileRoute,
	Outlet,
	redirect,
	useMatchRoute,
} from "@tanstack/react-router"
import type { CSSProperties } from "react"
import { useState } from "react"
import { toast } from "sonner"
import { AppRail } from "@/components/layout/AppRail"
import { CanvasBackground } from "@/components/layout/CanvasBackground"
import { RightRailSlotContext } from "@/components/layout/RightRailSlot"
import { APP_RAIL_WIDTH_OPEN } from "@/components/layout/railWidths"
import { TopBar } from "@/components/layout/TopBar"
import { signOut } from "@/lib/auth/signOut"

export const Route = createFileRoute("/_app")({
	beforeLoad: ({ context, location }) => {
		if (!context.session?.user) {
			throw redirect({
				to: "/login",
				search: { redirect: location.href },
			})
		}
		if (!context.session.session?.activeOrganizationId) {
			throw redirect({ to: "/onboarding" })
		}
	},
	component: AuthenticatedLayout,
})

function AuthenticatedLayout() {
	const [isSigningOut, setIsSigningOut] = useState(false)
	const [rightRail, setRightRail] = useState<HTMLDivElement | null>(null)
	const [leftRailWidth, setLeftRailWidth] = useState(APP_RAIL_WIDTH_OPEN)
	const matchRoute = useMatchRoute()

	const onArchitecture = !!matchRoute({
		to: "/projects/$projectSlug/architecture",
		fuzzy: true,
	})

	async function handleSignOut() {
		if (isSigningOut) return
		setIsSigningOut(true)
		try {
			await signOut()
		} catch (err) {
			console.error("[auth] signOut failed", err)
			setIsSigningOut(false)
			toast.error("Sign out failed", {
				description: err instanceof Error ? err.message : String(err),
			})
		}
	}

	if (onArchitecture) {
		return (
			<RightRailSlotContext.Provider value={rightRail}>
				<CanvasBackground />
				<div
					className="relative h-svh overflow-hidden"
					style={{ "--app-rail-width": `${leftRailWidth}px` } as CSSProperties}
				>
					<main className="absolute inset-0 flex">
						<Outlet />
					</main>
					<div className="pointer-events-none absolute top-0 left-0 z-20">
						<div className="pointer-events-auto">
							<TopBar />
						</div>
					</div>
					<div className="pointer-events-none absolute top-14 bottom-0 left-0 flex">
						<div className="pointer-events-auto flex h-full">
							<AppRail
								onSignOut={handleSignOut}
								isSigningOut={isSigningOut}
								onWidthChange={setLeftRailWidth}
							/>
						</div>
					</div>
					<div
						ref={setRightRail}
						className="pointer-events-none absolute top-14 right-0 bottom-0 flex justify-end [&>*]:pointer-events-auto"
					/>
				</div>
			</RightRailSlotContext.Provider>
		)
	}

	return (
		<RightRailSlotContext.Provider value={rightRail}>
			<CanvasBackground />
			<div className="flex h-svh flex-col overflow-hidden">
				<TopBar />
				<div className="flex min-h-0 flex-1">
					<AppRail onSignOut={handleSignOut} isSigningOut={isSigningOut} />
					<main className="flex min-h-0 min-w-0 flex-1">
						<Outlet />
					</main>
					<div ref={setRightRail} className="flex shrink-0" />
				</div>
			</div>
		</RightRailSlotContext.Provider>
	)
}
