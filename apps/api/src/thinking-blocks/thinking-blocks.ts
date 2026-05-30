import type {
	ClaimPendingThinkingBlockArtifactsInput,
	CreateThinkingBlockArtifactInput,
	FailThinkingBlockRunInput,
	FinishThinkingBlockRunInput,
	MarkThinkingBlockArtifactFailedInput,
	MarkThinkingBlockArtifactReadyInput,
	MarkThinkingBlockArtifactRejectedInput,
	RecordThinkingBlockModelCallInput,
	RecordThinkingBlockValidationInput,
	RejectThinkingBlockRunInput,
	RequeueRetryableThinkingBlockArtifactsInput,
	UpdateThinkingBlockArtifactPhaseInput,
	StartThinkingBlockRunInput,
	ThinkingBlockArtifactRecord,
	ThinkingBlockArtifactStatus,
	ThinkingBlockIdentity,
	ThinkingBlockStore,
} from "@opsy/thinking-blocks"
import {
	and,
	asc,
	desc,
	eq,
	inArray,
	lte,
	ne,
	notInArray,
	sql,
} from "drizzle-orm"
import { db } from "../lib/db/client"
import {
	thinkingBlockArtifacts,
	thinkingBlockModelCalls,
	thinkingBlockRuns,
	thinkingBlockValidationResults,
} from "../lib/db/schema"
import { toJsonValue } from "../lib/json"

class DrizzleThinkingBlockStore implements ThinkingBlockStore {
	async createArtifact(
		input: CreateThinkingBlockArtifactInput,
	): Promise<ThinkingBlockArtifactRecord> {
		const identity = normalizeIdentity(input.identity)
		const [row] = await db
			.insert(thinkingBlockArtifacts)
			.values({
				blockName: input.blockName,
				blockVersion: input.blockVersion,
				identityKey: identity,
				input: toJsonValue(input.input),
				status: "pending",
				createdAt: input.createdAt,
				updatedAt: input.createdAt,
			})
			.returning()
		if (!row) throw new Error("failed to create thinking block artifact")
		return toArtifactRecord(row)
	}

	async findArtifactById(input: {
		artifactId: string
	}): Promise<ThinkingBlockArtifactRecord | null> {
		const row = await db.query.thinkingBlockArtifacts.findFirst({
			where: eq(thinkingBlockArtifacts.id, input.artifactId),
		})
		return row ? toArtifactRecord(row) : null
	}

	async findActiveArtifact(input: {
		blockName: string
		blockVersion: string
		identity: ThinkingBlockIdentity
	}): Promise<ThinkingBlockArtifactRecord | null> {
		const identity = normalizeIdentity(input.identity)
		const row = await db.query.thinkingBlockArtifacts.findFirst({
			where: and(
				eq(thinkingBlockArtifacts.blockName, input.blockName),
				eq(thinkingBlockArtifacts.blockVersion, input.blockVersion),
				eq(thinkingBlockArtifacts.identityKey, identity),
				eq(thinkingBlockArtifacts.status, "ready"),
			),
		})
		return row ? toArtifactRecord(row) : null
	}

	async findLatestNonSupersededArtifact(input: {
		blockName: string
		blockVersion: string
		identity: ThinkingBlockIdentity
	}): Promise<ThinkingBlockArtifactRecord | null> {
		const identity = normalizeIdentity(input.identity)
		const row = await db.query.thinkingBlockArtifacts.findFirst({
			where: and(
				eq(thinkingBlockArtifacts.blockName, input.blockName),
				eq(thinkingBlockArtifacts.blockVersion, input.blockVersion),
				eq(thinkingBlockArtifacts.identityKey, identity),
				ne(thinkingBlockArtifacts.status, "superseded"),
			),
			orderBy: desc(thinkingBlockArtifacts.createdAt),
		})
		return row ? toArtifactRecord(row) : null
	}

	async findArtifactStatus(input: {
		blockName: string
		blockVersion: string
		identity: ThinkingBlockIdentity
	}): Promise<ThinkingBlockArtifactStatus | null> {
		const identity = normalizeIdentity(input.identity)
		const row = await db.query.thinkingBlockArtifacts.findFirst({
			columns: { status: true },
			where: and(
				eq(thinkingBlockArtifacts.blockName, input.blockName),
				eq(thinkingBlockArtifacts.blockVersion, input.blockVersion),
				eq(thinkingBlockArtifacts.identityKey, identity),
				ne(thinkingBlockArtifacts.status, "superseded"),
			),
			orderBy: desc(thinkingBlockArtifacts.createdAt),
		})
		return row?.status ?? null
	}

