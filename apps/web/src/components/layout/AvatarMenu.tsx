import { Link } from "@tanstack/react-router"
import { LogOut, User } from "lucide-react"
import { useState } from "react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

export function AvatarMenu({
	initials,
	userName,
	userEmail,
	onSignOut,
	isSigningOut,
	compact = false,
	onOpenChange,
}: {
	initials: string
	userName: string
	userEmail: string
	onSignOut: () => void
	isSigningOut: boolean
	compact?: boolean
	onOpenChange?: (open: boolean) => void
}) {
	const [signOutOpen, setSignOutOpen] = useState(false)

	return (
		<DropdownMenu onOpenChange={onOpenChange}>
			{/*
			 * Trigger must be a stable DOM element across compact/expanded.
			 * If the underlying element swaps (e.g. <Button> ↔ <button>), Radix's
			 * DropdownMenuTrigger loses its anchor and the menu dismisses — which
			 * is exactly what happens when the rail expands on menu-open from a
			 * collapsed start. Same <button>, different styling and children.
			 */}
			<DropdownMenuTrigger asChild>
				<button
					type="button"
					aria-label="Account"
					className={cn(
						"group cursor-pointer outline-none transition-colors focus-visible:ring-0",
						compact
							? "flex size-11 items-center justify-center rounded-full p-0 hover:bg-transparent dark:hover:bg-transparent"
							: "flex w-full min-w-0 items-center gap-2 border-t px-3 py-2 text-left hover:bg-accent/30",
					)}
				>
					<Avatar className={compact ? "size-9" : "size-8 shrink-0"}>
						<AvatarFallback
							className={cn(
								"text-xs",
								compact && "transition-colors group-hover:bg-[#4a4a48]",
							)}
						>
							{initials}
						</AvatarFallback>
					</Avatar>
					{!compact && (
						<div className="flex min-w-0 flex-col">
							<span className="truncate text-xs font-medium">{userName}</span>
							{userEmail && userEmail !== userName && (
								<span className="truncate text-[11px] text-muted-foreground">
									{userEmail}
								</span>
							)}
						</div>
					)}
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent
				side={compact ? "right" : "top"}
				align={compact ? "end" : "start"}
				// Rail nav is z-[60] when expanded; the menu portals to body at the
				// default z-50, so without this it paints *behind* the rail. Sit above.
				className="z-[70] w-48"
			>
				<DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
					{userEmail || userName}
				</DropdownMenuLabel>
				<DropdownMenuSeparator />
				<DropdownMenuItem asChild>
					<Link to="/settings/profile">
						<User />
						Profile
					</Link>
				</DropdownMenuItem>
				<DropdownMenuItem
					onClick={() => setSignOutOpen(true)}
					disabled={isSigningOut}
				>
					<LogOut />
					Sign out
				</DropdownMenuItem>
			</DropdownMenuContent>
			<Dialog
				open={signOutOpen}
				onOpenChange={(o) => !isSigningOut && setSignOutOpen(o)}
			>
				<DialogContent showCloseButton={false}>
					<DialogHeader>
						<DialogTitle className="text-base font-medium tracking-tight">
							Sign out
						</DialogTitle>
						<DialogDescription className="text-sm font-light text-muted-foreground">
							Are you sure you want to sign out of Opsy on this device?
						</DialogDescription>
					</DialogHeader>
					<DialogFooter className="sm:justify-between">
						<Button
							size="xs"
							className="h-7 px-3 text-[11px]"
							onClick={() => setSignOutOpen(false)}
							disabled={isSigningOut}
						>
							Cancel
						</Button>
						<Button
							variant="outline"
							size="xs"
							className="h-7 px-3 text-[11px]"
							onClick={onSignOut}
							disabled={isSigningOut}
						>
							{isSigningOut ? "Signing out…" : "Sign out"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</DropdownMenu>
	)
}
