import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { authClient as auth } from "@/lib/auth"

// Sole sign-in method while email magic-link is parked (see login.tsx). Shared
// so the login screen and the invite landing page render the identical button;
// each passes its own `callbackURL` to control where Google returns to.
export function GoogleSignInButton({
	callbackURL,
	label = "Continue with Google",
}: {
	callbackURL: string
	label?: string
}) {
	const [submitting, setSubmitting] = useState(false)

	async function handleClick() {
		setSubmitting(true)
		try {
			// Success is a full-page redirect to Google, so on the happy path the
			// page navigates away before this resolves. Reaching here means the
			// redirect didn't fire (HTTP error → { error }, or a network reject) —
			// re-enable the button and surface why, instead of leaving it stuck.
			const { error } = await auth.signIn.social({
				provider: "google",
				callbackURL,
			})
			if (error)
				throw new Error(error.message ?? "Couldn't start Google sign-in")
		} catch (err) {
			setSubmitting(false)
			toast.error((err as Error).message)
		}
	}

	return (
		<Button
			variant="outline"
			className="w-full"
			disabled={submitting}
			onClick={handleClick}
		>
			<GoogleMark />
			{label}
		</Button>
	)
}

function GoogleMark() {
	return (
		<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
			<path
				fill="#4285F4"
				d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.09Z"
			/>
			<path
				fill="#34A853"
				d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.98.66-2.23 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
			/>
			<path
				fill="#FBBC05"
				d="M5.84 14.09a6.6 6.6 0 0 1 0-4.18V7.07H2.18a11 11 0 0 0 0 9.86l3.66-2.84Z"
			/>
			<path
				fill="#EA4335"
				d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z"
			/>
		</svg>
	)
}
