import { useMutation } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { Search, UserPlus } from "lucide-react"
import { useMemo, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { authClient as auth } from "@/lib/auth"
import { hasRole } from "@/lib/auth/hasRole"
import { InviteMemberDialog } from "./-InviteMemberDialog"
import { MembersTable } from "./-MembersTable"
import type { ApiResult, Row } from "./-membersView"

export const Route = createFileRoute("/_app/members/")({
	component: MembersPage,
})

type MemberAction = { id: string; success: string; call: () => ApiResult }

function MembersPage() {
	const { data: activeOrg } = auth.useActiveOrganization()
	const { data: activeMember } = auth.useActiveMember()
	const [query, setQuery] = useState("")
	const [inviteOpen, setInviteOpen] = useState(false)

	const memberAction = useMutation({
		mutationFn: async (action: MemberAction) => {
			const { error } = await action.call()
			if (error) throw new Error(error.message ?? "Something went wrong")
			return action.success
		},
		onSuccess: (msg) => toast.success(msg),
		onError: (err) => toast.error((err as Error).message),
	})
	const busyId = memberAction.isPending ? memberAction.variables.id : null

	const canManage =
		hasRole(activeMember?.role, "owner") || hasRole(activeMember?.role, "admin")

	const rows = useMemo<Row[]>(() => {
		const members = (activeOrg?.members ?? []).map((m): Row => {
			const isSelf = m.userId === activeMember?.userId
			const editable = canManage && !isSelf && !hasRole(m.role, "owner")
			return {
				id: m.id,
				name: m.user?.name || m.user?.email || m.userId,
				email: m.user?.email ?? "",
				image: m.user?.image ?? null,
				role: m.role,
				pending: false,
				changeRole: editable
					? (role) =>
							auth.organization.updateMemberRole({ memberId: m.id, role })
					: null,
				// Same gate as role changes: never offer to remove an owner (the
				// server rejects it) or yourself.
				remove: editable
					? () => auth.organization.removeMember({ memberIdOrEmail: m.id })
					: null,
			}
		})
		const invites = (activeOrg?.invitations ?? [])
			.filter((i) => i.status === "pending")
			.map(
				(inv): Row => ({
					id: inv.id,
					name: inv.email,
					email: "",
					image: null,
					role: inv.role,
					pending: true,
					changeRole: null,
					remove: canManage
						? () => auth.organization.cancelInvitation({ invitationId: inv.id })
						: null,
				}),
			)
		const q = query.trim().toLowerCase()
		const all = [...members, ...invites]
		return q
			? all.filter((r) =>
					`${r.name} ${r.email} ${r.role}`.toLowerCase().includes(q),
				)
			: all
	}, [activeOrg, activeMember, canManage, query])

	return (
		<div className="flex min-w-0 flex-1 flex-col px-2">
			<div className="h-full w-full overflow-y-auto rounded-[10px] border bg-background">
				<div className="mx-auto w-full min-w-0 max-w-2xl px-8 py-10">
					<h2 className="text-2xl font-medium tracking-tight">
						Workspace Members
					</h2>
					<p className="mt-1 text-sm font-light text-muted-foreground">
						Add teammates to collaborate on projects. Control permissions and
						manage access for each member.
					</p>

					<div className="mt-8 flex items-center gap-2">
						<div className="relative flex-1">
							<Search className="pointer-events-none absolute top-1/2 left-3 size-3 -translate-y-1/2 text-muted-foreground" />
							<Input
								placeholder="Search"
								value={query}
								onChange={(e) => setQuery(e.target.value)}
								className="h-7 pl-8 text-[11px]"
							/>
						</div>
						{canManage && activeOrg && (
							<Button
								variant="outline"
								size="xs"
								className="h-7 shrink-0 px-3 text-[11px]"
								onClick={() => setInviteOpen(true)}
							>
								<UserPlus className="size-3" />
								Add Member
							</Button>
						)}
					</div>

					<div className="mt-8 flex flex-col gap-2">
						<Label className="text-xs font-light text-muted-foreground">
							Members
						</Label>
						<MembersTable
							rows={rows}
							canManage={canManage}
							busyId={busyId}
							onChangeRole={(row, role) => {
								const change = row.changeRole
								if (change)
									memberAction.mutate({
										id: row.id,
										success: "Role updated",
										call: () => change(role),
									})
							}}
							onRemove={(row) => {
								const r = row.remove
								if (r)
									memberAction.mutate({ id: row.id, success: "Done", call: r })
							}}
						/>
					</div>
				</div>
			</div>

			{activeOrg && (
				<InviteMemberDialog
					orgId={activeOrg.id}
					open={inviteOpen}
					onOpenChange={setInviteOpen}
				/>
			)}
		</div>
	)
}
