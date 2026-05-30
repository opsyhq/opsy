import {
	and,
	asc,
	avg,
	count,
	desc,
	eq,
	gt,
	ilike,
	inArray,
	isNotNull,
	lt,
	max,
	or,
	type SQL,
	sql,
} from "drizzle-orm"
import type { Context } from "hono"
import { z } from "zod"
import { db } from "@/lib/db/client"
import {
	thinkingBlockArtifacts,
	thinkingBlockModelCalls,
	thinkingBlockRuns,
	thinkingBlockValidationResults,
} from "@/lib/db/schema"
import type { AppEnv } from "@/types"

// ---------------------------------------------------------------------------
// identity-key helpers (file-local)
// ---------------------------------------------------------------------------

const artifactIdentityRefSchema = z.object({
	blockName: z.string(),
	blockVersion: z.string(),
	identityKey: z.string(),
})

type ArtifactIdentityRef = z.infer<typeof artifactIdentityRefSchema>

function encodeArtifactIdentityRef(identity: ArtifactIdentityRef): string {
	return Buffer.from(JSON.stringify(identity), "utf8").toString("base64url")
}

function decodeArtifactIdentityRef(value: string): ArtifactIdentityRef | null {
	try {
		const decoded = JSON.parse(Buffer.from(value, "base64url").toString("utf8"))
		const parsed = artifactIdentityRefSchema.safeParse(decoded)
		return parsed.success ? parsed.data : null
	} catch {
		return null
	}
}

// ---------------------------------------------------------------------------
// validators (file-local)
// ---------------------------------------------------------------------------

const artifactStatuses = [
	"pending",
	"running",
	"ready",
	"rejected",
	"failed",
	"superseded",
] as const

const artifactStatusSchema = z.enum(artifactStatuses)

type ArtifactStatus = z.infer<typeof artifactStatusSchema>
type StatusCounts = Record<ArtifactStatus, number>

const timestampSchema = z.string().refine(
	(value) => {
		const time = Date.parse(value)
		return Number.isFinite(time)
	},
	{ message: "Invalid timestamp" },
)

const pageLimitSchema = z.preprocess(
	(value) => (value === undefined ? 50 : value),
	z.coerce.number().int().min(1).max(100).catch(50),
)

const optionalTextSchema = z
	.string()
	.trim()
	.optional()
	.transform((value) => value || undefined)

const optionalStatusSchema = z.preprocess(
	(value) => (value === "" || value === "all" ? undefined : value),
	artifactStatusSchema.optional(),
)

const resourceSortBySchema = z
	.enum(["latestUpdatedAt", "identityKey", "totalArtifacts"])
	.catch("latestUpdatedAt")

const resourceSortDirectionSchema = z.enum(["asc", "desc"]).catch("desc")

const encodedJsonCursor = <T extends z.ZodType>(schema: T) =>
	z.string().transform((value, ctx): z.infer<T> => {
		try {
			const decoded = JSON.parse(
				Buffer.from(value, "base64url").toString("utf8"),
			)
			const parsed = schema.safeParse(decoded)
			if (parsed.success) return parsed.data
		} catch {
			// zod issue is added below.
		}
		ctx.addIssue({
			code: "custom",
			message: "Invalid cursor",
		})
		return z.NEVER
	})

const blockCursorSchema = z.object({
	latestActivityAt: timestampSchema,
	blockName: z.string(),
})

const resourceCursorSchema = z
	.object({
		sortBy: resourceSortBySchema,
		sortDirection: resourceSortDirectionSchema,
		sortValue: z.union([z.string(), z.number().finite()]),
		blockVersion: z.string(),
		identityKey: z.string(),
	})
	.superRefine((value, ctx) => {
		if (
			value.sortBy === "latestUpdatedAt" &&
			(typeof value.sortValue !== "string" ||
				!Number.isFinite(Date.parse(value.sortValue)))
		) {
			ctx.addIssue({
				code: "custom",
				message: "Invalid cursor timestamp",
				path: ["sortValue"],
			})
		}
		if (
			value.sortBy === "totalArtifacts" &&
			typeof value.sortValue !== "number"
		) {
			ctx.addIssue({
				code: "custom",
				message: "Invalid cursor count",
				path: ["sortValue"],
			})
		}
		if (value.sortBy === "identityKey" && typeof value.sortValue !== "string") {
			ctx.addIssue({
				code: "custom",
				message: "Invalid cursor value",
				path: ["sortValue"],
			})
		}
	})

const artifactCursorSchema = z.object({
	createdAt: timestampSchema,
	id: z.uuid(),
})

const searchCursorSchema = z.object({
	updatedAt: timestampSchema,
	id: z.uuid(),
})

const listBlocksQuerySchema = z.object({
	limit: pageLimitSchema,
	cursor: encodedJsonCursor(blockCursorSchema).optional(),
	q: optionalTextSchema,
	status: optionalStatusSchema,
	searchField: z
		.enum(["all", "blockName", "artifactId", "identityKey"])
		.catch("all"),
})

const listResourcesQuerySchema = z.object({
	limit: pageLimitSchema,
	cursor: encodedJsonCursor(resourceCursorSchema).optional(),
	q: optionalTextSchema,
	status: optionalStatusSchema,
	sortBy: resourceSortBySchema,
	sortDirection: resourceSortDirectionSchema,
	searchField: z
		.enum(["all", "blockName", "artifactId", "identityKey"])
		.catch("all"),
})

