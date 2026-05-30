import { beforeAll, describe, expect, test } from "bun:test"
import { eq } from "drizzle-orm"
import { db } from "@/lib/db/client"
import { migrate } from "@/lib/db/migrate"
import {
	integrations,
	onboardingCompletions,
	organization,
	projects,
	resources,
	user,
} from "@/lib/db/schema"
import type { Actor } from "@/types"
import { onboardingService } from ".."

async function makeActor(): Promise<Actor> {
	const suffix = crypto.randomUUID()
	const [u] = await db
		.insert(user)
		.values({ name: "OB User", email: `ob-${suffix}@example.com` })
		.returning()
	const [org] = await db
		.insert(organization)
		.values({
			name: `ob-org-${suffix}`,
			slug: `ob-${suffix.slice(0, 12)}`,
			createdAt: new Date(),
		})
		.returning()
	return { type: "user", id: u!.id, orgId: org!.id }
}

async function makeProject(actor: Actor): Promise<string> {
	const [p] = await db
		.insert(projects)
		.values({
			orgId: actor.orgId,
			slug: `p-${crypto.randomUUID().slice(0, 10)}`,
			createdByType: actor.type,
			createdById: actor.id,
		})
		.returning()
	return p!.id
}

async function makeIntegration(
	actor: Actor,
	projectId: string,
): Promise<string> {
	const [i] = await db
		.insert(integrations)
		.values({
			projectId,
			provider: "fakep",
			slug: `i-${crypto.randomUUID().slice(0, 8)}`,
			createdByType: actor.type,
			createdById: actor.id,
			config: {},
			credentials: {},
		})
		.returning()
	return i!.id
}

async function makeResource(
	actor: Actor,
	projectId: string,
	integrationId: string,
): Promise<void> {
	await db.insert(resources).values({
		projectId,
		slug: `r-${crypto.randomUUID().slice(0, 8)}`,
		type: "fakep_bucket",
		status: "live",
		provider: "fakep",
		integrationId,
		createdByType: actor.type,
		createdById: actor.id,
	})
}

beforeAll(async () => {
	await migrate()
})

describe("onboardingService.getOnboardingStatus", () => {
	test("fresh actor: organization done, everything else pending", async () => {
		const actor = await makeActor()
		const s = await onboardingService.getOnboardingStatus(actor)
		expect(s).toEqual({
			completed: false,
			tasks: {
				organization: true,
				project: false,
				integration: false,
				resource: false,
			},
		})
	})

	test("with project but no integration/resource", async () => {
		const actor = await makeActor()
		await makeProject(actor)
		const s = await onboardingService.getOnboardingStatus(actor)
		expect(s.completed).toBe(false)
		expect(s.tasks).toEqual({
			organization: true,
			project: true,
			integration: false,
			resource: false,
		})
	})

	test("full chain (project + integration + resource): tasks all true, completed still false", async () => {
		const actor = await makeActor()
		const pid = await makeProject(actor)
		const iid = await makeIntegration(actor, pid)
		await makeResource(actor, pid, iid)
		const s = await onboardingService.getOnboardingStatus(actor)
		expect(s.completed).toBe(false)
		expect(s.tasks).toEqual({
			organization: true,
			project: true,
			integration: true,
			resource: true,
		})
	})

	test("after markOnboardingComplete: short-circuits to completed=true with all tasks true", async () => {
		const actor = await makeActor()
		// Don't even create child rows — completion row alone flips the result.
		await onboardingService.markOnboardingComplete(actor)
		const s = await onboardingService.getOnboardingStatus(actor)
		expect(s).toEqual({
			completed: true,
			tasks: {
				organization: true,
				project: true,
				integration: true,
				resource: true,
			},
		})
	})

	test("soft-deleted project is ignored", async () => {
		const actor = await makeActor()
		const pid = await makeProject(actor)
		await db
			.update(projects)
			.set({ deletedAt: new Date() })
			.where(eq(projects.id, pid))
		const s = await onboardingService.getOnboardingStatus(actor)
		expect(s.tasks.project).toBe(false)
	})
})

describe("onboardingService.markOnboardingComplete", () => {
	test("is idempotent (second call is a no-op)", async () => {
		const actor = await makeActor()
		await onboardingService.markOnboardingComplete(actor)
		await onboardingService.markOnboardingComplete(actor)
		const rows = await db.query.onboardingCompletions.findMany({
			where: eq(onboardingCompletions.organizationId, actor.orgId),
		})
		expect(rows).toHaveLength(1)
	})
})
