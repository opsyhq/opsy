import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test"
import { and, eq, isNull } from "drizzle-orm"
import { db } from "@/lib/db/client"
import { migrate } from "@/lib/db/migrate"
import {
	integrations,
	type Operation,
	operations,
	organization,
	type Project,
	projects,
	type Resource,
	resources,
	user,
} from "@/lib/db/schema"
import * as operations_ from "@/operations"
import type { Actor } from "@/types"

// steps → operations pulls workflow/api; stub it like scan.test does.
mock.module("workflow/api", () => ({
	start: async () => ({ runId: `fail-test-${crypto.randomUUID()}` }),
}))

let tombstoneFailedResourceStub: typeof import("../workflows/steps").tombstoneFailedResourceStub
let startUpdateResourceOperation: typeof import("../workflows/steps").startUpdateResourceOperation
let startDeleteResourceOperation: typeof import("../workflows/steps").startDeleteResourceOperation
let completeUpdateResourceOperation: typeof import("../workflows/steps").completeUpdateResourceOperation
let deleteResourceComplete: typeof import("../workflows/steps").deleteResourceComplete
let failUpdateResourceOperation: typeof import("../workflows/steps").failUpdateResourceOperation
let describeOperationError: typeof import("@/operations/operations").describeOperationError
let markOperationFailed: typeof import("@/operations/operations").markOperationFailed
let markOperationSucceeded: typeof import("@/operations/operations").markOperationSucceeded

