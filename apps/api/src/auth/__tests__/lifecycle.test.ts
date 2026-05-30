// Integration tests for the auth lifecycle hooks. These hit a real
// Postgres (the `opsy_test` database created from .env.test) — they
// are NOT mocks. The fixture pattern is per-test random UUIDs so tests
// don't collide on user.email or organization.slug, which means we
// don't need cross-test cleanup or transactional isolation.

import { beforeAll, describe, expect, test } from "bun:test"
import { and, eq } from "drizzle-orm"
import { db } from "@/lib/db/client"
import { migrate } from "@/lib/db/migrate"
import { auditEvents } from "@/lib/db/schema/audit"
import { apikey, member, organization, user } from "@/lib/db/schema/auth"
import { integrations, projects } from "@/lib/db/schema/projects"
import {
	assertOrgHasNoInfra,
	deleteUserOrgs,
	firstOrgForUser,
	purgeOrgExternals,
	purgeOrgFootprint,
} from "../lifecycle"
import { createTestOrg } from "./fixtures"

beforeAll(async () => {
	// Idempotent — already-applied migrations are a no-op. Lets the suite
	// be self-contained: `createdb opsy_test && bun test --env-file .env.test`
	// is enough, no separate migrate step required.
	await migrate()
})

const insertTestUser = async () => {
	const email = `test-${crypto.randomUUID()}@example.com`
	const [u] = await db
		.insert(user)
		.values({ name: "Test User", email })
		.returning()
	if (!u) throw new Error("failed to insert test user")
	return u
}

describe("createTestOrg", () => {
	test("creates exactly one org + owner member for a new user", async () => {
		const u = await insertTestUser()
		await createTestOrg(u.id, u.email)

		const memberships = await db.query.member.findMany({
			where: eq(member.userId, u.id),
		})
		expect(memberships).toHaveLength(1)
		expect(memberships[0]?.role).toBe("owner")

		const orgRow = await db.query.organization.findFirst({
			where: eq(organization.id, memberships[0]!.organizationId),
		})
		expect(orgRow).toBeDefined()
		expect(orgRow?.name).toContain("workspace")
		expect(orgRow?.slug).toContain(u.id.slice(0, 8))
	})

	test("derives a sensible slug for emails with weird local parts", async () => {
		// Random suffix keeps the unique-email constraint happy across reruns
		// while preserving the dots/plus that exercise the slug normalizer.
		const email = `weird..name+tag.${crypto.randomUUID()}@example.com`
		const [u] = await db
			.insert(user)
			.values({ name: "Weird", email })
			.returning()
		await createTestOrg(u!.id, u!.email)

		const m = await db.query.member.findFirst({
			where: eq(member.userId, u!.id),
		})
		const orgRow = await db.query.organization.findFirst({
			where: eq(organization.id, m!.organizationId),
		})
		// Slug should be lowercase, no leading/trailing dashes, suffixed
		// with the userId fragment.
		expect(orgRow?.slug).toMatch(/^[a-z0-9-]+$/)
		expect(orgRow?.slug).not.toMatch(/^-/)
		expect(orgRow?.slug).not.toMatch(/-$/)
		expect(orgRow?.slug).toContain(u!.id.slice(0, 8))
	})
})

describe("firstOrgForUser", () => {
	test("returns null when the user has no memberships", async () => {
		const u = await insertTestUser()
		const result = await firstOrgForUser(u.id)
		expect(result).toBeNull()
	})

	test("returns the org id after createTestOrg has run", async () => {
		const u = await insertTestUser()
		await createTestOrg(u.id, u.email)
		const result = await firstOrgForUser(u.id)
		expect(result).not.toBeNull()

		// Cross-check: the returned id matches the actual membership.
		const m = await db.query.member.findFirst({
			where: eq(member.userId, u.id),
		})
		expect(result).toBe(m!.organizationId)
	})
})