const listArtifactVersionsQuerySchema = z.object({
	limit: pageLimitSchema,
	cursor: encodedJsonCursor(artifactCursorSchema).optional(),
})

const searchQuerySchema = z.object({
	limit: pageLimitSchema,
	cursor: encodedJsonCursor(searchCursorSchema).optional(),
	q: optionalTextSchema,
	blockName: optionalTextSchema,
	status: optionalStatusSchema,
	searchField: z
		.enum(["all", "blockName", "artifactId", "identityKey"])
		.catch("all"),
})

// ---------------------------------------------------------------------------
// blocks.ts
// ---------------------------------------------------------------------------

type BlockSummary = {
	blockName: string
	totalArtifacts: number
	statusCounts: StatusCounts
	latestActivityAt: string | null
	duration: {
		avgMs: number | null
		p95Ms: number | null
	}
}

export async function listBlocks(c: Context<AppEnv>) {
	const parsed = listBlocksQuerySchema.safeParse(c.req.query())
	if (!parsed.success)
		return c.json({ error: "Invalid request", status: 400 }, 400)
	const query = parsed.data

	const visibleBlockConditions: SQL[] = []
	if (query.q) {
		const pattern = `%${query.q}%`
		if (query.searchField === "blockName") {
			visibleBlockConditions.push(
				ilike(thinkingBlockArtifacts.blockName, pattern),
			)
		} else if (query.searchField === "artifactId") {
			visibleBlockConditions.push(
				ilike(sql<string>`${thinkingBlockArtifacts.id}::text`, pattern),
			)
		} else if (query.searchField === "identityKey") {
			visibleBlockConditions.push(
				ilike(thinkingBlockArtifacts.identityKey, pattern),
			)
		} else {
			visibleBlockConditions.push(
				or(
					ilike(thinkingBlockArtifacts.blockName, pattern),
					ilike(sql<string>`${thinkingBlockArtifacts.id}::text`, pattern),
					ilike(thinkingBlockArtifacts.identityKey, pattern),
				) ?? sql`false`,
			)
		}
	}
	if (query.status) {
		visibleBlockConditions.push(eq(thinkingBlockArtifacts.status, query.status))
	}

	const latestActivityAt = max(thinkingBlockArtifacts.updatedAt)
	const rows = await db
		.select({
			blockName: thinkingBlockArtifacts.blockName,
			latestActivityAt,
		})
		.from(thinkingBlockArtifacts)
		.where(and(...visibleBlockConditions))
		.groupBy(thinkingBlockArtifacts.blockName)
		.having(
			query.cursor
				? or(
						sql<boolean>`${latestActivityAt} < ${query.cursor.latestActivityAt}::timestamptz`,
						and(
							sql<boolean>`${latestActivityAt} = ${query.cursor.latestActivityAt}::timestamptz`,
							gt(thinkingBlockArtifacts.blockName, query.cursor.blockName),
						),
					)
				: undefined,
		)
		.orderBy(desc(latestActivityAt), asc(thinkingBlockArtifacts.blockName))
		.limit(query.limit + 1)

	const page = rows.slice(0, query.limit)
	const blockNames = page.map((row) => row.blockName)
	const [statusRows, durationRows] =
		blockNames.length === 0
			? [[], []]
			: await Promise.all([
					db
						.select({
							blockName: thinkingBlockArtifacts.blockName,
							status: thinkingBlockArtifacts.status,
							value: count(),
						})
						.from(thinkingBlockArtifacts)
						.where(inArray(thinkingBlockArtifacts.blockName, blockNames))
						.groupBy(
							thinkingBlockArtifacts.blockName,
							thinkingBlockArtifacts.status,
						),
					db
						.select({
							blockName: thinkingBlockRuns.blockName,
							avgMs: avg(thinkingBlockRuns.durationMs),
							p95Ms: sql<
								number | string | null
							>`percentile_cont(0.95) WITHIN GROUP (ORDER BY ${thinkingBlockRuns.durationMs})`,
						})
						.from(thinkingBlockRuns)
						.where(
							and(
								inArray(thinkingBlockRuns.blockName, blockNames),
								isNotNull(thinkingBlockRuns.durationMs),
							),
						)
						.groupBy(thinkingBlockRuns.blockName),
				])

	const visibleBlockStatusCounts = new Map<
		string,
		Partial<Record<(typeof artifactStatuses)[number], number>>
	>()
	for (const row of statusRows) {
		const statusCounts = visibleBlockStatusCounts.get(row.blockName) ?? {}
		statusCounts[row.status] = row.value
		visibleBlockStatusCounts.set(row.blockName, statusCounts)
	}

	const visibleBlockDurations = new Map<
		string,
		{ avgMs: number | null; p95Ms: number | null }
	>()
	for (const row of durationRows) {
		visibleBlockDurations.set(row.blockName, {
			avgMs: row.avgMs === null ? null : Number(row.avgMs),
			p95Ms: row.p95Ms === null ? null : Number(row.p95Ms),
		})
	}

	const blocks: BlockSummary[] = page.map((row) => {
		const counts = visibleBlockStatusCounts.get(row.blockName) ?? {}
		const statusCounts = {
			pending: counts.pending ?? 0,
			running: counts.running ?? 0,
			ready: counts.ready ?? 0,
			rejected: counts.rejected ?? 0,
			failed: counts.failed ?? 0,
			superseded: counts.superseded ?? 0,
		}
		return {
			blockName: row.blockName,
			totalArtifacts: artifactStatuses.reduce(
				(total, status) => total + statusCounts[status],
				0,
			),
			statusCounts,
			latestActivityAt: row.latestActivityAt
				? new Date(row.latestActivityAt).toISOString()
				: null,
			duration: visibleBlockDurations.get(row.blockName) ?? {
				avgMs: null,
				p95Ms: null,
			},
		}
	})

	return c.json({
		blocks,
		nextCursor:
			rows.length > query.limit && page.at(-1)
				? Buffer.from(
						JSON.stringify({
							latestActivityAt: page.at(-1)?.latestActivityAt
								? new Date(page.at(-1)?.latestActivityAt ?? "").toISOString()
								: "",
							blockName: page.at(-1)?.blockName ?? "",
						}),
						"utf8",
					).toString("base64url")
				: null,
	})
}