	async claimPendingArtifacts(
		input: ClaimPendingThinkingBlockArtifactsInput,
	): Promise<ThinkingBlockArtifactRecord[]> {
		if (input.limit < 1) return []
		return db.transaction(async (tx) => {
			const candidates = await tx
				.select({ id: thinkingBlockArtifacts.id })
				.from(thinkingBlockArtifacts)
				.where(
					and(
						eq(thinkingBlockArtifacts.blockName, input.blockName),
						eq(thinkingBlockArtifacts.blockVersion, input.blockVersion),
						eq(thinkingBlockArtifacts.status, "pending"),
					),
				)
				.orderBy(
					asc(thinkingBlockArtifacts.updatedAt),
					asc(thinkingBlockArtifacts.createdAt),
				)
				.limit(input.limit)
				.for("update", { skipLocked: true })

			const ids = candidates.map((artifact) => artifact.id)
			if (ids.length === 0) return []

			const rows = await tx
				.update(thinkingBlockArtifacts)
				.set({
					status: "running",
					error: null,
					updatedAt: input.claimedAt,
				})
				.where(inArray(thinkingBlockArtifacts.id, ids))
				.returning()

			return rows.map(toArtifactRecord)
		})
	}

	async requeueRetryableArtifacts(
		input: RequeueRetryableThinkingBlockArtifactsInput,
	): Promise<number> {
		return db.transaction(async (tx) => {
			const conditions = [
				eq(thinkingBlockArtifacts.blockName, input.blockName),
				eq(thinkingBlockArtifacts.blockVersion, input.blockVersion),
				eq(thinkingBlockArtifacts.status, input.status),
				lte(thinkingBlockArtifacts.updatedAt, input.updatedBefore),
			]
			if (input.excludeArtifactIds?.length) {
				conditions.push(
					notInArray(thinkingBlockArtifacts.id, input.excludeArtifactIds),
				)
			}

			const candidates = await tx
				.select({ id: thinkingBlockArtifacts.id })
				.from(thinkingBlockArtifacts)
				.where(and(...conditions))
				.orderBy(
					asc(thinkingBlockArtifacts.updatedAt),
					asc(thinkingBlockArtifacts.createdAt),
				)
				.for("update", { skipLocked: true })

			const candidateIds = candidates.map((artifact) => artifact.id)
			if (candidateIds.length === 0) return 0

			const counts = await tx
				.select({
					artifactId: thinkingBlockRuns.thinkingBlockArtifactId,
					count: sql<number>`count(*)::int`,
				})
				.from(thinkingBlockRuns)
				.where(inArray(thinkingBlockRuns.thinkingBlockArtifactId, candidateIds))
				.groupBy(thinkingBlockRuns.thinkingBlockArtifactId)

			const countByArtifactId = new Map(
				counts.map((row) => [row.artifactId, row.count]),
			)
			const retryableIds = candidateIds.filter(
				(id) => (countByArtifactId.get(id) ?? 0) === input.runCount,
			)
			if (retryableIds.length === 0) return 0

			const rows = await tx
				.update(thinkingBlockArtifacts)
				.set({
					status: "pending",
					error: null,
					updatedAt: input.requeuedAt,
				})
				.where(inArray(thinkingBlockArtifacts.id, retryableIds))
				.returning({ id: thinkingBlockArtifacts.id })

			return rows.length
		})
	}

	async countRuns(input: { artifactId: string }): Promise<number> {
		const [row] = await db
			.select({ count: sql<number>`count(*)::int` })
			.from(thinkingBlockRuns)
			.where(eq(thinkingBlockRuns.thinkingBlockArtifactId, input.artifactId))
		return row?.count ?? 0
	}

