import { useMutation } from "@tanstack/react-query"
import { createFileRoute, redirect } from "@tanstack/react-router"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { authClient } from "@/lib/auth"

type DeviceSearch = { user_code?: string }

export const Route = createFileRoute("/device")({
	validateSearch: (search: Record<string, unknown>): DeviceSearch => ({
		user_code:
			typeof search.user_code === "string" ? search.user_code : undefined,
	}),
	beforeLoad: ({ context, location }) => {
		if (!context.session?.user) {
			throw redirect({
				to: "/login",
				search: { redirect: location.href },
			})
		}
	},
	component: DevicePage,
})

function DevicePage() {
	const { user_code: initialCode } = Route.useSearch()
	const [code, setCode] = useState(initialCode ?? "")
	const [error, setError] = useState<string | null>(null)
	const [outcome, setOutcome] = useState<"approved" | "denied" | null>(null)

	const submit = useMutation({
		mutationFn: async (action: "approve" | "deny") => {
			const formattedCode = code.trim().replace(/-/g, "").toUpperCase()
			const { error: respError } =
				action === "approve"
					? await authClient.device.approve({ userCode: formattedCode })
					: await authClient.device.deny({ userCode: formattedCode })
			if (respError) {
				throw new Error(
					respError.error_description ?? respError.error ?? "Request failed",
				)
			}
			return action
		},
		onSuccess: (action) =>
			setOutcome(action === "approve" ? "approved" : "denied"),
		onError: (err) =>
			setError(err instanceof Error ? err.message : String(err)),
	})

	function handle(action: "approve" | "deny") {
		if (outcome || submit.isPending) return
		setError(null)
		submit.mutate(action)
	}

	if (outcome) {
		return (
			<div className="flex min-h-screen items-center justify-center px-4">
				<Card className="w-full max-w-sm text-center">
					<CardHeader>
						<CardTitle className="text-2xl">
							{outcome === "approved" ? "Device approved" : "Device denied"}
						</CardTitle>
						<CardDescription>
							{outcome === "approved"
								? "You can return to your terminal."
								: "The device will not be granted access."}
						</CardDescription>
					</CardHeader>
				</Card>
			</div>
		)
	}

	const submittingAction = submit.isPending ? submit.variables : null

	return (
		<div className="flex min-h-screen items-center justify-center px-4">
			<Card className="w-full max-w-md">
				<CardHeader>
					<CardTitle className="text-2xl">Approve device</CardTitle>
					<CardDescription>
						A device is requesting access to your Opsy account. Confirm the code
						matches what you see in your terminal.
					</CardDescription>
				</CardHeader>
				<CardContent className="flex flex-col gap-4">
					<Input
						type="text"
						value={code}
						onChange={(e) => setCode(e.target.value)}
						required
						autoFocus={!initialCode}
						className="text-center font-mono text-2xl tracking-widest uppercase"
					/>
					{error && (
						<p className="text-center text-sm text-destructive">{error}</p>
					)}
					<div className="flex gap-2">
						<Button
							className="flex-1"
							onClick={() => handle("approve")}
							disabled={submittingAction !== null || !code}
						>
							{submittingAction === "approve" ? "Approving..." : "Approve"}
						</Button>
						<Button
							variant="outline"
							className="flex-1"
							onClick={() => handle("deny")}
							disabled={submittingAction !== null || !code}
						>
							{submittingAction === "deny" ? "Denying..." : "Deny"}
						</Button>
					</div>
				</CardContent>
			</Card>
		</div>
	)
}
