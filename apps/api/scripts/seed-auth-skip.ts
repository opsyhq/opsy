import { and, eq } from "drizzle-orm"
import { db, shutdownDb } from "../src/lib/db/client"
import { member, organization, user } from "../src/lib/db/schema/auth"
import { env } from "../src/lib/env"

// Dev/test-only: materialize the stub user/org/member that the AUTH_SKIP
// request path stamps as the actor. The middleware deliberately never creates
// DB rows (a request handler must not invent identities); this seed is the
// explicit, out-of-band step that backs AUTH_SKIP_USER_ID / AUTH_SKIP_ORG_ID.
// Idempotent — re-running is safe. Run with the same env the app uses, e.g.
// `bun run --env-file .env scripts/seed-auth-skip.ts`.
async function main() {
	if (!env.AUTH_SKIP) {
		throw new Error(
			"Refusing to seed: AUTH_SKIP is not enabled. This identity is for " +
				"dev/test only — set AUTH_SKIP=true with AUTH_SKIP_USER_ID / " +
				"AUTH_SKIP_ORG_ID before seeding.",
		)
	}
	// env.ts superRefine guarantees both are set when AUTH_SKIP is true.
	const userId = env.AUTH_SKIP_USER_ID as string
	const orgId = env.AUTH_SKIP_ORG_ID as string

	await db.transaction(async (tx) => {
		await tx
			.insert(user)
			.values({
				id: userId,
				name: "Auth Skip User",
				email: "auth-skip@opsy.local",
				emailVerified: true,
			})
			.onConflictDoNothing()
		await tx
			.insert(organization)
			.values({
				id: orgId,
				name: "Auth Skip",
				slug: "auth-skip",
				createdAt: new Date(),
			})
			.onConflictDoNothing()
		// member has no org+user unique constraint, so guard the insert by
		// reading first rather than relying on onConflict.
		const existingMember = await tx.query.member.findFirst({
			where: and(eq(member.organizationId, orgId), eq(member.userId, userId)),
			columns: { id: true },
		})
		if (!existingMember) {
			await tx.insert(member).values({
				organizationId: orgId,
				userId,
				role: "owner",
				createdAt: new Date(),
			})
		}
	})

	console.log(
		JSON.stringify({ seeded: { userId, orgId }, idempotent: true }, null, 2),
	)
}

main()
	.then(() => shutdownDb())
	.catch(async (err) => {
		console.error(err)
		await shutdownDb()
		process.exit(1)
	})
