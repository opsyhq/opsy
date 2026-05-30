import { beforeAll, describe, expect, test } from "bun:test"
import { app } from "@/app"
import { db } from "@/lib/db/client"
import { migrate } from "@/lib/db/migrate"
import {
	member,
	organization,
	session as sessionTable,
	thinkingBlockArtifacts,
	thinkingBlockModelCalls,
	thinkingBlockRuns,
	thinkingBlockValidationResults,
	user,
} from "@/lib/db/schema"
import { env } from "@/lib/env"

type StatusCounts = {
	pending: number
	running: number
	ready: number
	rejected: number
	failed: number
	superseded: number
}

type BlockRow = {
	blockName: string
	totalArtifacts: number
	statusCounts: StatusCounts
	duration: { avgMs: number | null; p95Ms: number | null }
}

type ResourceRow = {
	identityKey: string
	identityRef: string
	blockName: string
	blockVersion: string
	latestArtifactId: string | null
	latestStatus: string | null
	totalArtifacts: number
}

type ArtifactRow = {
	id: string
	status: string
	runCount: number
	modelCallCount: number
	validationCount: number
	latestDurationMs: number | null
}

type ArtifactDetailBody = {
	artifact: Record<string, unknown>
	runs: Array<Record<string, unknown>>
	modelCalls: Array<Record<string, unknown>>
	validations: Array<Record<string, unknown>>
	aiSdkTrace: { source: string }
}

beforeAll(async () => {
	await migrate()
})