// ---------------------------------------------------------------------------
// artifacts.ts
// ---------------------------------------------------------------------------

type ArtifactVersionSummary = {
	runCount: number
	modelCallCount: number
	validationCount: number
	latestDurationMs: number | null
}

export async function listArtifactVersions(c: Context<AppEnv>) {
	const identityRef = c.req.param("identityRef")
	if (!identityRef) return c.json({ error: "Not found", status: 404 }, 404)
	const identity = decodeArtifactIdentityRef(identityRef)
	if (!identity) return c.json({ error: "Not found", status: 404 }, 404)

	const parsed = listArtifactVersionsQuerySchema.safeParse(c.req.query())
	if (!parsed.success)
		return c.json({ error: "Invalid request", status: 400 }, 400)
	const query = parsed.data

	const exists = await db.query.thinkingBlockArtifacts.findFirst({
		where: and(
			eq(thinkingBlockArtifacts.blockName, identity.blockName),
			eq(thinkingBlockArtifacts.blockVersion, identity.blockVersion),
			eq(thinkingBlockArtifacts.identityKey, identity.identityKey),
		),
	})
	if (!exists) return c.json({ error: "Not found", status: 404 }, 404)

	const rows = await db
		.select()
		.from(thinkingBlockArtifacts)
		.where(
			and(
				eq(thinkingBlockArtifacts.blockName, identity.blockName),
				eq(thinkingBlockArtifacts.blockVersion, identity.blockVersion),
				eq(thinkingBlockArtifacts.identityKey, identity.identityKey),
				query.cursor
					? or(
							sql<boolean>`${thinkingBlockArtifacts.createdAt} < ${query.cursor.createdAt}::timestamptz`,
							and(
								sql<boolean>`${thinkingBlockArtifacts.createdAt} = ${query.cursor.createdAt}::timestamptz`,
								lt(thinkingBlockArtifacts.id, query.cursor.id),
							),
						)
					: undefined,
			),
		)
		.orderBy(
			desc(thinkingBlockArtifacts.createdAt),
			desc(thinkingBlockArtifacts.id),
		)
		.limit(query.limit + 1)

	const page = rows.slice(0, query.limit)
	const versionSummaries = await readArtifactVersionSummaries(
		page.map((row) => row.id),
	)

	return c.json({
		identity: {
			...identity,
			identityRef,
		},
		artifacts: page.map((row) =>
			artifactVersionResponse(row, versionSummaries.get(row.id)),
		),
		nextCursor:
			rows.length > query.limit && page.at(-1)
				? Buffer.from(
						JSON.stringify({
							createdAt: page.at(-1)?.createdAt
								? new Date(page.at(-1)?.createdAt ?? "").toISOString()
								: "",
							id: page.at(-1)?.id ?? "",
						}),
						"utf8",
					).toString("base64url")
				: null,
	})
}

