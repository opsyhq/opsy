import { Check, ChevronsUpDown, Plus } from "lucide-react"
import { useState } from "react"
import { CreateOrgDialog } from "@/components/layout/CreateOrgDialog"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { authClient as auth } from "@/lib/auth"
import { cn } from "@/lib/utils"

const ORG_PALETTE = [
	"#3B82F6", // blue
	"#10B981", // emerald
	"#F59E0B", // amber
	"#A855F7", // purple
	"#EF4444", // red
	"#50B2C0", // teal
] as const

function orgColor(seed: string): string {
	let hash = 0
	for (let i = 0; i < seed.length; i++) {
		hash = (hash * 31 + seed.charCodeAt(i)) | 0
	}
	return ORG_PALETTE[Math.abs(hash) % ORG_PALETTE.length]
}

export function WorkspaceSwitcher() {
	const { data: activeOrg } = auth.useActiveOrganization()
	const { data: orgs } = auth.useListOrganizations()
	const [createOpen, setCreateOpen] = useState(false)

	// Org-context changes go through setActive + a hard reload (codebase
	// convention — the app scopes off the session's activeOrganizationId, not
	// the URL, so the signed session cookie must be refreshed before any guard
	// re-runs). See AvatarMenu / onboarding.tsx / settings/organization.tsx.
	async function handleSwitch(orgId: string) {
		if (orgId === activeOrg?.id) return
		await auth.organization.setActive({ organizationId: orgId })
		window.location.href = "/"
	}

	const name = activeOrg?.name ?? ""
	const initial = name.charAt(0)

	return (
		<>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<button
						type="button"
						aria-label="Switch workspace"
						className="flex h-9 w-full shrink-0 items-center gap-2 border-b px-3 text-left outline-none transition-colors hover:bg-accent/30 focus-visible:ring-0"
					>
						<div
							aria-hidden
							className="flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold uppercase text-background"
							style={{ backgroundColor: orgColor(activeOrg?.id ?? name) }}
						>
							{initial}
						</div>
						<span className="min-w-0 flex-1 truncate text-sm font-medium">
							{name}
						</span>
						<ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
					</button>
				</DropdownMenuTrigger>
				<DropdownMenuContent
					align="start"
					side="bottom"
					className="z-[70] w-48"
				>
					{(orgs ?? []).map((org) => {
						const isActive = org.id === activeOrg?.id
						return (
							<DropdownMenuItem
								key={org.id}
								onClick={() => handleSwitch(org.id)}
								className={cn(isActive && "font-medium")}
							>
								<span
									aria-hidden
									className="size-2.5 shrink-0 rounded-full"
									style={{ backgroundColor: orgColor(org.id) }}
								/>
								<span className="min-w-0 truncate">{org.name}</span>
								{isActive && <Check className="ml-auto size-3.5" />}
							</DropdownMenuItem>
						)
					})}
					<DropdownMenuSeparator className="mb-0" />
					<DropdownMenuItem
						onClick={() => setCreateOpen(true)}
						className="-mx-1 -mb-1 rounded-none rounded-b-md px-3 py-2"
					>
						<Plus />
						New organization
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
			<CreateOrgDialog open={createOpen} onOpenChange={setCreateOpen} />
		</>
	)
}