describe("thinking-block audit routes", () => {
	test("super admin browser sessions can drill into durable prompts and traces", async () => {
		const { headers } = await makeSuperAdminSession("member", {
			activeOrganizationId: null,
			insertMembership: false,
		})
		const fixture = await makeThinkingBlockFixture()

		const blocksRes = await app.request("/thinking-block/blocks", { headers })
		expect(blocksRes.status).toBe(200)
		const blocksBody = (await blocksRes.json()) as { blocks: BlockRow[] }
		const block = blocksBody.blocks.find(
			(row) => row.blockName === fixture.blockName,
		)
		if (!block) throw new Error("expected block summary")
		expect(block).toMatchObject({
			blockName: fixture.blockName,
			totalArtifacts: 1,
			statusCounts: {
				ready: 1,
				pending: 0,
				running: 0,
				rejected: 0,
				failed: 0,
				superseded: 0,
			},
		})
		expect(block.duration.avgMs).toBe(1200)
		expect(block.duration.p95Ms).toBe(1200)

		const resourcesRes = await app.request(
			`/thinking-block/blocks/${fixture.blockName}/resources`,
			{ headers },
		)
		expect(resourcesRes.status).toBe(200)
		const resourcesBody = (await resourcesRes.json()) as {
			resources: ResourceRow[]
		}
		expect(resourcesBody.resources).toHaveLength(1)
		const resource = resourcesBody.resources[0]
		expect(resource).toMatchObject({
			blockName: fixture.blockName,
			blockVersion: fixture.blockVersion,
			identityKey: fixture.identityKey,
			latestArtifactId: fixture.artifactId,
			latestStatus: "ready",
			totalArtifacts: 1,
		})

		const artifactsRes = await app.request(
			`/thinking-block/resources/${resource.identityRef}/artifacts`,
			{ headers },
		)
		expect(artifactsRes.status).toBe(200)
		const artifactsBody = (await artifactsRes.json()) as {
			artifacts: ArtifactRow[]
		}
		expect(artifactsBody.artifacts).toHaveLength(1)
		expect(artifactsBody.artifacts[0]).toMatchObject({
			id: fixture.artifactId,
			status: "ready",
			runCount: 1,
			modelCallCount: 1,
			validationCount: 1,
			latestDurationMs: 1200,
		})

		const detailRes = await app.request(
			`/thinking-block/artifacts/${fixture.artifactId}`,
			{ headers },
		)
		expect(detailRes.status).toBe(200)
		const detail = (await detailRes.json()) as ArtifactDetailBody
		expect(detail.artifact).toMatchObject({
			id: fixture.artifactId,
			input: { name: "alpha" },
			output: { ok: true },
			status: "ready",
		})
		expect(detail.runs[0]).toMatchObject({
			id: fixture.runId,
			status: "success",
			durationMs: 1200,
		})
		expect(detail.modelCalls[0]).toMatchObject({
			id: fixture.modelCallId,
			runId: fixture.runId,
			provider: "mock",
			model: "mock-model",
			responseModel: "mock-response",
			role: "generate",
			attempt: 0,
			stepIndex: 0,
			input: {
				prompt: "Generate alpha",
				options: {},
			},
			instructions: "Instructions",
			output: { text: "model output" },
		})
		expect(detail.validations[0]).toMatchObject({
			runId: fixture.runId,
			validatorId: "shape",
			status: "pass",
			feedback: { message: "valid" },
		})
		expect(detail.aiSdkTrace.source).toBe("durable_model_calls")
	})

	test("super admin access does not depend on org membership", async () => {
		const { headers } = await makeSuperAdminSession("member", {
			activeOrganizationId: null,
			insertMembership: false,
		})
		const res = await app.request("/thinking-block/blocks", { headers })
		expect(res.status).toBe(200)
	})

	test("org owner and admin roles cannot read without super admin allowlist", async () => {
		const owner = await makeBrowserSession("owner")
		const admin = await makeBrowserSession("admin")

		for (const headers of [owner.headers, admin.headers]) {
			const res = await app.request("/thinking-block/blocks", { headers })
			expect(res.status).toBe(404)
			expect(await res.json()).toEqual({ error: "Not found", status: 404 })
		}
	})

	test("non-browser and non-super-admin actors receive uniform 404s", async () => {
		const fixture = await makeThinkingBlockFixture()
		const nonAdmin = await makeBrowserSession("member")
		const noActiveOrg = await makeBrowserSession("owner", {
			activeOrganizationId: null,
		})
		const noMembership = await makeBrowserSession("owner", {
			insertMembership: false,
		})

		for (const headers of [
			undefined,
			{ Authorization: "Bearer opsy_invalid" },
			{ Authorization: `Bearer ${nonAdmin.token}` },
			nonAdmin.headers,
			noActiveOrg.headers,
			noMembership.headers,
		]) {
			const res = await app.request(
				`/thinking-block/artifacts/${fixture.artifactId}`,
				{ headers },
			)
			expect(res.status).toBe(404)
			expect(await res.json()).toEqual({ error: "Not found", status: 404 })
		}
	})

	test("unknown artifacts and resources return the same 404 for super admins", async () => {
		const { headers } = await makeSuperAdminSession()
		const missingArtifactRes = await app.request(
			"/thinking-block/artifacts/00000000-0000-4000-8000-000000000000",
			{ headers },
		)
		expect(missingArtifactRes.status).toBe(404)
		expect(await missingArtifactRes.json()).toEqual({
			error: "Not found",
			status: 404,
		})

		const missingIdentity = Buffer.from(
			JSON.stringify({
				blockName: "missing",
				blockVersion: "v1",
				identityKey: "missing",
			}),
			"utf8",
		).toString("base64url")
		const missingResourceRes = await app.request(
			`/thinking-block/resources/${missingIdentity}/artifacts`,
			{ headers },
		)
		expect(missingResourceRes.status).toBe(404)
		expect(await missingResourceRes.json()).toEqual({
			error: "Not found",
			status: 404,
		})
	})

	test("search filters by artifact metadata", async () => {
		const { headers } = await makeSuperAdminSession()
		const fixture = await makeThinkingBlockFixture()
		const res = await app.request(
			`/thinking-block/search?q=${fixture.identityKey}&status=ready&searchField=identityKey`,
			{ headers },
		)
		expect(res.status).toBe(200)
		const body = (await res.json()) as { results: Array<{ id: string }> }
		expect(body.results.map((row: { id: string }) => row.id)).toContain(
			fixture.artifactId,
		)
	})

	test("grouped list endpoints filter without loading child collections", async () => {
		const { headers } = await makeSuperAdminSession()
		const ready = await makeThinkingBlockFixture()
		const superseded = await makeThinkingBlockFixture({
			blockName: ready.blockName,
			status: "superseded",
		})

		const blocksRes = await app.request(
			`/thinking-block/blocks?q=${superseded.identityKey}&status=superseded`,
			{ headers },
		)
		expect(blocksRes.status).toBe(200)
		const blocksBody = (await blocksRes.json()) as {
			blocks: Array<{ blockName: string; totalArtifacts: number }>
		}
		const block = blocksBody.blocks.find(
			(row) => row.blockName === ready.blockName,
		)
		expect(block).toMatchObject({
			blockName: ready.blockName,
			totalArtifacts: 2,
		})

		const resourcesRes = await app.request(
			`/thinking-block/blocks/${ready.blockName}/resources?q=${superseded.identityKey}&status=superseded&searchField=identityKey`,
			{ headers },
		)
		expect(resourcesRes.status).toBe(200)
		const resourcesBody = (await resourcesRes.json()) as {
			resources: Array<{ identityKey: string; totalArtifacts: number }>
		}
		expect(resourcesBody.resources).toHaveLength(1)
		expect(resourcesBody.resources[0]).toMatchObject({
			identityKey: superseded.identityKey,
			totalArtifacts: 1,
		})
	})

	test("artifact versions are cursor paginated", async () => {
		const { headers } = await makeSuperAdminSession()
		const first = await makeThinkingBlockFixture({ status: "superseded" })
		const second = await makeThinkingBlockFixture({
			blockName: first.blockName,
			identityKey: first.identityKey,
			schemaHash: first.schemaHash,
			createdAt: new Date(Date.now() - 1000),
		})
		const identityRef = Buffer.from(
			JSON.stringify({
				blockName: first.blockName,
				blockVersion: first.blockVersion,
				identityKey: first.identityKey,
			}),
			"utf8",
		).toString("base64url")

		const firstPageRes = await app.request(
			`/thinking-block/resources/${identityRef}/artifacts?limit=1`,
			{ headers },
		)
		expect(firstPageRes.status).toBe(200)
		const firstPage = (await firstPageRes.json()) as {
			artifacts: Array<{ id: string }>
			nextCursor: string | null
		}
		expect(firstPage.artifacts).toHaveLength(1)
		expect(firstPage.artifacts[0]!.id).toBe(second.artifactId)
		expect(firstPage.nextCursor).toBeString()

		const secondPageRes = await app.request(
			`/thinking-block/resources/${identityRef}/artifacts?limit=1&cursor=${firstPage.nextCursor}`,
			{ headers },
		)
		expect(secondPageRes.status).toBe(200)
		const secondPage = (await secondPageRes.json()) as {
			artifacts: Array<{ id: string }>
			nextCursor: string | null
		}
		expect(secondPage.artifacts).toHaveLength(1)
		expect(secondPage.artifacts[0]!.id).toBe(first.artifactId)
		expect(secondPage.nextCursor).toBeNull()
	})

	test("resource identities are cursor paginated", async () => {
		const { headers } = await makeSuperAdminSession()
		const blockName = `resources-page-${crypto.randomUUID()}`
		const older = await makeThinkingBlockFixture({
			blockName,
			identityKey: `older-${crypto.randomUUID()}`,
			createdAt: new Date(Date.now() - 5000),
		})
		const newer = await makeThinkingBlockFixture({
			blockName,
			identityKey: `newer-${crypto.randomUUID()}`,
			createdAt: new Date(Date.now() - 1000),
		})

		const firstPageRes = await app.request(
			`/thinking-block/blocks/${blockName}/resources?limit=1`,
			{ headers },
		)
		expect(firstPageRes.status).toBe(200)
		const firstPage = (await firstPageRes.json()) as {
			resources: Array<{ identityKey: string }>
			nextCursor: string | null
		}
		expect(firstPage.resources).toHaveLength(1)
		expect(firstPage.resources[0]!.identityKey).toBe(newer.identityKey)
		expect(firstPage.nextCursor).toBeString()

		const secondPageRes = await app.request(
			`/thinking-block/blocks/${blockName}/resources?limit=1&cursor=${firstPage.nextCursor}`,
			{ headers },
		)
		expect(secondPageRes.status).toBe(200)
		const secondPage = (await secondPageRes.json()) as {
			resources: Array<{ identityKey: string }>
			nextCursor: string | null
		}
		expect(secondPage.resources).toHaveLength(1)
		expect(secondPage.resources[0]!.identityKey).toBe(older.identityKey)
		expect(secondPage.nextCursor).toBeNull()
	})

	test("resource cursor validation rejects malformed sort values", async () => {
		const { headers } = await makeSuperAdminSession()
		const fixture = await makeThinkingBlockFixture()
		const cursor = Buffer.from(
			JSON.stringify({
				sortBy: "latestUpdatedAt",
				sortDirection: "desc",
				sortValue: "not-a-date",
				blockVersion: fixture.blockVersion,
				identityKey: fixture.identityKey,
			}),
			"utf8",
		).toString("base64url")

		const res = await app.request(
			`/thinking-block/blocks/${fixture.blockName}/resources?cursor=${cursor}`,
			{ headers },
		)
		expect(res.status).toBe(400)
		expect(await res.json()).toEqual({ error: "Invalid request", status: 400 })
	})

	test("resource identities are sorted by the database", async () => {
		const { headers } = await makeSuperAdminSession()
		const blockName = `resources-sort-${crypto.randomUUID()}`
		const second = await makeThinkingBlockFixture({
			blockName,
			identityKey: `z-${crypto.randomUUID()}`,
			schemaHash: "z-schema",
		})
		const first = await makeThinkingBlockFixture({
			blockName,
			identityKey: `a-${crypto.randomUUID()}`,
			schemaHash: "a-schema",
		})

		const firstPageRes = await app.request(
			`/thinking-block/blocks/${blockName}/resources?sortBy=identityKey&sortDirection=asc&limit=1`,
			{ headers },
		)
		expect(firstPageRes.status).toBe(200)
		const firstPage = (await firstPageRes.json()) as {
			resources: Array<{ identityKey: string }>
			nextCursor: string | null
		}
		expect(firstPage.resources).toHaveLength(1)
		expect(firstPage.resources[0]!.identityKey).toBe(first.identityKey)
		expect(firstPage.nextCursor).toBeString()

		const secondPageRes = await app.request(
			`/thinking-block/blocks/${blockName}/resources?sortBy=identityKey&sortDirection=asc&limit=1&cursor=${firstPage.nextCursor}`,
			{ headers },
		)
		expect(secondPageRes.status).toBe(200)
		const secondPage = (await secondPageRes.json()) as {
			resources: Array<{ identityKey: string }>
			nextCursor: string | null
		}
		expect(secondPage.resources).toHaveLength(1)
		expect(secondPage.resources[0]!.identityKey).toBe(second.identityKey)
		expect(secondPage.nextCursor).toBeNull()
	})
})

