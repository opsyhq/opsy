import { APIError } from "better-auth/api"
import { and, eq, inArray, isNull, count as sqlCount } from "drizzle-orm"
import { db, type Executor } from "../lib/db/client"
import { auditEvents } from "../lib/db/schema/audit"
import { apikey, member, organization } from "../lib/db/schema/auth"
import { changeSetItems, changeSets } from "../lib/db/schema/changesets"
import { operations } from "../lib/db/schema/operations"
import { integrations, projects } from "../lib/db/schema/projects"
import { resources } from "../lib/db/schema/resources"

// The userId-suffixed slug turns any local-part collision between users
// into a predictable no-op instead of a unique-constraint crash.
export const getOrgSlug = (base: string, userId: string): string => {
	const normalized =
		base
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-|-$/g, "") || "workspace"
	return `${normalized}-${userId.slice(0, 8)}`
}

/**
 * Pure read used by `databaseHooks.session.create.before` to populate
 * `activeOrganizationId` on new sessions. Returns null if the user has no
 * memberships — session lands without an active org, middleware surfaces
 * that as the onboarding state.
 */
export const firstOrgForUser = async (
	userId: string,
): Promise<string | null> => {
	const m = await db.query.member.findFirst({
		where: eq(member.userId, userId),
	})
	return m?.organizationId ?? null
}

const countMembers = async (orgId: string): Promise<number> => {
	const [{ value }] = await db
		.select({ value: sqlCount() })
		.from(member)
		.where(eq(member.organizationId, orgId))
	return Number(value)
}

// Only LIVE infra blocks deletion. `projects`/`integrations` carry a
// `deletedAt` tombstone (soft delete); a soft-deleted project is already
// torn down from the customer's view, so it must not count here — the
// physical rows are hard-purged later by `purgeOrgFootprint`.
const countOrgInfra = async (
	orgId: string,
): Promise<{ projects: number; integrations: number }> => {
	const [{ value: p }] = await db
		.select({ value: sqlCount() })
		.from(projects)
		.where(and(eq(projects.orgId, orgId), isNull(projects.deletedAt)))
	const [{ value: i }] = await db
		.select({ value: sqlCount() })
		.from(integrations)
		.innerJoin(projects, eq(projects.id, integrations.projectId))
		.where(
			and(
				eq(projects.orgId, orgId),
				isNull(projects.deletedAt),
				isNull(integrations.deletedAt),
			),
		)
	return { projects: Number(p), integrations: Number(i) }
}

/**
 * Refuse to delete an org that still owns infrastructure. Shared by the
 * account-deletion path (`deleteUserOrgs`) and the explicit org-deletion
 * path (`organizationHooks.beforeDeleteOrganization` in `config.ts`) so
 * both surfaces enforce the same "tear down infra first" rule. Throws
 * `APIError("CONFLICT")` — Better Auth turns that into a 409 the UI shows
 * verbatim. `subject` only shapes the sentence; the guard is identical.
 */
export const assertOrgHasNoInfra = async (
	orgId: string,
	subject: "account" | "organization",
): Promise<void> => {
	const infra = await countOrgInfra(orgId)
	if (infra.projects === 0 && infra.integrations === 0) return
	const lead =
		subject === "account"
			? "Cannot delete account: an organization you solely own still has"
			: "Cannot delete organization: it still has"
	const tail =
		subject === "account"
			? "Tear down your infrastructure before deleting your account."
			: "Tear down your infrastructure before deleting the organization."
	throw new APIError("CONFLICT", {
		message: `${lead} ${infra.projects} project(s) and ${infra.integrations} integration(s). ${tail}`,
	})
}

/**
 * Delete the org-scoped rows that do NOT cascade from an `organization`
 * delete: `audit_events.orgId` is `ON DELETE no action` and
 * `apikey.referenceId` has no FK at all (it's opaque text). Better Auth's
 * `adapter.deleteOrganization` only removes `member` + `invitation` + the
 * `organization` row, so without this an org delete either errors on the
 * audit FK or silently leaks valid org-scoped API keys. Does NOT delete
 * the `organization` row — callers (or Better Auth's adapter) own that.
 */
export const purgeOrgExternals = async (
	orgId: string,
	tx: Executor = db,
): Promise<void> => {
	await tx.delete(auditEvents).where(eq(auditEvents.orgId, orgId))
	await tx.delete(apikey).where(eq(apikey.referenceId, orgId))
}

