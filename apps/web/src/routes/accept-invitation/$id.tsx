import { useMutation, useQuery } from "@tanstack/react-query"
import { createFileRoute, useRouteContext } from "@tanstack/react-router"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { AuthLayout } from "@/components/AuthLayout"
import { GoogleSignInButton } from "@/components/GoogleSignInButton"
import { Button } from "@/components/ui/button"
import { authClient as auth } from "@/lib/auth"
import {
	invitationPreviewQueryOptions,
	invitationQueryOptions,
} from "@/lib/invitationReactQuery"

// Lives OUTSIDE _app on purpose: a brand-new invitee has no active
// org, and _app's guard would bounce them to /onboarding (the
// create-your-own-org form) before they could accept. We don't gate in
// beforeLoad either — a logged-out visitor should see WHERE they've been
// invited and sign in right here (the Vercel/Linear/Notion pattern), not get
// bounced to a bare /login.
export const Route = createFileRoute("/accept-invitation/$id")({
	loader: ({ context, params }) => {
		// Warm the logged-out preview so the page paints with org context instead
		// of a spinner. prefetchQuery swallows errors, so an invalid invite still
		// renders the in-page "unavailable" message rather than tripping the route
		// error boundary. Signed-in visitors use getInvitation (needs the session),
		// which the component fetches on mount.
		if (!context.session?.user) {
			return context.queryClient.prefetchQuery(
				invitationPreviewQueryOptions(params.id),
			)
		}
	},
	component: AcceptInvitationPage,
})

// "a member" / "an admin" — role is dynamic, so the article has to be too.
const article = (word: string) => (/^[aeiou]/i.test(word) ? "an" : "a")

const loadingView = (
	<AuthLayout title="Checking invitation…">
		<div className="flex justify-center">
			<Loader2 className="animate-spin text-muted-foreground" />
		</div>
	</AuthLayout>
)

function AcceptInvitationPage() {
	const { id } = Route.useParams()
	const session = useRouteContext({
		from: "__root__",
		select: (context) => context.session,
	})
	const signedIn = !!session?.user

	// Exactly one of these runs (the other stays disabled): logged-out visitors
	// get the public preview, signed-in ones get the full invite. The enabled
	// query folds loading / error / caching into React Query, so there's no
	// manual state machine to keep in sync.
	const previewQuery = useQuery({
		...invitationPreviewQueryOptions(id),
		enabled: !signedIn,
	})
	const invitationQuery = useQuery({
		...invitationQueryOptions(id),
		enabled: signedIn,
	})

	const accept = useMutation({
		mutationFn: async () => {
			const { data, error } = await auth.organization.acceptInvitation({
				invitationId: id,
			})
			if (error) throw new Error(error.message ?? "Could not accept invitation")
			const orgId =
				data?.member.organizationId ?? invitationQuery.data?.organizationId
			// Route through setActive + hard reload (codebase convention for
			// org-context changes — see onboarding.tsx) so the signed session cookie
			// picks up the new activeOrganizationId before any guard runs.
			if (orgId) await auth.organization.setActive({ organizationId: orgId })
			window.location.href = "/"
		},
		onError: (err) => toast.error((err as Error).message),
	})

	const decline = useMutation({
		mutationFn: () => auth.organization.rejectInvitation({ invitationId: id }),
		// Non-fatal — leave regardless of whether the reject call succeeded.
		onSettled: () => {
			window.location.href = "/"
		},
	})

	const busy = accept.isPending || decline.isPending

	// Logged-out: invite context from the public preview, with sign-in embedded
	// right here. Google returns to this same page, where the signed-in branch
	// then takes over with the full accept/decline flow.
	if (!signedIn) {
		if (previewQuery.isPending) return loadingView
		if (previewQuery.isError) {
			return (
				<AuthLayout
					title="Invitation unavailable"
					description={previewQuery.error.message}
				/>
			)
		}
		const preview = previewQuery.data
		const callbackURL = `${window.location.origin}/accept-invitation/${id}`
		return (
			<AuthLayout
				title={`Join ${preview.organizationName}`}
				description={`You've been invited to join as ${article(preview.role)} ${preview.role}. Sign in to continue.`}
			>
				<GoogleSignInButton callbackURL={callbackURL} />
			</AuthLayout>
		)
	}

	if (invitationQuery.isPending) return loadingView
	if (invitationQuery.isError) {
		return (
			<AuthLayout
				title="Invitation unavailable"
				description={invitationQuery.error.message}
			>
				<div className="flex flex-col gap-3">
					{/* Most common cause is an email mismatch — signed in as the wrong
					    account. Offer a way out. */}
					<p className="text-center text-xs text-muted-foreground">
						You're signed in as{" "}
						<span className="font-medium text-foreground">
							{session?.user?.email}
						</span>
						.
					</p>
					<Button
						variant="outline"
						className="w-full"
						onClick={() => {
							window.location.href = "/"
						}}
					>
						Go to Opsy
					</Button>
				</div>
			</AuthLayout>
		)
	}

	const invite = invitationQuery.data
	return (
		<AuthLayout
			title={`Join ${invite.organizationName}`}
			description={
				<>
					<span className="font-medium text-foreground">
						{invite.inviterEmail}
					</span>{" "}
					invited you to join as {article(invite.role)} {invite.role}.
				</>
			}
		>
			<div className="flex flex-col gap-3">
				<Button
					className="w-full"
					onClick={() => accept.mutate()}
					disabled={busy}
				>
					{accept.isPending && <Loader2 className="animate-spin" />}
					{accept.isPending ? "Joining…" : `Join ${invite.organizationName}`}
				</Button>
				<Button
					variant="outline"
					className="w-full"
					onClick={() => decline.mutate()}
					disabled={busy}
				>
					Decline
				</Button>
			</div>
		</AuthLayout>
	)
}
