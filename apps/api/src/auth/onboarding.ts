import {
	AuthOnboardingDisabled,
	AuthOnboardingInvalidPayload,
	AuthOnboardingOrgExists,
	AuthUnauthorized,
} from "@opsy/contracts/errors"
import { eq } from "drizzle-orm"
import { Hono } from "hono"
import { z } from "zod"
import { db } from "../lib/db/client"
import { member, organization, session } from "../lib/db/schema/auth"
import { env } from "../lib/env"
import type { AppEnv, AuthSessionRow } from "../types"
import { auth } from "./config"
import { getOrgSlug } from "./lifecycle"

const OnboardBody = z.object({
	name: z.string().trim().min(1).max(64),
	consent: z.literal(true),
})

type OnboardInput = {
	userId: string
	name: string
}

type OnboardResult = {
	orgId: string
	slug: string
}

const onboardUser = async (input: OnboardInput): Promise<OnboardResult> => {
	const slug = getOrgSlug(input.name, input.userId)
	return db.transaction(async (tx) => {
		const existing = await tx.query.member.findFirst({
			where: eq(member.userId, input.userId),
			with: { organization: { columns: { id: true, slug: true } } },
		})
		if (existing?.organization) {
			return {
				orgId: existing.organization.id,
				slug: existing.organization.slug,
			}
		}
		const [org] = await tx
			.insert(organization)
			.values({ name: input.name.trim(), slug, createdAt: new Date() })
			.returning({ id: organization.id, slug: organization.slug })
		await tx.insert(member).values({
			organizationId: org.id,
			userId: input.userId,
			role: "owner",
			createdAt: new Date(),
		})
		await tx
			.update(session)
			.set({ activeOrganizationId: org.id })
			.where(eq(session.userId, input.userId))
		return { orgId: org.id, slug: org.slug }
	})
}

// Mounted before requireActor in app.ts: signed-in users without an active org
// can't pass requireActor, so this route runs its own session check.
export const onboardingRoutes = new Hono<AppEnv>().post("/", async (c) => {
	if (env.AUTH_SKIP) throw new AuthOnboardingDisabled()
	const sessionData = await auth.api
		.getSession({ headers: c.req.raw.headers })
		.catch(() => null)
	if (!sessionData?.user || !sessionData.session) throw new AuthUnauthorized()
	const s: AuthSessionRow = sessionData.session
	if (s.activeOrganizationId) throw new AuthOnboardingOrgExists()

	const parsed = OnboardBody.safeParse(await c.req.json().catch(() => null))
	if (!parsed.success) {
		throw new AuthOnboardingInvalidPayload({
			detail: parsed.error.issues[0]?.message ?? "Invalid onboarding payload.",
		})
	}

	const result = await onboardUser({
		userId: sessionData.user.id,
		name: parsed.data.name,
	})
	return c.json(result, 201)
})