export async function getArtifactDetail(c: Context<AppEnv>) {
	const artifactId = c.req.param("artifactId")
	if (!artifactId) return c.json({ error: "Not found", status: 404 }, 404)
	const artifact = await db.query.thinkingBlockArtifacts.findFirst({
		where: eq(thinkingBlockArtifacts.id, artifactId),
	})
	if (!artifact) return c.json({ error: "Not found", status: 404 }, 404)

	const runs = await db
		.select()
		.from(thinkingBlockRuns)
		.where(eq(thinkingBlockRuns.thinkingBlockArtifactId, artifact.id))
		.orderBy(asc(thinkingBlockRuns.startedAt), asc(thinkingBlockRuns.id))

	const runIds = runs.map((run) => run.id)
	const [modelCalls, validations, supersededArtifacts] = await Promise.all([
		runIds.length > 0
			? db
					.select()
					.from(thinkingBlockModelCalls)
					.where(inArray(thinkingBlockModelCalls.thinkingBlockRunId, runIds))
					.orderBy(
						asc(thinkingBlockModelCalls.createdAt),
						asc(thinkingBlockModelCalls.attempt),
						asc(thinkingBlockModelCalls.stepIndex),
						asc(thinkingBlockModelCalls.id),
					)
			: Promise.resolve([]),
		runIds.length > 0
			? db
					.select()
					.from(thinkingBlockValidationResults)
					.where(
						inArray(thinkingBlockValidationResults.thinkingBlockRunId, runIds),
					)
					.orderBy(
						asc(thinkingBlockValidationResults.createdAt),
						asc(thinkingBlockValidationResults.attempt),
						asc(thinkingBlockValidationResults.id),
					)
			: Promise.resolve([]),
		db
			.select({
				id: thinkingBlockArtifacts.id,
				status: thinkingBlockArtifacts.status,
				createdAt: thinkingBlockArtifacts.createdAt,
				updatedAt: thinkingBlockArtifacts.updatedAt,
			})
			.from(thinkingBlockArtifacts)
			.where(eq(thinkingBlockArtifacts.supersededBy, artifact.id))
			.orderBy(
				asc(thinkingBlockArtifacts.supersededAt),
				asc(thinkingBlockArtifacts.id),
			),
	])

	const identity = {
		blockName: artifact.blockName,
		blockVersion: artifact.blockVersion,
		identityKey: artifact.identityKey,
	}

	const statusHistory = [
		{
			status: "pending",
			at: artifact.createdAt.toISOString(),
			source: "artifact",
			label: "Artifact created",
		},
		...runs.flatMap((run) => [
			{
				status: "running",
				at: run.startedAt.toISOString(),
				source: "run",
				runId: run.id,
				label: "Run started",
			},
			...(run.finishedAt
				? [
						{
							status: run.status === "success" ? "ready" : run.status,
							at: run.finishedAt.toISOString(),
							source: "run",
							runId: run.id,
							label: `Run ${run.status}`,
						},
					]
				: []),
		]),
		...(() => {
			const finalAt =
				artifact.status === "ready"
					? artifact.readyAt
					: artifact.status === "superseded"
						? artifact.supersededAt
						: artifact.status === "rejected" || artifact.status === "failed"
							? artifact.updatedAt
							: null
			return finalAt
				? [
						{
							status: artifact.status,
							at: finalAt.toISOString(),
							source: "artifact",
							label: `Artifact ${artifact.status}`,
						},
					]
				: []
		})(),
	].sort((a, b) => a.at.localeCompare(b.at))

	return c.json({
		artifact: {
			id: artifact.id,
			blockName: artifact.blockName,
			blockVersion: artifact.blockVersion,
			identityRef: encodeArtifactIdentityRef(identity),
			identityKey: artifact.identityKey,
			status: artifact.status,
			phase: artifact.phase,
			phaseLabel: artifact.phaseLabel,
			phaseAt: artifact.phaseAt?.toISOString() ?? null,
			createdAt: artifact.createdAt.toISOString(),
			updatedAt: artifact.updatedAt.toISOString(),
			readyAt: artifact.readyAt?.toISOString() ?? null,
			input: artifact.input,
			output: artifact.output,
			rejection: artifact.rejection,
			error: artifact.error,
			supersededBy: artifact.supersededBy,
			supersededAt: artifact.supersededAt?.toISOString() ?? null,
		},
		runs: runs.map((run) => ({
			id: run.id,
			artifactId: run.thinkingBlockArtifactId,
			blockName: run.blockName,
			status: run.status,
			trigger: run.trigger,
			rejectionReason: run.rejectionReason,
			rejection: run.rejection,
			metadata: run.metadata,
			error: run.error,
			startedAt: run.startedAt.toISOString(),
			finishedAt: run.finishedAt?.toISOString() ?? null,
			durationMs: run.durationMs,
			createdAt: run.createdAt.toISOString(),
			updatedAt: run.updatedAt.toISOString(),
		})),
		modelCalls: modelCalls.map((call) => ({
			id: call.id,
			runId: call.thinkingBlockRunId,
			operationId: call.operationId,
			attempt: call.attempt,
			stepIndex: call.stepIndex,
			role: call.role,
			blockName: call.blockName,
			provider: call.provider,
			model: call.model,
			responseModel: call.responseModel,
			status: call.status,
			artifactType: call.artifactType,
			artifactId: call.artifactId,
			metadata: call.metadata,
			input: call.input,
			instructions: call.instructions,
			instructionsHash: call.instructionsHash,
			output: call.output,
			error: call.error,
			validatorId: call.validatorId,
			validatorType: call.validatorType,
			createdAt: call.createdAt.toISOString(),
		})),
		validations: validations.map((validation) => ({
			id: validation.id,
			runId: validation.thinkingBlockRunId,
			operationId: validation.operationId,
			attempt: validation.attempt,
			validatorId: validation.validatorId,
			validatorType: validation.validatorType,
			status: validation.status,
			feedback: validation.feedback,
			metadata: validation.metadata,
			createdAt: validation.createdAt.toISOString(),
		})),
		statusHistory,
		lineage: {
			supersededBy: artifact.supersededBy,
			supersededAt: artifact.supersededAt?.toISOString() ?? null,
			supersededArtifacts: supersededArtifacts.map((row) => ({
				id: row.id,
				status: row.status,
				createdAt: row.createdAt.toISOString(),
				updatedAt: row.updatedAt.toISOString(),
			})),
		},
		aiSdkTrace: {
			events: [],
			source: "durable_model_calls",
			message:
				"No supplementary AI SDK telemetry events are persisted for this artifact. The model-call records above are the durable generation trace.",
		},
	})
}

