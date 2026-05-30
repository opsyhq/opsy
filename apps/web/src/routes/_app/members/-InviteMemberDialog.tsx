import { useMutation } from "@tanstack/react-query"
import { Loader2 } from "lucide-react"
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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select"
import { authClient as auth } from "@/lib/auth"

export function InviteMemberDialog({
	orgId,
	open,
	onOpenChange,
}: {
	orgId: string
	open: boolean
	onOpenChange: (open: boolean) => void
}) {
	const [email, setEmail] = useState("")
	const [role, setRole] = useState<"member" | "admin">("member")

	const invite = useMutation({
		mutationFn: async (input: { email: string; role: "member" | "admin" }) => {
			const { error } = await auth.organization.inviteMember({
				email: input.email,
				role: input.role,
				organizationId: orgId,
			})
			if (error)
				throw new Error(error.message ?? "Could not send the invitation")
			return input.email
		},
		onSuccess: (sentTo) => {
			toast.success(`Invitation sent to ${sentTo}`)
			setEmail("")
			onOpenChange(false)
		},
		onError: (err) => toast.error((err as Error).message),
	})

	const busy = invite.isPending

	function handleInvite(e: React.FormEvent) {
		e.preventDefault()
		const trimmed = email.trim()
		if (!trimmed || busy) return
		invite.mutate({ email: trimmed, role })
	}

	function handleOpenChange(next: boolean) {
		if (busy) return
		if (!next) {
			setEmail("")
			setRole("member")
			invite.reset()
		}
		onOpenChange(next)
	}

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent showCloseButton={false}>
				<DialogHeader>
					<DialogTitle className="text-base font-medium tracking-tight">
						Add member
					</DialogTitle>
					<DialogDescription className="text-sm font-light text-muted-foreground">
						We'll email an invitation link. They join once they accept.
					</DialogDescription>
				</DialogHeader>
				<form onSubmit={handleInvite} className="flex flex-col gap-3">
					<div className="flex flex-col gap-2">
						<Label htmlFor="invite-email">Email</Label>
						<div className="flex gap-2">
							<Input
								id="invite-email"
								type="email"
								placeholder="colleague@example.com"
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								autoComplete="off"
								autoFocus
								required
								disabled={busy}
								className="flex-1"
							/>
							<Select
								value={role}
								onValueChange={(v) => setRole(v as "member" | "admin")}
							>
								<SelectTrigger className="w-28">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="member">Member</SelectItem>
									<SelectItem value="admin">Admin</SelectItem>
								</SelectContent>
							</Select>
						</div>
					</div>
					<DialogFooter className="sm:justify-between">
						<Button
							type="button"
							variant="outline"
							size="xs"
							className="h-7 px-3 text-[11px]"
							onClick={() => handleOpenChange(false)}
							disabled={busy}
						>
							Cancel
						</Button>
						<Button
							type="submit"
							variant="outline"
							size="xs"
							className="h-7 px-3 text-[11px]"
							disabled={busy || !email.trim()}
						>
							{busy && <Loader2 className="size-3 animate-spin" />}
							{busy ? "Sending…" : "Send invitation"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	)
}
