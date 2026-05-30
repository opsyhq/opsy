import { useMutation, useQuery } from "@tanstack/react-query"
import { createFileRoute, redirect } from "@tanstack/react-router"
import { Loader2 } from "lucide-react"
import { useState } from "react"
import { AuthLayout } from "@/components/AuthLayout"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { api } from "@/lib/api"
import { authClient } from "@/lib/auth"
import { userInvitationsQueryOptions } from "@/lib/invitationReactQuery"

export const Route = createFileRoute("/_authed/onboarding")({
	beforeLoad: ({ context }) => {
		if (context.session?.session?.activeOrganizationId) {
			throw redirect({ to: "/" })
		}
	},
	component: OnboardingPage,
})

function OnboardingPage() {
	const [name, setName] = useState("")
	const [consent, setConsent] = useState(false)
	const [error, setError] = useState<string | null>(null)

	// Surface invitations addressed to this user's email so an invitee who lands
	// here (instead of clicking the email link) can join rather than being forced
	// to create their own org. Matches by email server-side, so an invite to a
	// different address won't appear — the emailed accept link still works.
	const { data: invitations } = useQuery(userInvitationsQueryOptions())
	const invites = (invitations ?? []).filter((i) => i.status === "pending")

	const createOrg = useMutation({
		mutationFn: async (input: { name: string }) => {
			const res = await api.onboarding.$post({
				json: { name: input.name, consent: true },
			})
			if (!res.ok) {
				const body = (await res.json().catch(() => null)) as {
					error?: string
					message?: string
				} | null
				throw new Error(
					body?.message ?? body?.error ?? `Onboarding failed (${res.status})`,
				)
			}
			const { orgId } = await res.json()
			// Route through Better Auth so the signed session cookie cache picks up
			// the new activeOrganizationId, then hard-reload: router.invalidate()
			// races React's re-render of the RouterProvider context, so beforeLoad
			// re-fires with stale session data.
			await authClient.organization.setActive({ organizationId: orgId })
			window.location.href = "/"
		},
		onError: (err) =>
			setError(err instanceof Error ? err.message : String(err)),
	})

	const submitting = createOrg.isPending
	const ready = consent && name.trim().length > 0

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault()
		if (submitting || !ready) return
		setError(null)
		createOrg.mutate({ name: name.trim() })
	}

	return (
		<AuthLayout
			title="Welcome to Opsy"
			description="Name your organization to get started."
		>
			{invites.length > 0 && (
				<div className="mb-6 flex flex-col gap-3">
					<p className="text-sm text-muted-foreground">
						You've been invited to join:
					</p>
					{invites.map((inv) => (
						<Button
							key={inv.id}
							variant="outline"
							className="w-full justify-start"
							onClick={() => {
								window.location.href = `/accept-invitation/${inv.id}`
							}}
						>
							<span className="min-w-0 truncate">
								Join {inv.organizationName}
							</span>
							<span className="ml-auto text-xs text-muted-foreground">
								{inv.role}
							</span>
						</Button>
					))}
					<div className="my-2 flex items-center gap-3">
						<span className="h-px flex-1 bg-border" />
						<span className="text-xs tracking-wide text-muted-foreground/70 uppercase">
							or create your own
						</span>
						<span className="h-px flex-1 bg-border" />
					</div>
				</div>
			)}

			<form onSubmit={handleSubmit} className="flex flex-col gap-4">
				<div className="flex flex-col gap-2">
					<Label htmlFor="org-name">Organization name</Label>
					<Input
						id="org-name"
						type="text"
						placeholder="Acme Inc."
						value={name}
						onChange={(e) => setName(e.target.value)}
						maxLength={64}
						autoFocus
						required
						disabled={submitting}
					/>
				</div>

				<label
					htmlFor="consent"
					className="flex items-start gap-3 text-sm leading-relaxed"
				>
					<Checkbox
						id="consent"
						className="mt-0.5"
						checked={consent}
						onCheckedChange={(checked) => setConsent(checked === true)}
						disabled={submitting}
						required
					/>
					<span className="text-muted-foreground">
						I agree to the{" "}
						<a
							href="/terms"
							target="_blank"
							rel="noreferrer"
							className="text-foreground underline underline-offset-2"
						>
							Terms of Service
						</a>
						{" and "}
						<a
							href="/privacy"
							target="_blank"
							rel="noreferrer"
							className="text-foreground underline underline-offset-2"
						>
							Privacy Policy
						</a>
						.
					</span>
				</label>

				<div
					role="alert"
					aria-live="polite"
					className="min-h-[1.25rem] text-center text-sm"
				>
					{error && <span className="text-destructive">{error}</span>}
				</div>

				<Button
					type="submit"
					className="w-full"
					disabled={!ready || submitting}
				>
					{submitting && <Loader2 className="animate-spin" />}
					{submitting ? "Creating…" : "Create organization"}
				</Button>
			</form>
		</AuthLayout>
	)
}
