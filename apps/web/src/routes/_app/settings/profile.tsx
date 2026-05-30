import { createFileRoute } from "@tanstack/react-router"
import { useState } from "react"
import { toast } from "sonner"
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
import { signOut } from "@/lib/auth/signOut"
import { DeleteAccountSection } from "./-DeleteAccountSection"

export const Route = createFileRoute("/_app/settings/profile")({
	component: ProfilePage,
})

function ProfilePage() {
	const { data: session } = auth.useSession()
	const [signingOut, setSigningOut] = useState(false)
	const [signOutOpen, setSignOutOpen] = useState(false)

	const user = session?.user

	async function handleSignOut() {
		setSigningOut(true)
		try {
			await signOut()
		} catch (err) {
			setSigningOut(false)
			toast.error((err as Error).message)
		}
	}

	return (
		<div className="flex min-w-0 flex-1 flex-col px-2">
			<div className="h-full w-full overflow-y-auto rounded-[10px] border bg-background">
				<div className="mx-auto w-full min-w-0 max-w-2xl px-8 py-10">
					<div className="flex items-end justify-between gap-3">
						<div>
							<h2 className="text-2xl font-medium tracking-tight">Profile</h2>
							<p className="mt-1 text-sm font-light text-muted-foreground">
								Your account and session.
							</p>
						</div>
						<Button
							variant="outline"
							size="xs"
							className="h-7 px-3 text-[11px]"
							onClick={() => setSignOutOpen(true)}
							disabled={signingOut}
						>
							{signingOut ? "Signing out…" : "Sign out"}
						</Button>
					</div>

					<div className="mt-8 flex flex-col gap-8">
						<div className="flex flex-col gap-2">
							<Label>Name</Label>
							<Input value={user?.name ?? ""} readOnly />
							<p className="text-xs text-muted-foreground/70">
								The display name associated with your account.
							</p>
						</div>

						<div className="flex flex-col gap-2">
							<Label>Email</Label>
							<Input value={user?.email ?? ""} readOnly />
							<p className="text-xs text-muted-foreground/70">
								The email address associated with your account.
							</p>
						</div>

						{user?.email && <DeleteAccountSection email={user.email} />}

						<Dialog
							open={signOutOpen}
							onOpenChange={(o) => !signingOut && setSignOutOpen(o)}
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
										variant="outline"
										size="xs"
										className="h-7 px-3 text-[11px]"
										onClick={() => setSignOutOpen(false)}
										disabled={signingOut}
									>
										Cancel
									</Button>
									<Button
										variant="outline"
										size="xs"
										className="h-7 px-3 text-[11px]"
										onClick={handleSignOut}
										disabled={signingOut}
									>
										{signingOut ? "Signing out…" : "Sign out"}
									</Button>
								</DialogFooter>
							</DialogContent>
						</Dialog>
					</div>
				</div>
			</div>
		</div>
	)
}