describe("deleteUserOrgs", () => {
	test("refuses if a sole-member org still has projects", async () => {
		const u = await insertTestUser()
		await createTestOrg(u.id, u.email)
		const orgId = (await firstOrgForUser(u.id))!

		await db.insert(projects).values({
			orgId,
			slug: `proj-${u.id.slice(0, 8)}`,
			createdByType: "user",
			createdById: u.id,
		})

		await expect(deleteUserOrgs(u.id)).rejects.toThrow(/project/)

		// Org, member, project should ALL still exist — refuse pass runs
		// before any mutation, so a blocked delete is a no-op.
		const orgRow = await db.query.organization.findFirst({
			where: eq(organization.id, orgId),
		})
		expect(orgRow).toBeDefined()

		const memberRow = await db.query.member.findFirst({
			where: eq(member.userId, u.id),
		})
		expect(memberRow).toBeDefined()

		const projRows = await db.query.projects.findMany({
			where: eq(projects.orgId, orgId),
		})
		expect(projRows).toHaveLength(1)
	})

	test("a soft-deleted project does not block deletion and its tombstone is hard-purged", async () => {
		const u = await insertTestUser()
		await createTestOrg(u.id, u.email)
		const orgId = (await firstOrgForUser(u.id))!

		const [proj] = await db
			.insert(projects)
			.values({
				orgId,
				slug: `proj-${u.id.slice(0, 8)}`,
				createdByType: "user",
				createdById: u.id,
			})
			.returning()
		// Tear the project down the way the product does — a tombstone,
		// not a hard delete. This is the exact reported scenario: the user
		// soft-deleted their only project, then tried to delete the org.
		await db
			.update(projects)
			.set({ deletedAt: new Date() })
			.where(eq(projects.id, proj!.id))

		// No LIVE infra ⇒ deletion proceeds (no "still has 1 project").
		await deleteUserOrgs(u.id)

		const orgRow = await db.query.organization.findFirst({
			where: eq(organization.id, orgId),
		})
		expect(orgRow).toBeUndefined()

		// The tombstoned row must be physically gone — otherwise the
		// `projects.org_id` (no action) FK would have blocked the org delete.
		const projRows = await db.query.projects.findMany({
			where: eq(projects.orgId, orgId),
		})
		expect(projRows).toHaveLength(0)
	})

	test("cascades audit_events + apikey rows for an empty sole-member org", async () => {
		const u = await insertTestUser()
		await createTestOrg(u.id, u.email)
		const orgId = (await firstOrgForUser(u.id))!

		await db.insert(auditEvents).values({
			orgId,
			actorType: "user",
			actorId: u.id,
			action: "test",
			entityType: "test",
			entityId: "test",
		})
		await db.insert(apikey).values({
			referenceId: orgId,
			key: `test-key-${u.id.slice(0, 8)}`,
			createdAt: new Date(),
			updatedAt: new Date(),
		})

		await deleteUserOrgs(u.id)

		// Org, member, audit, apikey all gone.
		const orgRow = await db.query.organization.findFirst({
			where: eq(organization.id, orgId),
		})
		expect(orgRow).toBeUndefined()

		const memberRows = await db.query.member.findMany({
			where: eq(member.organizationId, orgId),
		})
		expect(memberRows).toHaveLength(0)

		const audits = await db.query.auditEvents.findMany({
			where: eq(auditEvents.orgId, orgId),
		})
		expect(audits).toHaveLength(0)

		const keys = await db.query.apikey.findMany({
			where: eq(apikey.referenceId, orgId),
		})
		expect(keys).toHaveLength(0)
	})

	test("drops only the user's membership in shared orgs, leaves the org intact", async () => {
		const owner = await insertTestUser()
		const guest = await insertTestUser()

		// Owner creates the org. Guest joins as a member.
		await createTestOrg(owner.id, owner.email)
		const orgId = (await firstOrgForUser(owner.id))!

		await db.insert(member).values({
			organizationId: orgId,
			userId: guest.id,
			role: "member",
			createdAt: new Date(),
		})

		// Delete the GUEST. They have no sole-member org of their own
		// (no createTestOrg call), so deleteUserOrgs should only see
		// the shared org and just drop their member row.
		await deleteUserOrgs(guest.id)

		// Org and owner's membership intact.
		const orgRow = await db.query.organization.findFirst({
			where: eq(organization.id, orgId),
		})
		expect(orgRow).toBeDefined()

		const ownerMember = await db.query.member.findFirst({
			where: and(eq(member.userId, owner.id), eq(member.organizationId, orgId)),
		})
		expect(ownerMember).toBeDefined()

		// Guest's membership gone.
		const guestMember = await db.query.member.findFirst({
			where: and(eq(member.userId, guest.id), eq(member.organizationId, orgId)),
		})
		expect(guestMember).toBeUndefined()
	})

	test("is a no-op for a user with no memberships", async () => {
		const u = await insertTestUser()
		// Should not throw, should not touch anything.
		await deleteUserOrgs(u.id)

		const memberships = await db.query.member.findMany({
			where: eq(member.userId, u.id),
		})
		expect(memberships).toHaveLength(0)
	})
})

