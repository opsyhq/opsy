import { useSearch } from "@tanstack/react-router"
import { Loader2Icon } from "lucide-react"
import { useState } from "react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { authClient } from "@/lib/auth"

type LoginState =
	| { kind: "idle"; message: string | null; error: string | null }
	| { kind: "submitting" }

export function LoginPage() {
	const search = useSearch({ from: "/login" })
	const [email, setEmail] = useState("")
	const [state, setState] = useState<LoginState>({
		kind: "idle",
		message: null,
		error: null,
	})
	const callbackURL = (() => {
		try {
			const url = new URL(search.redirect || "/", window.location.origin)
			return url.origin === window.location.origin
				? url.toString()
				: new URL("/", window.location.origin).toString()
		} catch {
			return new URL("/", window.location.origin).toString()
		}
	})()
	const submitting = state.kind === "submitting"

	async function handleMagicLink(event: React.FormEvent) {
		event.preventDefault()
		setState({ kind: "submitting" })
		const { error } = await authClient.signIn.magicLink({ email, callbackURL })
		setState(
			error
				? {
						kind: "idle",
						message: null,
						error: error.message ?? "Magic link request failed",
					}
				: {
						kind: "idle",
						message: "Check your email or the API logs for the sign-in link.",
						error: null,
					},
		)
	}

	async function handleGoogle() {
		await authClient.signIn.social({ provider: "google", callbackURL })
	}

	return (
		<div className="flex min-h-[calc(100vh-3rem)] items-center justify-center px-4 py-10">
			<div className="w-full max-w-sm space-y-5">
				<div className="space-y-1 text-center">
					<h1 className="text-2xl font-semibold tracking-normal">
						Thinking Blocks
					</h1>
					<p className="text-sm text-muted-foreground">Sign in to inspect</p>
				</div>

				<form className="space-y-3" onSubmit={handleMagicLink}>
					<label className="space-y-2 text-sm font-medium" htmlFor="email">
						<span>Email</span>
						<Input
							autoComplete="email"
							id="email"
							onChange={(event) => setEmail(event.target.value)}
							placeholder="admin@example.com"
							required
							type="email"
							value={email}
						/>
					</label>
					<Button className="w-full" disabled={submitting} type="submit">
						{submitting && <Loader2Icon className="size-4 animate-spin" />}
						Send magic link
					</Button>
				</form>

				<Button
					className="w-full"
					disabled={submitting}
					onClick={handleGoogle}
					type="button"
					variant="outline"
				>
					Continue with Google
				</Button>

				{state.kind === "idle" && state.message && (
					<Alert>
						<AlertTitle>Magic link sent</AlertTitle>
						<AlertDescription>{state.message}</AlertDescription>
					</Alert>
				)}

				{state.kind === "idle" && state.error && (
					<Alert variant="destructive">
						<AlertTitle>Sign in failed</AlertTitle>
						<AlertDescription>{state.error}</AlertDescription>
					</Alert>
				)}
			</div>
		</div>
	)
}
