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

export function DeleteAccountSection({ email }: { email: string }) {
	const [open, setOpen] = useState(false)
	const [confirm, setConfirm] = useState("")
	const [submitting, setSubmitting] = useState(false)

	const armed = confirm.trim() === email && !submitting

	async function handleDelete() {
		setSubmitting(true)
		try {
			// sendDeleteAccountVerification is configured server-side, so this
			// dispatches a confirmation email rather than deleting now. The
			// link lands on the API's /delete-user/callback, which runs the
			// beforeDelete hook (the sole-owner-with-infra CONFLICT guard) and
			// then redirects to callbackURL.
			const { error } = await auth.deleteUser({
				callbackURL: `${window.location.origin}/login`,
			})
			if (error)
				throw new Error(error.message ?? "Account deletion request failed")
			setOpen(false)
			toast.success("Check your email to confirm deleting your account.", {
				description:
					"The link expires shortly. If you solely own an organization with active infrastructure, tear it down first or the confirmation will be rejected.",
			})
		} catch (err) {
			toast.error((err as Error).message)
		} finally {
			setSubmitting(false)
		}
	}

	return (
		<>
			<div className="flex flex-col gap-2">
				<Label>Delete Account</Label>
				<p className="text-xs text-muted-foreground/70">
					This action permanently deletes your account and removes you from all
					organisations you belong to.
				</p>
				<div className="mt-2">
					<Button
						size="xs"
						className="h-7 bg-[#e23a3a] px-3 text-[11px] text-white hover:bg-red-500 dark:bg-[#e23a3a] dark:hover:bg-red-500"
						onClick={() => {
							setConfirm("")
							setOpen(true)
						}}
					>
						Delete Account
					</Button>
				</div>
			</div>

			<Dialog open={open} onOpenChange={(o) => !submitting && setOpen(o)}>
				<DialogContent showCloseButton={false}>
					<DialogHeader>
						<DialogTitle className="text-base font-medium tracking-tight">
							Delete account
						</DialogTitle>
						<DialogDescription className="text-sm font-light text-muted-foreground">
							We'll email a confirmation link to{" "}
							<span className="font-mono text-foreground">{email}</span>. Your
							account is deleted only after you click it. This action cannot be
							undone. Type your email to confirm.
						</DialogDescription>
					</DialogHeader>
					<Input
						value={confirm}
						onChange={(e) => setConfirm(e.target.value)}
						placeholder={email}
						autoComplete="off"
					/>
					<DialogFooter className="sm:justify-between">
						<Button
							variant="outline"
							size="xs"
							className="h-7 px-3 text-[11px]"
							onClick={() => setOpen(false)}
							disabled={submitting}
						>
							Cancel
						</Button>
						<Button
							variant="outline"
							size="xs"
							className="h-7 px-3 text-[11px]"
							onClick={handleDelete}
							disabled={!armed}
						>
							{submitting ? "Sending…" : "Send the link"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	)
}
