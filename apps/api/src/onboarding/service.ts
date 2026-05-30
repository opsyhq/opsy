import { and, eq, isNull } from "drizzle-orm"
import { db } from "../lib/db/client"
import {
	integrations,
	onboardingCompletions,
	projects,
	resources,
} from "../lib/db/schema"
import type { Actor } from "../types"

export type OnboardingStatus = {
	completed: boolean
	tasks: {
		organization: boolean
		project: boolean
		integration: boolean
		resource: boolean
	}
}

// `organization` is always true here: the actor only exists because
// requireActor() resolved an activeOrganizationId. Returned for UI uniformity.
const ALL_TASKS_DONE: OnboardingStatus["tasks"] = {
	organization: true,
	project: true,
	integration: true,
	resource: true,
}

export async function getOnboardingStatus(
	actor: Actor,
): Promise<OnboardingStatus> {
	const completion = await db.query.onboardingCompletions.findFirst({
		where: eq(onboardingCompletions.organizationId, actor.orgId),
		columns: { organizationId: true },
	})
	if (completion) return { completed: true, tasks: ALL_TASKS_DONE }

	const [project, integration, resource] = await Promise.all([
		db.query.projects.findFirst({
			where: and(eq(projects.orgId, actor.orgId), isNull(projects.deletedAt)),
			columns: { id: true },
		}),
		db
			.select({ id: integrations.id })
			.from(integrations)
			.innerJoin(projects, eq(projects.id, integrations.projectId))
			.where(
				and(
					eq(projects.orgId, actor.orgId),
					isNull(projects.deletedAt),
					isNull(integrations.deletedAt),
				),
			)
			.limit(1),
		db
			.select({ id: resources.id })
			.from(resources)
			.innerJoin(projects, eq(projects.id, resources.projectId))
			.where(
				and(
					eq(projects.orgId, actor.orgId),
					isNull(projects.deletedAt),
					isNull(resources.deletedAt),
				),
			)
			.limit(1),
	])

	return {
		completed: false,
		tasks: {
			organization: true,
			project: !!project,
			integration: integration.length > 0,
			resource: resource.length > 0,
		},
	}
}

// Idempotent. Caller has already verified (via `getOnboardingStatus` or its
// own state) that all tasks are done. Re-marking is a no-op.
export async function markOnboardingComplete(actor: Actor): Promise<void> {
	await db
		.insert(onboardingCompletions)
		.values({ organizationId: actor.orgId })
		.onConflictDoNothing({ target: onboardingCompletions.organizationId })
}