/**
 * Hard-delete the org's entire project subtree, INCLUDING soft-deleted
 * (tombstoned) rows. `countOrgInfra` ignores tombstones so they don't
 * block deletion, but the physical rows still exist and
 * `projects.org_id → organization.id` is `ON DELETE no action`: leaving
 * even one tombstoned project would make Better Auth's
 * `DELETE FROM organization` fail *after* `purgeOrgExternals` already
 * dropped audit/api-key rows, half-purging the org. So once the org is
 * going away we remove the footprint outright.
 *
 * Deletes in FK-safe order (children before parents). `resource_layouts`
 * is `ON DELETE cascade` off `resources`;
 * everything else below is `no action` and is removed explicitly, in
 * order. `audit_events.project_id` is `no action` too, so this helper
 * clears the project-scoped audit rows itself as its first step —
 * `purgeOrgExternals` also sweeps them via `org_id`, but doing it here
 * makes the footprint purge self-contained and order-independent (no
 * reliance on a caller having run `purgeOrgExternals` first, nor on the
 * unenforced `audit.org_id == project.org_id` invariant).
 *
 * Still call BEFORE the `organization` row delete (the explicit
 * caller's, or Better Auth's adapter's): `projects.org_id` is
 * `no action`, so the org row cannot go while these rows exist.
 */
export const purgeOrgFootprint = async (
	orgId: string,
	tx: Executor = db,
): Promise<void> => {
	const orgProjects = await tx
		.select({ id: projects.id })
		.from(projects)
		.where(eq(projects.orgId, orgId))
	if (orgProjects.length === 0) return
	const projectIds = orgProjects.map((p) => p.id)

	const orgChangeSets = await tx
		.select({ id: changeSets.id })
		.from(changeSets)
		.where(inArray(changeSets.projectId, projectIds))
	const changeSetIds = orgChangeSets.map((c) => c.id)

	await tx.delete(auditEvents).where(inArray(auditEvents.projectId, projectIds))
	await tx.delete(operations).where(inArray(operations.projectId, projectIds))
	if (changeSetIds.length > 0) {
		await tx
			.delete(changeSetItems)
			.where(inArray(changeSetItems.changeSetId, changeSetIds))
	}
	await tx.delete(changeSets).where(inArray(changeSets.projectId, projectIds))
	await tx.delete(resources).where(inArray(resources.projectId, projectIds))
	await tx
		.delete(integrations)
		.where(inArray(integrations.projectId, projectIds))
	await tx.delete(projects).where(eq(projects.orgId, orgId))
}

/**
 * GDPR account-deletion cleanup. Runs in `user.deleteUser.beforeDelete`.
 *
 *   - Sole-member org with LIVE projects or integrations → throw, block
 *     the delete. UI must give the user a path to tear down infra first.
 *     Soft-deleted (tombstoned) infra does not block — it's already torn
 *     down from the customer's view.
 *   - Sole-member org with no live infra → purge `audit_events` +
 *     `apikey`, hard-delete any tombstoned project footprint, then the
 *     org. `member` rows cascade via the existing `member.organizationId`
 *     FK.
 *   - Shared-member org → drop this user's `member` row only. Audit rows
 *     in that org keep their now-stale `actor_id` (the column has no FK,
 *     so it's opaque text post-delete).
 *
 * All-or-nothing: every refuse-check runs before any mutation, so a
 * blocked delete leaves the database untouched.
 */
export const deleteUserOrgs = async (userId: string): Promise<void> => {
	const memberships = await db.query.member.findMany({
		where: eq(member.userId, userId),
	})

	const counted = await Promise.all(
		memberships.map(async (m) => ({
			memberId: m.id,
			orgId: m.organizationId,
			total: await countMembers(m.organizationId),
		})),
	)
	const soleOrgs = counted.filter((c) => c.total === 1).map((c) => c.orgId)
	const sharedMemberIds = counted
		.filter((c) => c.total > 1)
		.map((c) => c.memberId)

	// Every refuse-check runs before any mutation: assert all sole orgs are
	// infra-free first, so a blocked delete leaves the database untouched.
	for (const orgId of soleOrgs) {
		await assertOrgHasNoInfra(orgId, "account")
	}

	// One transaction for every mutation. Unlike the org-deletion hook
	// path (where Better Auth's adapter deletes the `organization` row in
	// a separate operation *after* the hook returns, so the purge can't be
	// atomic with it), here we own the org-row delete — so a failure
	// mid-purge rolls the whole thing back instead of leaving a
	// half-purged org.
	await db.transaction(async (tx) => {
		for (const orgId of soleOrgs) {
			await purgeOrgExternals(orgId, tx)
			await purgeOrgFootprint(orgId, tx)
			await tx.delete(organization).where(eq(organization.id, orgId))
		}
		for (const memberId of sharedMemberIds) {
			await tx.delete(member).where(eq(member.id, memberId))
		}
	})
}
