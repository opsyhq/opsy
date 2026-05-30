import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test"
import { db } from "@/lib/db/client"
import { migrate } from "@/lib/db/migrate"
import {
	changeSets,
	integrations,
	organization,
	type Project,
	projects,
	type Resource,
	resources,
	user,
} from "@/lib/db/schema"
import type { JsonSseEvent } from "@/lib/sse"
import * as operations from "@/operations"
import { notifyResourceUpdated } from "@/operations/operations"
import type { Actor } from "@/types"

mock.module("workflow/api", () => ({
	start: async () => ({ runId: `pe-test-${crypto.randomUUID()}` }),
}))

let projectEventsGen: typeof import("../projectEvents").projectEvents
let notifyChangeSet: typeof import("../../changesets/changesets").notifyChangeSet

async function makeActorProject(): Promise<{
	actor: Actor
	project: Project
}> {
	const suffix = crypto.randomUUID()
	const [u] = await db
		.insert(user)
		.values({ name: "PE Test", email: `pe-${suffix}@example.com` })
		.returning()
	const [org] = await db
		.insert(organization)
		.values({
			name: `pe-org-${suffix}`,
			slug: `pe-${suffix.slice(0, 12)}`,
			createdAt: new Date(),
		})
		.returning()
	const actor: Actor = { type: "user", id: u!.id, orgId: org!.id }
	const [project] = await db
		.insert(projects)
		.values({
			orgId: org!.id,
			slug: `pe-proj-${suffix.slice(0, 12)}`,
			createdByType: actor.type,
			createdById: actor.id,
		})
		.returning()
	return { actor, project: project! }
}

async function makeIntegration(
	project: Project,
	actor: Actor,
): Promise<string> {
	const [row] = await db
		.insert(integrations)
		.values({
			projectId: project.id,
			provider: "fakep",
			slug: "default",
			name: `fakep-${crypto.randomUUID().slice(0, 8)}`,
			createdByType: actor.type,
			createdById: actor.id,
			config: {},
			credentials: {},
		})
		.returning()
	return row!.id
}

async function makeResource(args: {
	project: Project
	actor: Actor
	integrationId: string
	slug: string
}): Promise<Resource> {
	const [row] = await db
		.insert(resources)
		.values({
			projectId: args.project.id,
			slug: args.slug,
			type: "fakep_bucket",
			inputs: { name: args.slug },
			identity: { id: args.slug },
			status: "live",
			provider: "fakep",
			integrationId: args.integrationId,
			createdByType: args.actor.type,
			createdById: args.actor.id,
		})
		.returning()
	return row!
}

// Drives a freshly-created project events generator far enough that all three
// LISTEN subscriptions are attached. The generator is lazy: until we ask for
// the first value, none of the `subscribeJson` calls run, so any notification
// published before this returns can be lost (Postgres LISTEN only delivers
// messages received after the LISTEN registers). Returns the in-flight
// `pending` so the caller awaits it (rather than calling `gen.next()` again,
// which would race the first call).
async function primeGen(
	gen: AsyncGenerator<JsonSseEvent, void, void>,
): Promise<{
	pending: Promise<IteratorResult<JsonSseEvent, void>>
	collect: (count: number, timeoutMs?: number) => Promise<JsonSseEvent[]>
}> {
	const pending = gen.next()
	// Give the three subscribeJson generators time to call db.$client.listen
	// and have Postgres register the LISTEN on the connection.
	await new Promise((r) => setTimeout(r, 250))
	const collect = async (count: number, timeoutMs = 5000): Promise<JsonSseEvent[]> => {
		const collected: JsonSseEvent[] = []
		const deadline = Date.now() + timeoutMs
		let head: Promise<IteratorResult<JsonSseEvent, void>> = pending
		while (collected.length < count) {
			const remaining = deadline - Date.now()
			if (remaining <= 0) break
			const next = await Promise.race([
				head,
				new Promise<{ done: true; value: undefined }>((r) =>
					setTimeout(() => r({ done: true, value: undefined }), remaining),
				),
			])
			if (next.done) break
			if (next.value) collected.push(next.value)
			head = gen.next()
		}
		return collected
	}
	return { pending, collect }
}

beforeAll(async () => {
	await migrate()
	;({ projectEvents: projectEventsGen } = await import("../projectEvents"))
	;({ notifyChangeSet } = await import("../../changesets/changesets"))
})

afterAll(() => {
	mock.restore()
})

