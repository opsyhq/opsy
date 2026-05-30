import { useMutation } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card"
import { authClient } from "@/lib/auth"

type ConsentSearch = {
	client_id?: string
	scope?: string
}

export const Route = createFileRoute("/_app/consent")({
	validateSearch: (search: Record<string, unknown>): ConsentSearch => ({
		client_id:
			typeof search.client_id === "string" ? search.client_id : undefined,
		scope: typeof search.scope === "string" ? search.scope : undefined,
	}),
	component: ConsentPage,
})

function ConsentPage() {
	const search = Route.useSearch()
	const [error, setError] = useState<string | null>(null)

	const submit = useMutation({
		mutationFn: async (decision: "approve" | "deny") => {
			const { data, error: respError } = await authClient.oauth2.consent({
				accept: decision === "approve",
				scope: search.scope,
			})
			if (respError) {
				throw new Error(respError.message ?? respError.code ?? "Consent failed")
			}
			if (data?.redirect && data.url) {
				window.location.href = data.url
			}
		},
		onError: (err) =>
			setError(err instanceof Error ? err.message : String(err)),
	})

	function decide(decision: "approve" | "deny") {
		if (submit.isPending) return
		setError(null)
		submit.mutate(decision)
	}

	const scopes = (search.scope ?? "").split(/\s+/).filter(Boolean)
	const submittingAction = submit.isPending ? submit.variables : null

	return (
		<div className="flex min-h-screen items-center justify-center px-4">
			<Card className="w-full max-w-md">
				<CardHeader>
					<CardTitle className="text-2xl">Authorize application</CardTitle>
					<CardDescription>
						<span className="font-mono">
							{search.client_id ?? "An application"}
						</span>{" "}
						is requesting access to your Opsy account.
					</CardDescription>
				</CardHeader>
				<CardContent className="flex flex-col gap-4">
					{scopes.length > 0 && (
						<div className="flex flex-col gap-2">
							<p className="text-sm font-medium">Requested scopes:</p>
							<div className="flex flex-wrap gap-1.5">
								{scopes.map((s) => (
									<Badge key={s} variant="secondary">
										{s}
									</Badge>
								))}
							</div>
						</div>
					)}

					{error && (
						<p className="text-center text-sm text-destructive">{error}</p>
					)}

					<div className="flex gap-2">
						<Button
							className="flex-1"
							onClick={() => decide("approve")}
							disabled={submittingAction !== null}
						>
							{submittingAction === "approve" ? "..." : "Approve"}
						</Button>
						<Button
							variant="outline"
							className="flex-1"
							onClick={() => decide("deny")}
							disabled={submittingAction !== null}
						>
							{submittingAction === "deny" ? "..." : "Deny"}
						</Button>
					</div>
				</CardContent>
			</Card>
		</div>
	)
}
