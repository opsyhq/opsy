// Verifies Better Auth's session rolling behavior with bearer tokens.
//
// Rolling = when a session is accessed within the last `updateAge` seconds
// of its lifetime, Better Auth bumps `expiresAt` forward to `now + expiresIn`.
// This is the ONLY mechanism keeping CLI sessions alive — there is no refresh
// token flow for device-flow-issued sessions.
//
// Hits the real `opsy_test` Postgres. Random UUIDs mean no collision with
// other test suites running concurrently.

import { beforeAll, describe, expect, test } from "bun:test"
import { eq } from "drizzle-orm"
import { app } from "@/app"
import { db } from "@/lib/db/client"
import { migrate } from "@/lib/db/migrate"
import { member, session as sessionTable, user } from "@/lib/db/schema/auth"
import { auth } from "../config"
import { createTestOrg } from "./fixtures"

const EXPIRES_IN_MS = 60 * 60 * 24 * 14 * 1000 // matches config.ts
const UPDATE_AGE_MS = 60 * 60 * 24 * 1000 // matches config.ts

beforeAll(async () => {
	await migrate()
})

const makeSession = async (expiresFromNowMs: number) => {
	const email = `roll-${crypto.randomUUID()}@example.com`
	const [u] = await db
		.insert(user)
		.values({ name: "Roll Test", email })
		.returning()
	if (!u) throw new Error("user insert failed")

	await createTestOrg(u.id, u.email)
	const m = await db.query.member.findFirst({ where: eq(member.userId, u.id) })
	if (!m) throw new Error("member missing")

	const token = `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, "")
	const now = new Date()
	const [s] = await db
		.insert(sessionTable)
		.values({
			token,
			expiresAt: new Date(now.getTime() + expiresFromNowMs),
			userId: u.id,
			updatedAt: now,
			activeOrganizationId: m.organizationId,
		})
		.returning()
	if (!s) throw new Error("session insert failed")
	return { user: u, session: s, token }
}

describe("session rolling", () => {
	test("getSession extends expiresAt when session is inside updateAge window", async () => {
		// expiresAt 10 minutes from now → well inside the 1-day updateAge window.
		const { session: before, token } = await makeSession(10 * 60 * 1000)

		const headers = new Headers({ Authorization: `Bearer ${token}` })
		const result = await auth.api.getSession({ headers })

		expect(result).toBeTruthy()
		expect(result?.session).toBeTruthy()
		expect(result?.user).toBeTruthy()

		const [after] = await db
			.select()
			.from(sessionTable)
			.where(eq(sessionTable.id, before.id))

		expect(after).toBeTruthy()
		const movedForwardBy =
			after!.expiresAt.getTime() - before.expiresAt.getTime()

		// If rolling works, the new expiry should be ~expiresIn from now
		// (vs. the 10 minutes we set). Delta ≈ expiresIn − 10min.
		console.log(
			`[rolling] expiresAt before=${before.expiresAt.toISOString()} after=${after!.expiresAt.toISOString()} delta=${movedForwardBy}ms`,
		)

		expect(movedForwardBy).toBeGreaterThan(60 * 60 * 1000) // moved by >1h

		// Sanity: new expiry should be roughly now + 7d.
		const expectedExpiry = Date.now() + EXPIRES_IN_MS
		expect(Math.abs(after!.expiresAt.getTime() - expectedExpiry)).toBeLessThan(
			60 * 1000,
		)
	})

	test("getSession leaves expiresAt alone when session is outside updateAge window", async () => {
		// expiresAt ~full lifetime from now → there's more than `updateAge`
		// (1d) remaining, so rolling should NOT trigger.
		const { session: before, token } = await makeSession(EXPIRES_IN_MS)

		const headers = new Headers({ Authorization: `Bearer ${token}` })
		const result = await auth.api.getSession({ headers })
		expect(result?.session).toBeTruthy()

		const [after] = await db
			.select()
			.from(sessionTable)
			.where(eq(sessionTable.id, before.id))

		const drift = Math.abs(
			after!.expiresAt.getTime() - before.expiresAt.getTime(),
		)
		// Allow ~2s drift for clock skew / rounding; anything larger would
		// indicate rolling fired when it shouldn't have.
		expect(drift).toBeLessThan(2000)
	})

	test("rolling fires through the Hono requireActor middleware path", async () => {
		// Proves requireActor (apps/api/src/middleware/auth.ts) calls
		// auth.api.getSession in a way that preserves rolling. An HTTP
		// request to any authenticated endpoint should bump expiresAt the
		// same way a direct getSession call does.
		const { session: before, token } = await makeSession(10 * 60 * 1000)

		const res = await app.request("/projects", {
			headers: { Authorization: `Bearer ${token}` },
		})

		// We don't care about the response body — only that auth passed
		// (no 401). 200/404/500 are all fine; 401 would mean the bearer
		// was rejected and rolling never got a chance to fire.
		expect(res.status).not.toBe(401)

		const [after] = await db
			.select()
			.from(sessionTable)
			.where(eq(sessionTable.id, before.id))

		const movedForwardBy =
			after!.expiresAt.getTime() - before.expiresAt.getTime()
		console.log(
			`[rolling-middleware] status=${res.status} delta=${movedForwardBy}ms`,
		)
		expect(movedForwardBy).toBeGreaterThan(60 * 60 * 1000)
	})

	test("rolling math sanity: updateAge threshold is what we think it is", () => {
		// Doc-as-code: if config.ts ever changes these, the tests above break.
		expect(UPDATE_AGE_MS).toBe(86_400_000)
		expect(EXPIRES_IN_MS).toBe(1_209_600_000)
	})
})