export async function readArtifactVersionSummaries(artifactIds: string[]) {
	const summariesByArtifactId = new Map<string, ArtifactVersionSummary>()
	if (artifactIds.length === 0) return summariesByArtifactId

	for (const artifactId of artifactIds) {
		summariesByArtifactId.set(artifactId, {
			runCount: 0,
			modelCallCount: 0,
			validationCount: 0,
			latestDurationMs: null,
		})
	}

	const [runCounts, modelCallCounts, validationCounts, durationRows] =
		await Promise.all([
			db
				.select({
					artifactId: thinkingBlockRuns.thinkingBlockArtifactId,
					value: count(),
				})
				.from(thinkingBlockRuns)
				.where(inArray(thinkingBlockRuns.thinkingBlockArtifactId, artifactIds))
				.groupBy(thinkingBlockRuns.thinkingBlockArtifactId),
			db
				.select({
					artifactId: thinkingBlockRuns.thinkingBlockArtifactId,
					value: count(),
				})
				.from(thinkingBlockModelCalls)
				.innerJoin(
					thinkingBlockRuns,
					eq(thinkingBlockModelCalls.thinkingBlockRunId, thinkingBlockRuns.id),
				)
				.where(inArray(thinkingBlockRuns.thinkingBlockArtifactId, artifactIds))
				.groupBy(thinkingBlockRuns.thinkingBlockArtifactId),
			db
				.select({
					artifactId: thinkingBlockRuns.thinkingBlockArtifactId,
					value: count(),
				})
				.from(thinkingBlockValidationResults)
				.innerJoin(
					thinkingBlockRuns,
					eq(
						thinkingBlockValidationResults.thinkingBlockRunId,
						thinkingBlockRuns.id,
					),
				)
				.where(inArray(thinkingBlockRuns.thinkingBlockArtifactId, artifactIds))
				.groupBy(thinkingBlockRuns.thinkingBlockArtifactId),
			db
				.select({
					artifactId: thinkingBlockRuns.thinkingBlockArtifactId,
					durationMs: thinkingBlockRuns.durationMs,
				})
				.from(thinkingBlockRuns)
				.where(
					and(
						inArray(thinkingBlockRuns.thinkingBlockArtifactId, artifactIds),
						isNotNull(thinkingBlockRuns.durationMs),
					),
				)
				.orderBy(
					desc(thinkingBlockRuns.finishedAt),
					desc(thinkingBlockRuns.startedAt),
					desc(thinkingBlockRuns.id),
				),
		])

	for (const row of runCounts) {
		const summary = row.artifactId
			? summariesByArtifactId.get(row.artifactId)
			: undefined
		if (summary) {
			summary.runCount = row.value
		}
	}
	for (const row of modelCallCounts) {
		const summary = row.artifactId
			? summariesByArtifactId.get(row.artifactId)
			: undefined
		if (summary) {
			summary.modelCallCount = row.value
		}
	}
	for (const row of validationCounts) {
		const summary = row.artifactId
			? summariesByArtifactId.get(row.artifactId)
			: undefined
		if (summary) {
			summary.validationCount = row.value
		}
	}
	for (const row of durationRows) {
		const summary = row.artifactId
			? summariesByArtifactId.get(row.artifactId)
			: undefined
		if (
			summary &&
			row.durationMs !== null &&
			summary.latestDurationMs === null
		) {
			summary.latestDurationMs = row.durationMs
		}
	}

	return summariesByArtifactId
}

export function artifactVersionResponse(
	row: typeof thinkingBlockArtifacts.$inferSelect,
	summary: ArtifactVersionSummary | undefined,
) {
	return {
		id: row.id,
		blockName: row.blockName,
		blockVersion: row.blockVersion,
		identityRef: encodeArtifactIdentityRef({
			blockName: row.blockName,
			blockVersion: row.blockVersion,
			identityKey: row.identityKey,
		}),
		identityKey: row.identityKey,
		status: row.status,
		phase: row.phase,
		phaseLabel: row.phaseLabel,
		phaseAt: row.phaseAt?.toISOString() ?? null,
		createdAt: row.createdAt.toISOString(),
		updatedAt: row.updatedAt.toISOString(),
		readyAt: row.readyAt?.toISOString() ?? null,
		supersededBy: row.supersededBy,
		supersededAt: row.supersededAt?.toISOString() ?? null,
		runCount: summary?.runCount ?? 0,
		modelCallCount: summary?.modelCallCount ?? 0,
		validationCount: summary?.validationCount ?? 0,
		latestDurationMs: summary?.latestDurationMs ?? null,
	}
}

// ---------------------------------------------------------------------------
// resources.ts
// ---------------------------------------------------------------------------

type ResourceSummary = {
	identityRef: string
	blockName: string
	blockVersion: string
	identityKey: string
	totalArtifacts: number
	statusCounts: StatusCounts
	latestArtifactId: string | null
	latestStatus: string | null
	latestPhase: string | null
	latestPhaseLabel: string | null
	latestUpdatedAt: string | null
	latestDurationMs: number | null
	duration: {
		avgMs: number | null
		p95Ms: number | null
	}
}

