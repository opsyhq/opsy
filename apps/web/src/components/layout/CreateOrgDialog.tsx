import { useMutation } from "@tanstack/react-query"
import { Loader2 } from "lucide-react"
import { useState } from "react"
import { APP_RAIL_WIDTH_OPEN } from "@/components/layout/railWidths"
import { Button } from "@/components/ui/button"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { authClient as auth } from "@/lib/auth"

// Existing users can't reach /onboarding (it redirects away once an active
// org exists), so creating a second org happens here: create → setActive →
// hard reload into the new org, same convention as the switcher above.
export function CreateOrgDialog({
	open,
	onOpenChange,
}: {
	open: boolean
	onOpenChange: (open: boolean) => void
}) {
	const [name, setName] = useState("")
	const [error, setError] = useState<string | null>(null)

	const createOrg = useMutation({
		mutationFn: async (trimmed: string) => {
			// Slugs must be unique; mirror the server's deriveOrgSlug intent
			// (normalize + a short disambiguating suffix) so two orgs named the
			// same don't collide.
			const slug = `${
				trimmed
					.toLowerCase()
					.replace(/[^a-z0-9]+/g, "-")
					.replace(/^-|-$/g, "") || "workspace"
			}-${crypto.randomUUID().slice(0, 8)}`
			const { data, error: createError } = await auth.organization.create({
				name: trimmed,
				slug,
			})
			if (createError || !data)
				throw new Error(
					createError?.message ?? "Could not create the organization",
				)
			await auth.organization.setActive({ organizationId: data.id })
		},
		onMutate: () => setError(null),
		onSuccess: () => {
			window.location.href = "/"
		},
		onError: (err) => setError((err as Error).message),
	})

	const busy = createOrg.isPending

	function handleCreate(e: React.FormEvent) {
		e.preventDefault()
		const trimmed = name.trim()
		if (!trimmed || busy) return
		createOrg.mutate(trimmed)
	}

	function handleOpenChange(next: boolean) {
		if (busy) return
		if (!next) {
			setName("")
			setError(null)
		}
		onOpenChange(next)
	}

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			{/* Above the z-[60] expanded rail (same reason as the dropdown). */}
			<DialogContent
				showCloseButton={false}
				overlayClassName="bg-black/50 z-[70]"
				className="z-[70] flex w-[min(520px,calc(100%-1.5rem))] max-w-none flex-col gap-0 overflow-hidden rounded-lg p-0 sm:max-w-none"
				style={{ left: `calc(50% + ${APP_RAIL_WIDTH_OPEN / 2}px)` }}
			>
				<DialogDescription className="sr-only">
					Create organization
				</DialogDescription>
				<form onSubmit={handleCreate} className="flex min-h-0 flex-1 flex-col">
					<header className="border-b px-4 py-3.5">
						<DialogTitle className="text-base font-medium tracking-tight">
							Create Organisation
						</DialogTitle>
					</header>
					<div className="flex flex-col gap-2 px-4 py-6">
						<Label
							htmlFor="new-org-name"
							className="text-xs font-light text-muted-foreground"
						>
							Organisation name
						</Label>
						<Input
							id="new-org-name"
							type="text"
							placeholder="Give organisation a name..."
							value={name}
							onChange={(e) => setName(e.target.value)}
							maxLength={64}
							autoFocus
							required
							disabled={busy}
						/>
						{error && <p className="text-xs text-destructive">{error}</p>}
					</div>
					<footer className="mt-auto flex items-center justify-between gap-2 border-t px-4 py-2.5">
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
							size="xs"
							className="h-7 px-3 text-[11px]"
							disabled={busy || !name.trim()}
						>
							{busy && <Loader2 className="size-3 animate-spin" />}
							{busy ? "Creating…" : "Create"}
						</Button>
					</footer>
				</form>
			</DialogContent>
		</Dialog>
	)
}
