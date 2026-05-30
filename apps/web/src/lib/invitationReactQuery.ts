import { queryOptions } from "@tanstack/react-query"
import { api } from "@/lib/api"
import { authClient } from "@/lib/auth"

export const invitationQueryKeys = {
	all: ["invitations"] as const,
	preview: (id: string) => ["invitations", "preview", id] as const,
	detail: (id: string) => ["invitations", "detail", id] as const,
	userList: () => ["invitations", "user"] as const,
}

// Logged-out preview: the public endpoint returns just org name + role, enough
// to show context next to the sign-in button. Better Auth's getInvitation can't
// drive this screen — it needs a session whose email matches the invite.
export function invitationPreviewQueryOptions(id: string) {
	return queryOptions({
		queryKey: invitationQueryKeys.preview(id),
		queryFn: async () => {
			const res = await api.invitations[":id"].preview.$get({ param: { id } })
			if (!res.ok)
				throw new Error("This invitation no longer exists or has expired.")
			return res.json()
		},
	})
}

// Signed-in: the full invite (inviter identity, org id) that drives accept /
// decline. The queryFn owns validation — it turns Better Auth's { data, error }
// and the non-pending statuses into the exact message the page renders, so the
// component only has to read `data` or `error.message`.
export function invitationQueryOptions(id: string) {
	return queryOptions({
		queryKey: invitationQueryKeys.detail(id),
		queryFn: async () => {
			const { data, error } = await authClient.organization.getInvitation({
				query: { id },
			})
			if (error || !data)
				throw new Error(
					error?.message ?? "This invitation no longer exists or has expired.",
				)
			if (data.status !== "pending")
				throw new Error(
					data.status === "accepted"
						? "This invitation has already been accepted."
						: "This invitation is no longer valid.",
				)
			return data
		},
	})
}

// Invitations addressed to the signed-in user's email (matches by email
// server-side, not membership). Returns the raw list; callers filter to
// pending themselves.
export function userInvitationsQueryOptions() {
	return queryOptions({
		queryKey: invitationQueryKeys.userList(),
		queryFn: async () => {
			const { data, error } =
				await authClient.organization.listUserInvitations()
			if (error) throw new Error(error.message ?? "Failed to load invitations")
			return data ?? []
		},
	})
}
