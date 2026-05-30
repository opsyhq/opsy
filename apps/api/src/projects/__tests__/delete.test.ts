import { beforeAll, describe, expect, test } from "bun:test"
import {
	NotFound,
	ProjectActiveResourcesConflict,
} from "@opsy/contracts/errors"
import { eq } from "drizzle-orm"
import { Hono } from "hono"
import { db } from "@/lib/db/client"
import { migrate } from "@/lib/db/migrate"
import {
	integrations,
	organization,
	projects,
	resources,
	user,
} from "@/lib/db/schema"
import { errorHandler } from "@/middleware/error"
import { requireProject } from "@/middleware/project"
import type { Actor, AppEnv } from "@/types"
import { deleteProject } from "../projects"
import { projectRoutes } from "../routes"

async function makeActor(): Promise<Actor> {
	const suffix = crypto.randomUUID()
	const [u] = await db
		.insert(user)
		.values({ name: "Proj Del", email: `pd-${suffix}@example.com` })
		.returning()
	const [org] = await db
		.insert(organization)
		.values({
			name: `pd-org-${suffix}`,
			slug: `pd-${suffix.slice(0, 12)}`,
			createdAt: new Date(),
		})
		.returning()
	return { type: "user", id: u!.id, orgId: org!.id }
}

async function makeProject(
	actor: Actor,
): Promise<{ id: string; slug: string }> {
	const slug = `p-${crypto.randomUUID().slice(0, 10)}`
	const [row] = await db
		.insert(projects)
		.values({
			orgId: actor.orgId,
			slug,
			createdByType: actor.type,
			createdById: actor.id,
		})
		.returning()
	return { id: row!.id, slug }
}

async function makeLiveResource(
	actor: Actor,
	projectId: string,
): Promise<void> {
	const [integ] = await db
		.insert(integrations)
		.values({
			projectId,
			provider: "fakep",
			slug: "default",
			name: `fakep-${crypto.randomUUID().slice(0, 8)}`,
			createdByType: actor.type,
			createdById: actor.id,
			config: {},
			credentials: {},
		})
		.returning()
	await db.insert(resources).values({
		projectId,
		slug: "live-bucket",
		type: "fakep_bucket",
		status: "live",
		provider: "fakep",
		integrationId: integ!.id,
		createdByType: actor.type,
		createdById: actor.id,
	})
}

async function hasTombstone(projectId: string): Promise<boolean> {
	const row = await db.query.projects.findFirst({
		where: eq(projects.id, projectId),
	})
	return row != null && row.deletedAt != null
}

beforeAll(async () => {
	await migrate()
})

describe("deleteProject — force semantics", () => {
	test("without force: missing slug raises 404", async () => {
		const actor = await makeActor()
		expect(
			deleteProject(actor, `missing-${crypto.randomUUID().slice(0, 8)}`, {
				force: false,
			}),
		).rejects.toBeInstanceOf(NotFound)
	})

	test("with force: missing slug is a no-op (idempotent)", async () => {
		const actor = await makeActor()
		await deleteProject(
			actor,
			`missing-${crypto.randomUUID().slice(0, 8)}`,
			{ force: true },
		)
	})

	test("with force: already-deleted slug is a no-op", async () => {
		const actor = await makeActor()
		const { id, slug } = await makeProject(actor)
		await deleteProject(actor, slug, { force: false })
		expect(await hasTombstone(id)).toBe(true)
		await deleteProject(actor, slug, { force: true })
	})

	test("without force: active resource blocks delete (409)", async () => {
		const actor = await makeActor()
		const { id, slug } = await makeProject(actor)
		await makeLiveResource(actor, id)
		await expect(
			deleteProject(actor, slug, { force: false }),
		).rejects.toBeInstanceOf(ProjectActiveResourcesConflict)
		expect(await hasTombstone(id)).toBe(false)
	})

	test("with force: active resource blocks delete (409)", async () => {
		const actor = await makeActor()
		const { id, slug } = await makeProject(actor)
		await makeLiveResource(actor, id)
		await expect(
			deleteProject(actor, slug, { force: true }),
		).rejects.toBeInstanceOf(ProjectActiveResourcesConflict)
		expect(await hasTombstone(id)).toBe(false)
	})

	test("default (no opts): behaves like force=false", async () => {
		const actor = await makeActor()
		await expect(
			deleteProject(actor, `missing-${crypto.randomUUID().slice(0, 8)}`),
		).rejects.toBeInstanceOf(NotFound)
	})
})

// Guards the `/projects/:project/:rest{.+}` mount in app.ts. If that pattern
// regresses to `/*`, requireProject runs on bare DELETE /projects/:slug and
// 404s missing slugs — breaking --force idempotency.
describe("DELETE /projects/:slug route gating", () => {
	const makeTestApp = (actor: Actor) => {
		const testApp = new Hono<AppEnv>()
		testApp.use("*", async (c, next) => {
			c.set("requestId", "test-req-id")
			c.set("actor", actor)
			await next()
		})
		testApp.use("/projects/:project/:rest{.+}", requireProject())
		testApp.route("/projects", projectRoutes)
		testApp.onError(errorHandler)
		return testApp
	}

	test("force=true on missing slug does NOT hit requireProject", async () => {
		const testApp = makeTestApp(await makeActor())
		const res = await testApp.request(
			`/projects/missing-${crypto.randomUUID().slice(0, 8)}?force=true`,
			{ method: "DELETE" },
		)
		expect(res.status).not.toBe(404)
		expect(res.status).toBeLessThan(300)
	})

	test("bare GET on missing slug DOES hit requireProject (404)", async () => {
		const testApp = makeTestApp(await makeActor())
		const res = await testApp.request(
			`/projects/missing-${crypto.randomUUID().slice(0, 8)}`,
		)
		expect(res.status).toBe(404)
	})
})