async function makeActorProject(): Promise<{
	actor: Actor
	project: Project
}> {
	const suffix = crypto.randomUUID()
	const [u] = await db
		.insert(user)
		.values({ name: "Fail Op", email: `fo-${suffix}@example.com` })
		.returning()
	const [org] = await db
		.insert(organization)
		.values({
			name: `fo-org-${suffix}`,
			slug: `fo-${suffix.slice(0, 12)}`,
			createdAt: new Date(),
		})
		.returning()
	const actor: Actor = { type: "user", id: u!.id, orgId: org!.id }
	const [project] = await db
		.insert(projects)
		.values({
			orgId: org!.id,
			slug: `fo-proj-${suffix.slice(0, 12)}`,
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
	const [integration] = await db
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
	return integration!.id
}

async function makeResource(args: {
	project: Project
	actor: Actor
	integrationId: string
	slug: string
	identity: Record<string, unknown> | null
	status?: Resource["status"]
}): Promise<Resource> {
	const [row] = await db
		.insert(resources)
		.values({
			projectId: args.project.id,
			slug: args.slug,
			type: "fakep_bucket",
			inputs: { name: args.slug },
			identity: args.identity,
			status: args.status ?? (args.identity ? "live" : "creating"),
			provider: "fakep",
			integrationId: args.integrationId,
			createdByType: args.actor.type,
			createdById: args.actor.id,
		})
		.returning()
	return row!
}

async function makeOperation(
	actor: Actor,
	project: Project,
	resource: Resource,
	kind: Operation["kind"],
): Promise<Operation> {
	return operations_.createOperation({
		actor,
		projectId: project.id,
		resourceId: resource.id,
		kind,
		lockKey: `resource:${resource.id}`,
		request: { slug: resource.slug },
	})
}

beforeAll(async () => {
	await migrate()
	;({
		tombstoneFailedResourceStub,
		startUpdateResourceOperation,
		startDeleteResourceOperation,
		completeUpdateResourceOperation,
		deleteResourceComplete,
		failUpdateResourceOperation,
	} = await import("../workflows/steps"))
	;({ describeOperationError, markOperationFailed, markOperationSucceeded } =
		await import("@/operations/operations"))
})

afterAll(() => {
	mock.restore()
})

describe("operation failure — #13 failed-create visibility", () => {
	test("records the normalized error, closes the op, and frees the stub slug", async () => {
		const { actor, project } = await makeActorProject()
		const integrationId = await makeIntegration(project, actor)
		// Create stub: identity NULL = never materialized.
		const stub = await makeResource({
			project,
			actor,
			integrationId,
			slug: "demo-bucket",
			identity: null,
		})
		const operation = await makeOperation(actor, project, stub, "create")

		await tombstoneFailedResourceStub(
			operation,
			new Error(
				'Step "step//./src/resources/steps//applyResource" failed after 0 retries: creating S3 Bucket (demo-bucket): operation error S3: CreateBucket, https response error StatusCode: 409, api error BucketAlreadyOwnedByYou: bucket exists',
			),
		)

		const closed = await db.query.operations.findFirst({
			where: eq(operations.id, operation.id),
		})
		expect(closed!.status).toBe("failed")
		expect(closed!.closedAt).not.toBeNull()
		expect(closed!.error).toEqual({
			message: "BucketAlreadyOwnedByYou: bucket exists",
			code: "BucketAlreadyOwnedByYou",
			details: null,
		})

		// Stub soft-deleted (identity NULL + kind create) so the slug frees.
		const stubRow = await db.query.resources.findFirst({
			where: eq(resources.id, stub.id),
		})
		expect(stubRow!.deletedAt).not.toBeNull()

		// The partial unique index excludes soft-deleted rows: same slug reusable.
		const reinserted = await db
			.insert(resources)
			.values({
				projectId: project.id,
				slug: "demo-bucket",
				type: "fakep_bucket",
				status: "creating",
				provider: "fakep",
				integrationId,
				createdByType: actor.type,
				createdById: actor.id,
			})
			.returning()
		expect(reinserted[0]!.slug).toBe("demo-bucket")

		// GET /operations/:id shape: { operation, resource } — the stub is still
		// joined back even though soft-deleted.
		const detail = await operations_.getOperation(actor, operation.id)
		expect(detail.operation.id).toBe(operation.id)
		expect(detail.operation.status).toBe("failed")
		expect(detail.resource?.id).toBe(stub.id)
	})

	test("a failed update on an applied resource leaves the row intact", async () => {
		const { actor, project } = await makeActorProject()
		const integrationId = await makeIntegration(project, actor)
		const applied = await makeResource({
			project,
			actor,
			integrationId,
			slug: "live-bucket",
			identity: { id: "live-bucket" },
		})
		const operation = await makeOperation(actor, project, applied, "update")

		// Update ops use tombstoneFailedResourceStub only for create/import; for
		// update it's a no-op tombstone — the resource stays put.
		await tombstoneFailedResourceStub(operation, new Error("boom"))

		const closed = await db.query.operations.findFirst({
			where: eq(operations.id, operation.id),
		})
		expect(closed!.status).toBe("failed")

		const row = await db.query.resources.findFirst({
			where: eq(resources.id, applied.id),
		})
		expect(row!.deletedAt).toBeNull()
		expect(row!.identity).toEqual({ id: "live-bucket" })
	})

	test("a failed import stub (identity NULL) is also soft-deleted", async () => {
		const { actor, project } = await makeActorProject()
		const integrationId = await makeIntegration(project, actor)
		const stub = await makeResource({
			project,
			actor,
			integrationId,
			slug: "imported-x",
			identity: null,
			status: "importing",
		})
		const operation = await makeOperation(actor, project, stub, "import")

		await tombstoneFailedResourceStub(
			operation,
			new Error("unknown provider id"),
		)

		const liveStub = await db.query.resources.findFirst({
			where: and(eq(resources.id, stub.id), isNull(resources.deletedAt)),
		})
		expect(liveStub).toBeUndefined()
	})

	test("markOperationSucceeded closes the op with its result", async () => {
		const { actor, project } = await makeActorProject()
		const integrationId = await makeIntegration(project, actor)
		const resource = await makeResource({
			project,
			actor,
			integrationId,
			slug: "ok-bucket",
			identity: { id: "ok-bucket" },
		})
		const operation = await makeOperation(actor, project, resource, "update")

		await markOperationSucceeded(operation, { reason: "applied" })

		const closed = await db.query.operations.findFirst({
			where: eq(operations.id, operation.id),
		})
		expect(closed!.status).toBe("succeeded")
		expect(closed!.closedAt).not.toBeNull()
		expect(closed!.result).toEqual({ reason: "applied" })
	})
})

describe("resource lifecycle transitions are atomic with the owning op", () => {
	test("update flips status to updating while running, back to live on success", async () => {
		const { actor, project } = await makeActorProject()
		const integrationId = await makeIntegration(project, actor)
		const resource = await makeResource({
			project,
			actor,
			integrationId,
			slug: "u-bucket",
			identity: { id: "u-bucket" },
		})
		expect(resource.status).toBe("live")

		const op = await makeOperation(actor, project, resource, "update")
		await startUpdateResourceOperation(op)

		const midRun = await db.query.resources.findFirst({
			where: eq(resources.id, resource.id),
		})
		expect(midRun!.status).toBe("updating")

		const newState = { id: "u-bucket", name: "renamed" }
		await completeUpdateResourceOperation(
			op,
			{ resourceId: resource.id },
			newState,
		)

		const finalRow = await db.query.resources.findFirst({
			where: eq(resources.id, resource.id),
		})
		expect(finalRow!.status).toBe("live")
		expect(finalRow!.identity).toEqual(newState)
		expect(finalRow!.outputs).toEqual(newState)
	})

	test("failed update reverts status to last stable truth", async () => {
		const { actor, project } = await makeActorProject()
		const integrationId = await makeIntegration(project, actor)
		const resource = await makeResource({
			project,
			actor,
			integrationId,
			slug: "fu-bucket",
			identity: { id: "fu-bucket" },
		})

		const op = await makeOperation(actor, project, resource, "update")
		await startUpdateResourceOperation(op)

		await failUpdateResourceOperation(op, new Error("apply blew up"), "live")

		const row = await db.query.resources.findFirst({
			where: eq(resources.id, resource.id),
		})
		expect(row!.status).toBe("live")
		expect(row!.identity).toEqual({ id: "fu-bucket" })

		const closed = await db.query.operations.findFirst({
			where: eq(operations.id, op.id),
		})
		expect(closed!.status).toBe("failed")
	})

	test("delete flips status to deleting while running, soft-deletes on success", async () => {
		const { actor, project } = await makeActorProject()
		const integrationId = await makeIntegration(project, actor)
		const resource = await makeResource({
			project,
			actor,
			integrationId,
			slug: "d-bucket",
			identity: { id: "d-bucket" },
		})

		const op = await makeOperation(actor, project, resource, "delete")
		await startDeleteResourceOperation(op)

		const midRun = await db.query.resources.findFirst({
			where: eq(resources.id, resource.id),
		})
		expect(midRun!.status).toBe("deleting")
		expect(midRun!.deletedAt).toBeNull()

		await deleteResourceComplete(op, midRun!)

		const finalRow = await db.query.resources.findFirst({
			where: eq(resources.id, resource.id),
		})
		expect(finalRow!.deletedAt).not.toBeNull()
	})

	test("failed delete reverts status to live", async () => {
		const { actor, project } = await makeActorProject()
		const integrationId = await makeIntegration(project, actor)
		const resource = await makeResource({
			project,
			actor,
			integrationId,
			slug: "fd-bucket",
			identity: { id: "fd-bucket" },
		})

		const op = await makeOperation(actor, project, resource, "delete")
		await startDeleteResourceOperation(op)

		await failUpdateResourceOperation(op, new Error("destroy failed"), "live")

		const row = await db.query.resources.findFirst({
			where: eq(resources.id, resource.id),
		})
		expect(row!.status).toBe("live")
		expect(row!.deletedAt).toBeNull()
	})
})
