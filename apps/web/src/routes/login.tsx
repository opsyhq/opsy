import { createFileRoute, redirect } from "@tanstack/react-router"
import { AuthLayout } from "@/components/AuthLayout"
import { GoogleSignInButton } from "@/components/GoogleSignInButton"

interface LoginSearch {
	redirect?: string
}

export const Route = createFileRoute("/login")({
	validateSearch: (search: Record<string, unknown>): LoginSearch => ({
		redirect: typeof search.redirect === "string" ? search.redirect : undefined,
	}),
	beforeLoad: ({ context }) => {
		if (context.session?.user) {
			throw redirect({ to: "/" })
		}
	},
	component: LoginPage,
})

function LoginPage() {
	const { redirect: redirectTo } = Route.useSearch()
	const webOrigin = typeof window !== "undefined" ? window.location.origin : ""
	const callbackURL = redirectTo
		? new URL(redirectTo, webOrigin).toString()
		: `${webOrigin}/`

	return (
		<AuthLayout title="Sign in to Opsy">
			<GoogleSignInButton callbackURL={callbackURL} />
		</AuthLayout>
	)
}