describe("projectEvents — multiplexed SSE stream", () => {
	test("emits operation.updated for ops in the subscribed project", async () => {
		const { actor, project } = await makeActorProject()
		const integrationId = await makeIntegration(project, actor)
		const resource = await makeResource({
			project,
			actor,
			integrationId,
			slug: "po-bucket",
		})

		const ac = new AbortController()
		const gen = projectEventsGen(actor, project, ac.signal)
		const { pending } = await primeGen(gen)

		const op = await operations.createOperation({
			actor,
			projectId: project.id,
			resourceId: resource.id,
			kind: "update",
			lockKey: `resource:${resource.id}`,
			request: { slug: resource.slug },
		})

		const first = await Promise.race([
			pending,
			new Promise<{ done: true; value: undefined }>((r) =>
				setTimeout(() => r({ done: true, value: undefined }), 5000),
			),
		])
		ac.abort()
		await gen.return()
		expect(first.done).toBe(false)
		expect(first.value?.event).toBe("operation.updated")
		const data = first.value!.data as { id: string; projectId: string }
		expect(data.id).toBe(op.id)
		expect(data.projectId).toBe(project.id)
	})

	test("emits resource.updated when updateResourceInputs fires", async () => {
		const { actor, project } = await makeActorProject()
		const integrationId = await makeIntegration(project, actor)
		const resource = await makeResource({
			project,
			actor,
			integrationId,
			slug: "pr-bucket",
		})

		const ac = new AbortController()
		const gen = projectEventsGen(actor, project, ac.signal)
		const { pending } = await primeGen(gen)

		await notifyResourceUpdated({
			...resource,
			inputs: { name: "renamed" },
		})

		const first = await Promise.race([
			pending,
			new Promise<{ done: true; value: undefined }>((r) =>
				setTimeout(() => r({ done: true, value: undefined }), 5000),
			),
		])
		ac.abort()
		await gen.return()
		expect(first.done).toBe(false)
		expect(first.value?.event).toBe("resource.updated")
		const data = first.value!.data as {
			id: string
			projectId: string
			inputs: { name: string }
			references: unknown[]
		}
		expect(data.id).toBe(resource.id)
		expect(data.projectId).toBe(project.id)
		// notifyResourceUpdated only carries IDs; the projector reloads the row
		// from the DB to build the ResourceView, so we observe the persisted
		// inputs (still "pr-bucket"), not the in-memory mutation passed above.
		expect(data.inputs.name).toBe("pr-bucket")
		expect(Array.isArray(data.references)).toBe(true)
	})

	test("emits changeset.updated when changeset state transitions", async () => {
		const { actor, project } = await makeActorProject()
		const [row] = await db
			.insert(changeSets)
			.values({
				projectId: project.id,
				title: "cs",
				actorType: actor.type,
				actorId: actor.id,
			})
			.returning()

		const ac = new AbortController()
		const gen = projectEventsGen(actor, project, ac.signal)
		const { pending } = await primeGen(gen)

		await notifyChangeSet({ ...row!, status: "applying" })

		const first = await Promise.race([
			pending,
			new Promise<{ done: true; value: undefined }>((r) =>
				setTimeout(() => r({ done: true, value: undefined }), 5000),
			),
		])
		ac.abort()
		await gen.return()
		expect(first.done).toBe(false)
		expect(first.value?.event).toBe("changeset.updated")
		const data = first.value!.data as {
			id: string
			projectId: string
			status: string
		}
		expect(data.id).toBe(row!.id)
		expect(data.projectId).toBe(project.id)
		expect(data.status).toBe("applying")
	})

	test("filters out notifications from other projects", async () => {
		const { actor, project } = await makeActorProject()
		const { project: other } = await makeActorProject()
		const otherIntegrationId = await makeIntegration(other, actor)
		const otherResource = await makeResource({
			project: other,
			actor,
			integrationId: otherIntegrationId,
			slug: "other-bucket",
		})

		const ac = new AbortController()
		const gen = projectEventsGen(actor, project, ac.signal)
		const { pending } = await primeGen(gen)

		// Publish to the OTHER project; subscriber on `project` must ignore it.
		await notifyResourceUpdated(otherResource)

		const first = await Promise.race([
			pending,
			new Promise<{ done: true; value: undefined }>((r) =>
				setTimeout(() => r({ done: true, value: undefined }), 500),
			),
		])
		ac.abort()
		await gen.return()
		expect(first.done).toBe(true)
	})
})

describe("resource notifications fire from operation writers", () => {
	test("createResourceWithOperation publishes resource.created", async () => {
		const { actor, project } = await makeActorProject()
		const integrationId = await makeIntegration(project, actor)

		const ac = new AbortController()
		const gen = projectEventsGen(actor, project, ac.signal)
		const { collect } = await primeGen(gen)

		const { resource } = await operations.createResourceWithOperation({
			actor,
			projectId: project.id,
			kind: "create",
			request: { slug: "new-bucket" },
			resource: {
				slug: "new-bucket",
				type: "fakep_bucket",
				status: "creating",
				inputs: { name: "new-bucket" },
				provider: "fakep",
				integrationId,
				metadata: {},
				position: null,
			},
		})

		const events = await collect(2)
		ac.abort()
		await gen.return()
		const kinds = events.map((e) => e.event)
		expect(kinds).toContain("operation.updated")
		expect(kinds).toContain("resource.created")
		const created = events.find((e) => e.event === "resource.created")!
		const data = created.data as { id: string; slug: string }
		expect(data.id).toBe(resource.id)
		expect(data.slug).toBe("new-bucket")
	})

	test("markOperationSucceeded with tombstone patch publishes resource.deleted", async () => {
		const { actor, project } = await makeActorProject()
		const integrationId = await makeIntegration(project, actor)
		const resource = await makeResource({
			project,
			actor,
			integrationId,
			slug: "tomb-bucket",
		})

		const op = await operations.createOperation({
			actor,
			projectId: project.id,
			resourceId: resource.id,
			kind: "delete",
			lockKey: `resource:${resource.id}`,
			request: { slug: resource.slug },
		})

		const ac = new AbortController()
		const gen = projectEventsGen(actor, project, ac.signal)
		const { collect } = await primeGen(gen)

		await operations.markOperationSucceeded(
			op,
			{ resourceId: resource.id },
			{ deletedAt: new Date() },
		)

		const events = await collect(2)
		ac.abort()
		await gen.return()
		const tomb = events.find((e) => e.event === "resource.deleted")
		expect(tomb).toBeDefined()
		const data = tomb!.data as {
			id: string
			projectId: string
			slug: string
		}
		expect(data.id).toBe(resource.id)
		expect(data.slug).toBe("tomb-bucket")
	})
})
