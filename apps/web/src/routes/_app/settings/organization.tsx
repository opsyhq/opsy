import { createFileRoute } from "@tanstack/react-router"
import { Copy } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip"
import { authClient as auth } from "@/lib/auth"
import { hasRole } from "@/lib/auth/hasRole"
import { DangerZone } from "./-DangerZone"

export const Route = createFileRoute("/_app/settings/organization")({
	component: OrganizationSettingsPage,
})

function OrganizationSettingsPage() {
	const { data: activeOrg } = auth.useActiveOrganization()
	const { data: activeMember } = auth.useActiveMember()
	const [copied, setCopied] = useState(false)

	async function copyOrgId() {
		const id = activeOrg?.id
		if (!id) return
		try {
			await navigator.clipboard.writeText(id)
			setCopied(true)
			setTimeout(() => setCopied(false), 1500)
		} catch {
			toast.error("Could not copy")
		}
	}

	// Roles are a comma-joined string (Better Auth supports multi-role
	// membership); owner is the only role permitted to delete.
	const isOwner = hasRole(activeMember?.role, "owner")

	// Mirror Better Auth's leave guard exactly so the button only appears
	// when leaving will actually succeed: a non-owner can always leave; an
	// owner can leave only while another owner remains. The sole owner
	// (always blocked) sees Delete instead — no dead-end button.
	const ownerCount = (activeOrg?.members ?? []).filter((m) =>
		hasRole(m.role, "owner"),
	).length
	const canLeave = !!activeMember && !(isOwner && ownerCount <= 1)

	return (
		<div className="flex min-w-0 flex-1 flex-col px-2">
			<div className="h-full w-full overflow-y-auto rounded-[10px] border bg-background">
				<div className="mx-auto w-full min-w-0 max-w-2xl px-8 py-10">
					<h2 className="text-2xl font-medium tracking-tight">
						Organization Settings
					</h2>
					<p className="mt-1 text-sm font-light text-muted-foreground">
						Manage your organization and access.
					</p>

					<div className="mt-8 flex flex-col gap-8">
						<div className="flex flex-col gap-2">
							<Label>Organization Name</Label>
							<Input value={activeOrg?.name ?? ""} readOnly />
						</div>

						<div className="flex flex-col gap-2">
							<Label>Organization ID</Label>
							<div className="relative">
								<Input
									value={activeOrg?.id ?? ""}
									readOnly
									className="pr-9 font-mono"
								/>
								<Tooltip open={copied || undefined}>
									<TooltipTrigger asChild>
										<Button
											type="button"
											variant="ghost"
											size="icon-xs"
											aria-label="Copy organization ID"
											onClick={copyOrgId}
											className="absolute top-1/2 right-1 size-7 -translate-y-1/2 text-input hover:bg-transparent hover:text-foreground dark:hover:bg-transparent"
										>
											<Copy className="size-3.5" />
										</Button>
									</TooltipTrigger>
									<TooltipContent>{copied ? "Copied" : "Copy"}</TooltipContent>
								</Tooltip>
							</div>
							<p className="text-xs text-muted-foreground/70">
								Use this identifier when calling the API or CLI.
							</p>
						</div>

						{activeOrg && (isOwner || canLeave) && (
							<DangerZone
								orgId={activeOrg.id}
								orgName={activeOrg.name}
								isOwner={isOwner}
								canLeave={canLeave}
							/>
						)}
					</div>
				</div>
			</div>
		</div>
	)
}