// assertOrgHasNoInfra + purgeOrgExternals back the explicit org-deletion
// path: organizationHooks.beforeDeleteOrganization in config.ts calls both
// inside POST /api/auth/organization/delete. Testing them directly is the
// right unit boundary — driving the full Better Auth route would exercise
// the library, not our hook logic.
describe("assertOrgHasNoInfra", () => {
	test("throws CONFLICT naming the org when the org still has projects", async () => {
		const u = await insertTestUser()
		await createTestOrg(u.id, u.email)
		const orgId = (await firstOrgForUser(u.id))!

		await db.insert(projects).values({
			orgId,
			slug: `proj-${u.id.slice(0, 8)}`,
			createdByType: "user",
			createdById: u.id,
		})

		// The "organization" subject shapes the message differently from
		// the "account" path while enforcing the identical guard.
		await expect(assertOrgHasNoInfra(orgId, "organization")).rejects.toThrow(
			/Cannot delete organization: it still has 1 project/,
		)
	})

	test("resolves for an org with no infrastructure", async () => {
		const u = await insertTestUser()
		await createTestOrg(u.id, u.email)
		const orgId = (await firstOrgForUser(u.id))!

		await expect(
			assertOrgHasNoInfra(orgId, "organization"),
		).resolves.toBeUndefined()
	})

	test("resolves when the only project is soft-deleted (the reported bug)", async () => {
		const u = await insertTestUser()
		await createTestOrg(u.id, u.email)
		const orgId = (await firstOrgForUser(u.id))!

		const [proj] = await db
			.insert(projects)
			.values({
				orgId,
				slug: `proj-${u.id.slice(0, 8)}`,
				createdByType: "user",
				createdById: u.id,
			})
			.returning()
		await db
			.update(projects)
			.set({ deletedAt: new Date() })
			.where(eq(projects.id, proj!.id))

		// A tombstone is already torn down from the customer's view, so the
		// guard must NOT report "still has 1 project".
		await expect(
			assertOrgHasNoInfra(orgId, "organization"),
		).resolves.toBeUndefined()
	})
})

describe("purgeOrgFootprint", () => {
	test("hard-deletes the project subtree including soft-deleted rows", async () => {
		const u = await insertTestUser()
		await createTestOrg(u.id, u.email)
		const orgId = (await firstOrgForUser(u.id))!

		const [proj] = await db
			.insert(projects)
			.values({
				orgId,
				slug: `proj-${u.id.slice(0, 8)}`,
				createdByType: "user",
				createdById: u.id,
			})
			.returning()
		await db.insert(integrations).values({
			projectId: proj!.id,
			provider: "aws",
			slug: "aws",
			createdByType: "user",
			createdById: u.id,
		})
		// Tombstone the project; the integration under it stays live.
		await db
			.update(projects)
			.set({ deletedAt: new Date() })
			.where(eq(projects.id, proj!.id))

		await purgeOrgFootprint(orgId)

		const projRows = await db.query.projects.findMany({
			where: eq(projects.orgId, orgId),
		})
		expect(projRows).toHaveLength(0)
		const intRows = await db.query.integrations.findMany({
			where: eq(integrations.projectId, proj!.id),
		})
		expect(intRows).toHaveLength(0)
	})

	test("is a no-op for an org with no projects", async () => {
		const u = await insertTestUser()
		await createTestOrg(u.id, u.email)
		const orgId = (await firstOrgForUser(u.id))!

		await expect(purgeOrgFootprint(orgId)).resolves.toBeUndefined()

		// Org row itself is untouched — this helper only owns the subtree.
		const orgRow = await db.query.organization.findFirst({
			where: eq(organization.id, orgId),
		})
		expect(orgRow).toBeDefined()
	})
})

describe("purgeOrgExternals", () => {
	test("deletes audit_events + apikey rows but leaves the org row intact", async () => {
		const u = await insertTestUser()
		await createTestOrg(u.id, u.email)
		const orgId = (await firstOrgForUser(u.id))!

		await db.insert(auditEvents).values({
			orgId,
			actorType: "user",
			actorId: u.id,
			action: "test",
			entityType: "test",
			entityId: "test",
		})
		await db.insert(apikey).values({
			referenceId: orgId,
			key: `test-key-${u.id.slice(0, 8)}`,
			createdAt: new Date(),
			updatedAt: new Date(),
		})

		await purgeOrgExternals(orgId)

		const audits = await db.query.auditEvents.findMany({
			where: eq(auditEvents.orgId, orgId),
		})
		expect(audits).toHaveLength(0)

		const keys = await db.query.apikey.findMany({
			where: eq(apikey.referenceId, orgId),
		})
		expect(keys).toHaveLength(0)

		// The org row is NOT this helper's responsibility — Better Auth's
		// adapter.deleteOrganization removes it right after the hook returns.
		const orgRow = await db.query.organization.findFirst({
			where: eq(organization.id, orgId),
		})
		expect(orgRow).toBeDefined()
	})
})
