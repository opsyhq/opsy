import { useMutation } from "@tanstack/react-query"
import { useState } from "react"
import { toast } from "sonner"
import { APP_RAIL_WIDTH_OPEN } from "@/components/layout/railWidths"
import { Button } from "@/components/ui/button"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { authClient as auth } from "@/lib/auth"

// After leaving or deleting the active org, Better Auth nulls the session's
// activeOrganizationId. A hard reload (not a router nav) is the codebase
// convention for org-context changes — router.invalidate() races the
// RouterProvider re-render so _app.beforeLoad re-fires with a
// stale session. The reload lands on /onboarding (session still valid, no
// active org) or /login (session gone).
function reloadHome() {
	window.location.href = "/"
}

export function DangerZone({
	orgId,
	orgName,
	isOwner,
	canLeave,
}: {
	orgId: string
	orgName: string
	isOwner: boolean
	canLeave: boolean
}) {
	const [leaveOpen, setLeaveOpen] = useState(false)
	const [deleteOpen, setDeleteOpen] = useState(false)
	const [confirm, setConfirm] = useState("")

	const leaveOrg = useMutation({
		mutationFn: async () => {
			const { error } = await auth.organization.leave({
				organizationId: orgId,
			})
			if (error)
				throw new Error(error.message ?? "Could not leave the organization")
		},
		onSuccess: reloadHome,
		onError: (err) => toast.error((err as Error).message),
	})

	// Owner-only (server permission check). The beforeDeleteOrganization
	// hook returns CONFLICT if the org still owns infrastructure — that
	// message is shown verbatim.
	const deleteOrg = useMutation({
		mutationFn: async () => {
			const { error } = await auth.organization.delete({
				organizationId: orgId,
			})
			if (error)
				throw new Error(error.message ?? "Could not delete the organization")
		},
		onSuccess: reloadHome,
		onError: (err) => toast.error((err as Error).message),
	})

	const busy = leaveOrg.isPending || deleteOrg.isPending

	return (
		<>
			{isOwner && (
				<div className="flex flex-col gap-2">
					<Label>Delete Organisation</Label>
					<p className="text-xs text-muted-foreground/70">
						This action permanently deletes the organisation and all its data,
						including members, projects and integrations.
					</p>
					<div className="mt-2">
						<Button
							size="xs"
							className="h-7 bg-[#e23a3a] px-3 text-[11px] text-white hover:bg-red-500 dark:bg-[#e23a3a] dark:hover:bg-red-500"
							onClick={() => {
								setConfirm("")
								setDeleteOpen(true)
							}}
						>
							Delete Organisation
						</Button>
					</div>
				</div>
			)}

			{canLeave && (
				<div className="flex justify-end">
					<Button
						variant="outline"
						size="xs"
						className="h-7 px-3 text-[11px]"
						onClick={() => setLeaveOpen(true)}
					>
						Leave Organisation
					</Button>
				</div>
			)}

			<Dialog open={leaveOpen} onOpenChange={(o) => !busy && setLeaveOpen(o)}>
				<DialogContent showCloseButton={false}>
					<DialogHeader>
						<DialogTitle className="text-base font-medium tracking-tight">
							Leave organization
						</DialogTitle>
						<DialogDescription className="text-sm font-light text-muted-foreground">
							Are you sure you want to leave{" "}
							<span className="font-mono text-foreground">{orgName}</span>?
							You'll lose access until someone invites you back.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter className="sm:justify-between">
						<Button
							variant="outline"
							size="xs"
							className="h-7 px-3 text-[11px]"
							onClick={() => setLeaveOpen(false)}
							disabled={busy}
						>
							Cancel
						</Button>
						<Button
							size="xs"
							className="h-7 bg-[#e23a3a] px-3 text-[11px] text-white hover:bg-red-500 dark:bg-[#e23a3a] dark:hover:bg-red-500"
							onClick={() => leaveOrg.mutate()}
							disabled={busy}
						>
							{leaveOrg.isPending ? "Leaving…" : "Leave"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog open={deleteOpen} onOpenChange={(o) => !busy && setDeleteOpen(o)}>
				<DialogContent
					showCloseButton={false}
					overlayClassName="bg-black/50 z-[70]"
					className="z-[70] flex w-[min(520px,calc(100%-1.5rem))] max-w-none flex-col gap-0 overflow-hidden rounded-lg p-0 sm:max-w-none"
					style={{ left: `calc(50% + ${APP_RAIL_WIDTH_OPEN / 2}px)` }}
				>
					<header className="border-b px-4 py-3.5">
						<DialogTitle className="text-base font-medium tracking-tight">
							Delete Organisation
						</DialogTitle>
					</header>
					<div className="flex flex-col gap-2 px-4 py-6">
						<DialogDescription className="text-xs font-light text-muted-foreground">
							This permanently deletes{" "}
							<span className="font-mono text-foreground">{orgName}</span> and
							cannot be undone. Type the organisation name to confirm.
						</DialogDescription>
						<Input
							id="delete-org-confirm"
							aria-label="Type the organisation name to confirm"
							value={confirm}
							onChange={(e) => setConfirm(e.target.value)}
							placeholder={orgName}
							autoComplete="off"
						/>
					</div>
					<footer className="mt-auto flex items-center justify-between gap-2 border-t px-4 py-2.5">
						<Button
							variant="outline"
							size="xs"
							className="h-7 px-3 text-[11px]"
							onClick={() => setDeleteOpen(false)}
							disabled={busy}
						>
							Cancel
						</Button>
						<Button
							size="xs"
							className="h-7 bg-[#e23a3a] px-3 text-[11px] text-white hover:bg-red-500 dark:bg-[#e23a3a] dark:hover:bg-red-500"
							onClick={() => deleteOrg.mutate()}
							disabled={busy || confirm.trim() !== orgName}
						>
							{deleteOrg.isPending ? "Deleting…" : "Delete"}
						</Button>
					</footer>
				</DialogContent>
			</Dialog>
		</>
	)
}
