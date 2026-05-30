import { db } from "@/lib/db/client"
import { organization, user } from "@/lib/db/schema"
import type { Actor } from "@/types"

export async function makeActor(label = "test"): Promise<Actor> {
	const suffix = crypto.randomUUID()
	const [u] = await db
		.insert(user)
		.values({ name: `${label} user`, email: `${label}-${suffix}@example.com` })
		.returning()
	if (!u) throw new Error("failed to insert user")
	const [org] = await db
		.insert(organization)
		.values({
			name: `${label}-org-${suffix}`,
			slug: `${label.slice(0, 2)}-${suffix.slice(0, 12)}`,
			createdAt: new Date(),
		})
		.returning()
	if (!org) throw new Error("failed to insert org")
	return { type: "user", id: u.id, orgId: org.id }
}
