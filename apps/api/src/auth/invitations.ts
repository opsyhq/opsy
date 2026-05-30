import { eq } from "drizzle-orm"
import { Hono } from "hono"
import { db } from "../lib/db/client"
import { invitation } from "../lib/db/schema/auth"
import type { AppEnv } from "../types"

// Public, unauthenticated lookup of the bare minimum needed to render the
// invite landing page — org name + role — so a logged-out visitor sees WHERE
// they've been invited before signing in. Better Auth's own get-invitation
// requires a session that matches the invite email, so it can't drive that
// pre-auth screen; this fills only that gap.
//
// Trade-off (accepted): anyone holding an invitation id (an unguessable uuid)
// can read the org name + role. We deliberately do NOT expose the invitee
// email or inviter identity here — those stay behind get-invitation post-auth.
export const invitationRoutes = new Hono<AppEnv>().get(
	"/:id/preview",
	async (c) => {
		const row = await db.query.invitation.findFirst({
			where: eq(invitation.id, c.req.param("id")),
			columns: { role: true, status: true, expiresAt: true },
			with: { organization: { columns: { name: true } } },
		})
		if (
			!row ||
			row.status !== "pending" ||
			row.expiresAt < new Date() ||
			!row.organization
		) {
			return c.json({ error: "Invitation not found", status: 404 }, 404)
		}
		return c.json({
			organizationName: row.organization.name,
			role: row.role ?? "member",
		})
	},
)
