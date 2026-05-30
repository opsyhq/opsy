export type ApiResult = Promise<{ error: { message?: string } | null }>

// Members and pending invitations render in one table. An invitee shows a "?"
// avatar, the "Invite pending" badge, and only a Cancel action — there's no
// member yet, so their role can't be changed.
export type Row = {
	id: string
	name: string
	email: string
	image: string | null
	role: string
	pending: boolean
	// Set when the viewer may change this member's role (owner/self excluded).
	changeRole: ((role: string) => ApiResult) | null
	// Set when the viewer may remove the member / cancel the invite.
	remove: (() => ApiResult) | null
}