	async markArtifactReady(
		input: MarkThinkingBlockArtifactReadyInput,
	): Promise<{ supersededArtifactIds: string[] }> {
		const identity = normalizeIdentity(input.identity)
		return db.transaction(async (tx) => {
			const superseded = await tx
				.update(thinkingBlockArtifacts)
				.set({
					status: "superseded",
					supersededBy: input.artifactId,
					supersededAt: input.readyAt,
					updatedAt: input.readyAt,
				})
				.where(
					and(
						eq(thinkingBlockArtifacts.blockName, input.blockName),
						eq(thinkingBlockArtifacts.blockVersion, input.blockVersion),
						eq(thinkingBlockArtifacts.identityKey, identity),
						eq(thinkingBlockArtifacts.status, "ready"),
						ne(thinkingBlockArtifacts.id, input.artifactId),
					),
				)
				.returning({ id: thinkingBlockArtifacts.id })
			await tx
				.update(thinkingBlockArtifacts)
				.set({
					status: "ready",
					output: toJsonValue(input.output),
					rejection: null,
					error: null,
					readyAt: input.readyAt,
					updatedAt: input.readyAt,
				})
				.where(eq(thinkingBlockArtifacts.id, input.artifactId))
			return {
				supersededArtifactIds: superseded.map((artifact) => artifact.id),
			}
		})
	}

	async markArtifactRejected(
		input: MarkThinkingBlockArtifactRejectedInput,
	): Promise<void> {
		await db
			.update(thinkingBlockArtifacts)
			.set({
				status: "rejected",
				rejection: toJsonValue(input.rejection),
				error: null,
				updatedAt: input.updatedAt,
			})
			.where(eq(thinkingBlockArtifacts.id, input.artifactId))
	}

	async markArtifactFailed(
		input: MarkThinkingBlockArtifactFailedInput,
	): Promise<void> {
		await db
			.update(thinkingBlockArtifacts)
			.set({
				status: "failed",
				error: input.error,
				updatedAt: input.updatedAt,
			})
			.where(eq(thinkingBlockArtifacts.id, input.artifactId))
	}

	async updateArtifactPhase(
		input: UpdateThinkingBlockArtifactPhaseInput,
	): Promise<void> {
		await db
			.update(thinkingBlockArtifacts)
			.set({
				phase: input.phase,
				phaseLabel: input.phaseLabel,
				phaseAt: input.phaseAt,
				updatedAt: input.phaseAt,
			})
			.where(
				and(
					eq(thinkingBlockArtifacts.id, input.artifactId),
					sql`(${thinkingBlockArtifacts.phase} IS DISTINCT FROM ${input.phase} OR ${thinkingBlockArtifacts.phaseLabel} IS DISTINCT FROM ${input.phaseLabel})`,
				),
			)
	}

	async dumpArtifacts(input: {
		blockName: string
		blockVersion: string
		identity: ThinkingBlockIdentity
		dumpedAt: Date
	}): Promise<ThinkingBlockArtifactRecord[]> {
		const identity = normalizeIdentity(input.identity)
		const rows = await db
			.update(thinkingBlockArtifacts)
			.set({
				status: "superseded",
				supersededAt: input.dumpedAt,
				updatedAt: input.dumpedAt,
			})
			.where(
				and(
					eq(thinkingBlockArtifacts.blockName, input.blockName),
					eq(thinkingBlockArtifacts.blockVersion, input.blockVersion),
					eq(thinkingBlockArtifacts.identityKey, identity),
					eq(thinkingBlockArtifacts.status, "ready"),
				),
			)
			.returning()
		return rows.map(toArtifactRecord)
	}

	async listArtifacts(input: {
		blockName: string
		blockVersion: string
		identity: ThinkingBlockIdentity
	}): Promise<ThinkingBlockArtifactRecord[]> {
		const identity = normalizeIdentity(input.identity)
		const rows = await db
			.select()
			.from(thinkingBlockArtifacts)
			.where(
				and(
					eq(thinkingBlockArtifacts.blockName, input.blockName),
					eq(thinkingBlockArtifacts.blockVersion, input.blockVersion),
					eq(thinkingBlockArtifacts.identityKey, identity),
				),
			)
			.orderBy(desc(thinkingBlockArtifacts.createdAt))
		return rows.map(toArtifactRecord)
	}

	async startRun(input: StartThinkingBlockRunInput): Promise<{ id: string }> {
		const [run] = await db
			.insert(thinkingBlockRuns)
			.values({
				thinkingBlockArtifactId: input.artifactId,
				blockName: input.blockName,
				status: "running",
				trigger: input.trigger ?? null,
				metadata: input.metadata,
				startedAt: input.startedAt,
			})
			.returning({ id: thinkingBlockRuns.id })
		if (!run) throw new Error("failed to create thinking block run")
		return run
	}

