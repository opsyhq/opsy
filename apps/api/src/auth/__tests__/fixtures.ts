import { db } from "@/lib/db/client"
import { member, organization } from "@/lib/db/schema/auth"
import { getOrgSlug } from "../lifecycle"

/**
 * Inserts an org + owner membership for the given user. Replicates what
 * `onboarding.ts:onboardUser` does for test setup — lets test suites
 * seed database state without calling the HTTP layer.
 */
export const createTestOrg = async (
	userId: string,
	email: string | null,
): Promise<{ orgId: string }> => {
	const localPart = email?.split("@")[0] || "user"
	const name = `${localPart}'s workspace`
	const slug = getOrgSlug(localPart, userId)
	return db.transaction(async (tx) => {
		const [org] = await tx
			.insert(organization)
			.values({ name, slug, createdAt: new Date() })
			.returning({ id: organization.id })
		await tx.insert(member).values({
			organizationId: org!.id,
			userId,
			role: "owner",
			createdAt: new Date(),
		})
		return { orgId: org!.id }
	})
}