type ResourceSortBy = "latestUpdatedAt" | "identityKey" | "totalArtifacts"
type ResourceSortDirection = "asc" | "desc"

export async function listBlockResources(c: Context<AppEnv>) {
	const blockName = c.req.param("blockName")
	if (!blockName) return c.json({ error: "Not found", status: 404 }, 404)
	const parsed = listResourcesQuerySchema.safeParse(c.req.query())
	if (!parsed.success)
		return c.json({ error: "Invalid request", status: 400 }, 400)
	const query = parsed.data

	const exists = await db.query.thinkingBlockArtifacts.findFirst({
		columns: { id: true },
		where: eq(thinkingBlockArtifacts.blockName, blockName),
	})
	if (!exists) return c.json({ error: "Not found", status: 404 }, 404)

	const visibleIdentityConditions: SQL[] = [
		eq(thinkingBlockArtifacts.blockName, blockName),
	]
	if (query.q) {
		const pattern = `%${query.q}%`
		if (query.searchField === "blockName") {
			visibleIdentityConditions.push(
				ilike(thinkingBlockArtifacts.blockName, pattern),
			)
		} else if (query.searchField === "artifactId") {
			visibleIdentityConditions.push(
				ilike(sql<string>`${thinkingBlockArtifacts.id}::text`, pattern),
			)
		} else if (query.searchField === "identityKey") {
			visibleIdentityConditions.push(
				ilike(thinkingBlockArtifacts.identityKey, pattern),
			)
		} else {
			visibleIdentityConditions.push(
				or(
					ilike(thinkingBlockArtifacts.blockName, pattern),
					ilike(sql<string>`${thinkingBlockArtifacts.id}::text`, pattern),
					ilike(thinkingBlockArtifacts.identityKey, pattern),
				) ?? sql`false`,
			)
		}
	}
	if (query.status) {
		visibleIdentityConditions.push(
			eq(thinkingBlockArtifacts.status, query.status),
		)
	}

	const latestUpdatedAt = max(thinkingBlockArtifacts.updatedAt)
	const totalArtifacts = count()
	const sortValue =
		query.sortBy === "identityKey"
			? sql<string>`${thinkingBlockArtifacts.identityKey}`
			: query.sortBy === "totalArtifacts"
				? sql<number>`${totalArtifacts}`
				: sql<Date>`${latestUpdatedAt}`
	if (
		query.cursor &&
		(query.cursor.sortBy !== query.sortBy ||
			query.cursor.sortDirection !== query.sortDirection)
	) {
		return c.json({ error: "Invalid request", status: 400 }, 400)
	}
	const cursorTie =
		query.cursor &&
		(or(
			gt(thinkingBlockArtifacts.blockVersion, query.cursor.blockVersion),
			and(
				eq(thinkingBlockArtifacts.blockVersion, query.cursor.blockVersion),
				gt(thinkingBlockArtifacts.identityKey, query.cursor.identityKey),
			),
		) ??
			sql`false`)
	const cursorCondition = query.cursor
		? or(
				cursorSortComparison(
					query.sortBy,
					query.sortDirection,
					sortValue,
					query.cursor.sortValue,
				),
				and(
					cursorSortEquality(query.sortBy, sortValue, query.cursor.sortValue),
					cursorTie,
				),
			)
		: undefined

	const rows = await db
		.select({
			blockName: thinkingBlockArtifacts.blockName,
			blockVersion: thinkingBlockArtifacts.blockVersion,
			identityKey: thinkingBlockArtifacts.identityKey,
			latestUpdatedAt,
			totalArtifacts,
			sortValue,
		})
		.from(thinkingBlockArtifacts)
		.where(and(...visibleIdentityConditions))
		.groupBy(
			thinkingBlockArtifacts.blockName,
			thinkingBlockArtifacts.blockVersion,
			thinkingBlockArtifacts.identityKey,
		)
		.having(cursorCondition)
		.orderBy(
			query.sortDirection === "asc" ? asc(sortValue) : desc(sortValue),
			asc(thinkingBlockArtifacts.blockVersion),
			asc(thinkingBlockArtifacts.identityKey),
		)
		.limit(query.limit + 1)

	const page = rows.slice(0, query.limit)
	const identityConditions =
		page.length === 0
			? sql`false`
			: (or(
					...page.map((identity) =>
						and(
							eq(thinkingBlockArtifacts.blockVersion, identity.blockVersion),
							eq(thinkingBlockArtifacts.identityKey, identity.identityKey),
						),
					),
				) ?? sql`false`)

	const [statusRows, latestArtifactRows, durationRows, latestDurationRows] =
		page.length === 0
			? [[], [], [], []]
			: await Promise.all([
					db
						.select({
							blockVersion: thinkingBlockArtifacts.blockVersion,
							identityKey: thinkingBlockArtifacts.identityKey,
							status: thinkingBlockArtifacts.status,
							value: count(),
						})
						.from(thinkingBlockArtifacts)
						.where(and(...visibleIdentityConditions, identityConditions))
						.groupBy(
							thinkingBlockArtifacts.blockVersion,
							thinkingBlockArtifacts.identityKey,
							thinkingBlockArtifacts.status,
						),
					db
						.select({
							id: thinkingBlockArtifacts.id,
							blockVersion: thinkingBlockArtifacts.blockVersion,
							identityKey: thinkingBlockArtifacts.identityKey,
							status: thinkingBlockArtifacts.status,
							phase: thinkingBlockArtifacts.phase,
							phaseLabel: thinkingBlockArtifacts.phaseLabel,
						})
						.from(thinkingBlockArtifacts)
						.where(and(...visibleIdentityConditions, identityConditions))
						.orderBy(
							desc(thinkingBlockArtifacts.updatedAt),
							desc(thinkingBlockArtifacts.createdAt),
							desc(thinkingBlockArtifacts.id),
						),
					db
						.select({
							blockVersion: thinkingBlockArtifacts.blockVersion,
							identityKey: thinkingBlockArtifacts.identityKey,
							avgMs: avg(thinkingBlockRuns.durationMs),
							p95Ms: sql<
								number | string | null
							>`percentile_cont(0.95) WITHIN GROUP (ORDER BY ${thinkingBlockRuns.durationMs})`,
						})
						.from(thinkingBlockArtifacts)
						.innerJoin(
							thinkingBlockRuns,
							eq(
								thinkingBlockRuns.thinkingBlockArtifactId,
								thinkingBlockArtifacts.id,
							),
						)
						.where(
							and(
								...visibleIdentityConditions,
								identityConditions,
								isNotNull(thinkingBlockRuns.durationMs),
							),
						)
						.groupBy(
							thinkingBlockArtifacts.blockVersion,
							thinkingBlockArtifacts.identityKey,
						),
					db
						.select({
							blockVersion: thinkingBlockArtifacts.blockVersion,
							identityKey: thinkingBlockArtifacts.identityKey,
							durationMs: thinkingBlockRuns.durationMs,
						})
						.from(thinkingBlockArtifacts)
						.innerJoin(
							thinkingBlockRuns,
							eq(
								thinkingBlockRuns.thinkingBlockArtifactId,
								thinkingBlockArtifacts.id,
							),
						)
						.where(
							and(
								...visibleIdentityConditions,
								identityConditions,
								isNotNull(thinkingBlockRuns.durationMs),
							),
						)
						.orderBy(
							desc(thinkingBlockRuns.finishedAt),
							desc(thinkingBlockRuns.startedAt),
							desc(thinkingBlockRuns.id),
						),
				])

	const visibleIdentityStatusCounts = new Map<string, Partial<StatusCounts>>()
	for (const row of statusRows) {
		const key = identityGroupKey(row)
		const counts = visibleIdentityStatusCounts.get(key) ?? {}
		counts[row.status] = row.value
		visibleIdentityStatusCounts.set(key, counts)
	}

	const visibleIdentityLatestArtifacts = new Map<
		string,
		(typeof latestArtifactRows)[number]
	>()
	for (const row of latestArtifactRows) {
		const key = identityGroupKey(row)
		if (!visibleIdentityLatestArtifacts.has(key)) {
			visibleIdentityLatestArtifacts.set(key, row)
		}
	}

	const visibleIdentityDurations = new Map<
		string,
		{ avgMs: number | null; p95Ms: number | null }
	>()
	for (const row of durationRows) {
		visibleIdentityDurations.set(identityGroupKey(row), {
			avgMs: row.avgMs === null ? null : Number(row.avgMs),
			p95Ms: row.p95Ms === null ? null : Number(row.p95Ms),
		})
	}

	const visibleIdentityLatestDurations = new Map<string, number>()
	for (const row of latestDurationRows) {
		const key = identityGroupKey(row)
		if (row.durationMs !== null && !visibleIdentityLatestDurations.has(key)) {
			visibleIdentityLatestDurations.set(key, row.durationMs)
		}
	}

	const resources: ResourceSummary[] = page.map((row) => {
		const key = identityGroupKey(row)
		const counts = visibleIdentityStatusCounts.get(key) ?? {}
		const latestArtifact = visibleIdentityLatestArtifacts.get(key)
		const statusCounts = {
			pending: counts.pending ?? 0,
			running: counts.running ?? 0,
			ready: counts.ready ?? 0,
			rejected: counts.rejected ?? 0,
			failed: counts.failed ?? 0,
			superseded: counts.superseded ?? 0,
		}
		return {
			identityRef: encodeArtifactIdentityRef({
				blockName: row.blockName,
				blockVersion: row.blockVersion,
				identityKey: row.identityKey,
			}),
			blockName: row.blockName,
			blockVersion: row.blockVersion,
			identityKey: row.identityKey,
			totalArtifacts: row.totalArtifacts,
			statusCounts,
			latestArtifactId: latestArtifact?.id ?? null,
			latestStatus: latestArtifact?.status ?? null,
			latestPhase: latestArtifact?.phase ?? null,
			latestPhaseLabel: latestArtifact?.phaseLabel ?? null,
			latestUpdatedAt: row.latestUpdatedAt
				? new Date(row.latestUpdatedAt).toISOString()
				: null,
			latestDurationMs: visibleIdentityLatestDurations.get(key) ?? null,
			duration: visibleIdentityDurations.get(key) ?? {
				avgMs: null,
				p95Ms: null,
			},
		}
	})

	return c.json({
		blockName,
		resources,
		nextCursor:
			rows.length > query.limit && page.at(-1)
				? Buffer.from(
						JSON.stringify({
							sortBy: query.sortBy,
							sortDirection: query.sortDirection,
							sortValue:
								query.sortBy === "latestUpdatedAt"
									? page.at(-1)?.sortValue
										? new Date(page.at(-1)?.sortValue ?? "").toISOString()
										: ""
									: query.sortBy === "totalArtifacts"
										? Number(page.at(-1)?.sortValue ?? 0)
										: String(page.at(-1)?.sortValue ?? ""),
							identityKey: page.at(-1)?.identityKey ?? "",
							blockVersion: page.at(-1)?.blockVersion ?? "",
						}),
						"utf8",
					).toString("base64url")
				: null,
	})
}