	async finishRun(input: FinishThinkingBlockRunInput): Promise<void> {
		const metadata = await this.mergedRunMetadata(input.runId, input.metadata)
		await db
			.update(thinkingBlockRuns)
			.set({
				status: "success",
				metadata,
				finishedAt: input.finishedAt,
				durationMs: input.finishedAt.getTime() - input.startedAt.getTime(),
				updatedAt: input.finishedAt,
			})
			.where(eq(thinkingBlockRuns.id, input.runId))
	}

	async rejectRun(input: RejectThinkingBlockRunInput): Promise<void> {
		const metadata = await this.mergedRunMetadata(input.runId, input.metadata)
		await db
			.update(thinkingBlockRuns)
			.set({
				status: "rejected",
				rejectionReason: input.reason,
				rejection: asRecord(input.rejection),
				metadata,
				finishedAt: input.finishedAt,
				durationMs: input.finishedAt.getTime() - input.startedAt.getTime(),
				updatedAt: input.finishedAt,
			})
			.where(eq(thinkingBlockRuns.id, input.runId))
	}

	async failRun(input: FailThinkingBlockRunInput): Promise<void> {
		await db
			.update(thinkingBlockRuns)
			.set({
				status: "failed",
				error: input.error,
				finishedAt: input.finishedAt,
				durationMs: input.finishedAt.getTime() - input.startedAt.getTime(),
				updatedAt: input.finishedAt,
			})
			.where(eq(thinkingBlockRuns.id, input.runId))
	}

	async recordModelCall(
		input: RecordThinkingBlockModelCallInput,
	): Promise<{ id: string }> {
		const [call] = await db
			.insert(thinkingBlockModelCalls)
			.values({
				thinkingBlockRunId: input.runId,
				operationId: input.operationId ?? null,
				attempt: input.attempt,
				stepIndex: input.stepIndex,
				role: input.role,
				blockName: input.blockName,
				provider: input.modelProvider,
				model: input.model,
				responseModel: input.responseModel ?? null,
				status: input.status,
				metadata: input.metadata,
				input: input.input,
				instructions: input.instructions ?? null,
				instructionsHash: input.instructionsHash ?? null,
				output: input.output,
				error: input.error,
				validatorId: input.validatorId ?? null,
				validatorType: input.validatorType ?? null,
			})
			.returning({ id: thinkingBlockModelCalls.id })
		if (!call) throw new Error("failed to record thinking block model call")
		return call
	}

	async recordValidation(
		input: RecordThinkingBlockValidationInput,
	): Promise<void> {
		await db.insert(thinkingBlockValidationResults).values({
			thinkingBlockRunId: input.runId,
			operationId: input.operationId ?? null,
			attempt: input.attempt,
			validatorId: input.validatorId,
			validatorType: input.validatorType,
			status: input.status,
			feedback: toJsonValue(input.feedback),
			metadata: input.metadata ?? {},
		})
	}

	private async mergedRunMetadata(
		runId: string,
		...records: Array<Record<string, unknown> | undefined>
	): Promise<Record<string, unknown>> {
		const row = await db.query.thinkingBlockRuns.findFirst({
			columns: { metadata: true },
			where: eq(thinkingBlockRuns.id, runId),
		})
		return {
			...asRecord(row?.metadata),
			...Object.assign({}, ...records),
		}
	}
}

export const thinkingBlockStore = new DrizzleThinkingBlockStore()

export function toArtifactRecord(
	row: typeof thinkingBlockArtifacts.$inferSelect,
): ThinkingBlockArtifactRecord {
	return {
		id: row.id,
		blockName: row.blockName,
		blockVersion: row.blockVersion,
		identityKey: row.identityKey,
		input: row.input,
		status: row.status,
		output: row.output ?? null,
		rejection: row.rejection ?? null,
		error: row.error ?? null,
		phase: row.phase ?? null,
		phaseLabel: row.phaseLabel ?? null,
		phaseAt: row.phaseAt ?? null,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
		readyAt: row.readyAt ?? null,
		supersededBy: row.supersededBy ?? null,
		supersededAt: row.supersededAt ?? null,
	}
}

function normalizeIdentity(identity: ThinkingBlockIdentity): string {
	if (!identity) throw new Error("ThinkingBlock identity key is required")
	return identity
}

function asRecord(value: unknown): Record<string, unknown> | null {
	const json = toJsonValue(value)
	return json && typeof json === "object" && !Array.isArray(json)
		? (json as Record<string, unknown>)
		: null
}