async function makeSuperAdminSession(
	role = "member",
	options: {
		activeOrganizationId?: string | null
		insertMembership?: boolean
	} = {},
) {
	const session = await makeBrowserSession(role, options)
	const email = session.user.email.toLowerCase()
	if (!env.OPSY_SUPER_ADMIN_EMAILS.includes(email)) {
		env.OPSY_SUPER_ADMIN_EMAILS.push(email)
	}
	return session
}

async function makeBrowserSession(
	role: string,
	options: {
		activeOrganizationId?: string | null
		insertMembership?: boolean
	} = {},
) {
	const suffix = crypto.randomUUID()
	const [u] = await db
		.insert(user)
		.values({
			name: `Thinking Block ${role}`,
			email: `thinking-block-${role}-${suffix}@example.com`,
		})
		.returning()
	const [org] = await db
		.insert(organization)
		.values({
			name: `thinking-block-${role}-${suffix}`,
			slug: `tb-${role}-${suffix.slice(0, 12)}`,
			createdAt: new Date(),
		})
		.returning()
	if (!u || !org) throw new Error("failed to create auth fixture")

	if (options.insertMembership !== false) {
		await db.insert(member).values({
			organizationId: org.id,
			userId: u.id,
			role,
			createdAt: new Date(),
		})
	}

	const token = `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, "")
	const [session] = await db
		.insert(sessionTable)
		.values({
			token,
			expiresAt: new Date(Date.now() + 60 * 60 * 1000),
			userId: u.id,
			updatedAt: new Date(),
			activeOrganizationId:
				options.activeOrganizationId === undefined
					? org.id
					: options.activeOrganizationId,
		})
		.returning()
	if (!session) throw new Error("failed to create session fixture")

	return {
		token,
		headers: {
			Cookie: `better-auth.session_token=${await signedCookieValue(token)}`,
		},
		user: u,
		org,
		session,
	}
}

async function signedCookieValue(value: string): Promise<string> {
	const key = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(env.BETTER_AUTH_SECRET),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	)
	const signature = Buffer.from(
		await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value)),
	).toString("base64")
	return encodeURIComponent(`${value}.${signature}`)
}

async function makeThinkingBlockFixture(
	options: {
		blockName?: string
		identityKey?: string
		schemaHash?: string
		status?: "ready" | "superseded"
		createdAt?: Date
	} = {},
) {
	const suffix = crypto.randomUUID()
	const blockName = options.blockName ?? `audit-${suffix}`
	const blockVersion = "v1"
	const schemaHash = options.schemaHash ?? `schema-${suffix}`
	const identityKey =
		options.identityKey ??
		["test", "resource", "test_resource", schemaHash].join(":")
	const status = options.status ?? "ready"
	const createdAt = options.createdAt ?? new Date(Date.now() - 5000)
	const finishedAt = new Date(createdAt.getTime() + 1200)
	const [artifact] = await db
		.insert(thinkingBlockArtifacts)
		.values({
			blockName,
			blockVersion,
			identityKey,
			input: { name: "alpha" },
			status,
			output: { ok: true },
			readyAt: status === "ready" ? finishedAt : null,
			supersededAt: status === "superseded" ? finishedAt : null,
			createdAt,
			updatedAt: finishedAt,
		})
		.returning()
	if (!artifact) throw new Error("failed to create artifact fixture")

	const [run] = await db
		.insert(thinkingBlockRuns)
		.values({
			thinkingBlockArtifactId: artifact.id,
			blockName,
			status: "success",
			trigger: "test",
			metadata: { source: "routes.test" },
			startedAt: createdAt,
			finishedAt,
			durationMs: 1200,
			createdAt,
			updatedAt: finishedAt,
		})
		.returning()
	if (!run) throw new Error("failed to create run fixture")

	const [modelCall] = await db
		.insert(thinkingBlockModelCalls)
		.values({
			thinkingBlockRunId: run.id,
			operationId: "generate",
			attempt: 0,
			stepIndex: 0,
			role: "generate",
			blockName,
			provider: "mock",
			model: "mock-model",
			responseModel: "mock-response",
			status: "success",
			metadata: { source: "routes.test" },
			input: {
				prompt: "Generate alpha",
				options: {},
			},
			instructions: "Instructions",
			output: { text: "model output" },
			createdAt: finishedAt,
		})
		.returning()
	if (!modelCall) throw new Error("failed to create model call fixture")

	await db.insert(thinkingBlockValidationResults).values({
		thinkingBlockRunId: run.id,
		operationId: "validate",
		attempt: 0,
		validatorId: "shape",
		validatorType: "check",
		status: "pass",
		feedback: { message: "valid" },
		metadata: { source: "routes.test" },
		createdAt: finishedAt,
	})

	return {
		blockName,
		blockVersion,
		identityKey,
		schemaHash,
		artifactId: artifact.id,
		runId: run.id,
		modelCallId: modelCall.id,
	}
}
