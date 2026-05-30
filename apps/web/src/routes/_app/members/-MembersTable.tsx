import { Loader2, MoreVertical } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn, getUserInitials } from "@/lib/utils"
import type { Row } from "./-membersView"

export function MembersTable({
	rows,
	canManage,
	busyId,
	onChangeRole,
	onRemove,
}: {
	rows: Row[]
	canManage: boolean
	busyId: string | null
	onChangeRole: (row: Row, role: string) => void
	onRemove: (row: Row) => void
}) {
	if (rows.length === 0) {
		return (
			<div className="rounded-lg border border-border px-3 py-6 text-center text-xs text-muted-foreground/70">
				No members match your search.
			</div>
		)
	}

	return (
		<div className="flex flex-col gap-2">
			{rows.map((row) => (
				<div
					key={row.id}
					className="flex items-center gap-3 rounded-lg border border-border py-2.5 pr-1.5 pl-3"
				>
					<Avatar className="size-8 shrink-0">
						{row.image && <AvatarImage src={row.image} alt={row.name} />}
						<AvatarFallback className="text-[11px]">
							{row.pending ? "?" : getUserInitials(row.name, row.email)}
						</AvatarFallback>
					</Avatar>
					<div className="flex min-w-0 flex-1 flex-col gap-0.5">
						<div className="flex min-w-0 items-center gap-2">
							<span className="min-w-0 truncate text-sm">{row.name}</span>
							<RoleBadge role={row.role} />
							<div className="ml-auto flex shrink-0 items-center gap-2">
								{row.pending && <PendingBadge />}
								{canManage ? (
									<RowMenu
										row={row}
										busy={busyId === row.id}
										onChangeRole={(role) => onChangeRole(row, role)}
										onRemove={() => onRemove(row)}
									/>
								) : (
									<span className="size-7" />
								)}
							</div>
						</div>
						{row.email && (
							<span className="truncate text-xs font-light text-muted-foreground">
								{row.email}
							</span>
						)}
					</div>
				</div>
			))}
		</div>
	)
}

function RoleBadge({ role }: { role: string }) {
	return (
		<span className="shrink-0 rounded-full border border-foreground/35 px-2 py-0.5 text-[11px] text-foreground/80 capitalize">
			{role}
		</span>
	)
}

function PendingBadge() {
	return (
		<span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-light text-amber-400">
			Invite pending
		</span>
	)
}

function RowMenu({
	row,
	busy,
	onChangeRole,
	onRemove,
}: {
	row: Row
	busy: boolean
	onChangeRole: (role: string) => void
	onRemove: () => void
}) {
	// The menu always opens; individual entries disable themselves when they
	// don't apply to this row (e.g. the owner can't be demoted or removed, an
	// invitee has no role to change). Keeps every row's trigger present and
	// consistent so the actions column doesn't jump.
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant="ghost"
					size="icon-xs"
					className={cn(
						"size-7 text-muted-foreground hover:bg-transparent hover:text-foreground dark:hover:bg-transparent",
					)}
					aria-label="Member actions"
					disabled={busy}
				>
					{busy ? (
						<Loader2 className="size-3.5 animate-spin" />
					) : (
						<MoreVertical className="size-3.5" />
					)}
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end">
				<DropdownMenuSub>
					<DropdownMenuSubTrigger disabled={!row.changeRole}>
						Change role
					</DropdownMenuSubTrigger>
					<DropdownMenuSubContent>
						<DropdownMenuRadioGroup
							value={row.role}
							onValueChange={onChangeRole}
						>
							<DropdownMenuRadioItem value="admin">Admin</DropdownMenuRadioItem>
							<DropdownMenuRadioItem value="member">Member</DropdownMenuRadioItem>
						</DropdownMenuRadioGroup>
					</DropdownMenuSubContent>
				</DropdownMenuSub>
				<DropdownMenuSeparator />
				<DropdownMenuItem
					variant="destructive"
					disabled={!row.remove}
					onClick={onRemove}
				>
					{row.pending ? "Cancel invitation" : "Remove from organization"}
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	)
}