function cursorSortComparison(
	sortBy: ResourceSortBy,
	direction: ResourceSortDirection,
	sortValue: SQL,
	cursorValue: string | number,
) {
	if (sortBy === "latestUpdatedAt") {
		return direction === "asc"
			? sql<boolean>`${sortValue} > ${String(cursorValue)}::timestamptz`
			: sql<boolean>`${sortValue} < ${String(cursorValue)}::timestamptz`
	}
	if (sortBy === "totalArtifacts") {
		return direction === "asc"
			? gt(sortValue, Number(cursorValue))
			: lt(sortValue, Number(cursorValue))
	}
	return direction === "asc"
		? gt(sortValue, String(cursorValue))
		: lt(sortValue, String(cursorValue))
}

function cursorSortEquality(
	sortBy: ResourceSortBy,
	sortValue: SQL,
	cursorValue: string | number,
) {
	if (sortBy === "latestUpdatedAt") {
		return sql<boolean>`${sortValue} = ${String(cursorValue)}::timestamptz`
	}
	if (sortBy === "totalArtifacts") {
		return eq(sortValue, Number(cursorValue))
	}
	return eq(sortValue, String(cursorValue))
}

function identityGroupKey(input: {
	blockVersion: string
	identityKey: string
}): string {
	return `${input.blockVersion} ${input.identityKey}`
}

// ---------------------------------------------------------------------------
// search.ts
// ---------------------------------------------------------------------------

export async function searchArtifacts(c: Context<AppEnv>) {
	const parsed = searchQuerySchema.safeParse(c.req.query())
	if (!parsed.success)
		return c.json({ error: "Invalid request", status: 400 }, 400)
	const query = parsed.data

	const conditions: SQL[] = []
	if (query.q) {
		const pattern = `%${query.q}%`
		if (query.searchField === "blockName") {
			conditions.push(ilike(thinkingBlockArtifacts.blockName, pattern))
		} else if (query.searchField === "artifactId") {
			conditions.push(
				ilike(sql<string>`${thinkingBlockArtifacts.id}::text`, pattern),
			)
		} else if (query.searchField === "identityKey") {
			conditions.push(ilike(thinkingBlockArtifacts.identityKey, pattern))
		} else {
			conditions.push(
				or(
					ilike(thinkingBlockArtifacts.blockName, pattern),
					ilike(sql<string>`${thinkingBlockArtifacts.id}::text`, pattern),
					ilike(thinkingBlockArtifacts.identityKey, pattern),
				) ?? sql`false`,
			)
		}
	}
	if (query.blockName) {
		conditions.push(eq(thinkingBlockArtifacts.blockName, query.blockName))
	}
	if (query.status) {
		conditions.push(eq(thinkingBlockArtifacts.status, query.status))
	}
	if (query.cursor) {
		conditions.push(
			or(
				sql<boolean>`${thinkingBlockArtifacts.updatedAt} < ${query.cursor.updatedAt}::timestamptz`,
				and(
					sql<boolean>`${thinkingBlockArtifacts.updatedAt} = ${query.cursor.updatedAt}::timestamptz`,
					lt(thinkingBlockArtifacts.id, query.cursor.id),
				),
			) ?? sql`false`,
		)
	}

	const rows = await db
		.select()
		.from(thinkingBlockArtifacts)
		.where(and(...conditions))
		.orderBy(
			desc(thinkingBlockArtifacts.updatedAt),
			desc(thinkingBlockArtifacts.id),
		)
		.limit(query.limit + 1)

	const page = rows.slice(0, query.limit)
	const versionSummaries = await readArtifactVersionSummaries(
		page.map((row) => row.id),
	)

	return c.json({
		results: page.map((row) => ({
			...artifactVersionResponse(row, versionSummaries.get(row.id)),
			input: row.input,
			output: row.output,
			rejection: row.rejection,
			error: row.error,
		})),
		nextCursor:
			rows.length > query.limit && page.at(-1)
				? Buffer.from(
						JSON.stringify({
							updatedAt: page.at(-1)?.updatedAt
								? new Date(page.at(-1)?.updatedAt ?? "").toISOString()
								: "",
							id: page.at(-1)?.id ?? "",
						}),
						"utf8",
					).toString("base64url")
				: null,
	})
}
