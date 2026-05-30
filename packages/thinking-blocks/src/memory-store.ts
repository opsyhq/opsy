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
	ThinkingBlockIdentity,
	ThinkingBlockStore,
} from "./types"

export class InMemoryThinkingBlockStore implements ThinkingBlockStore {
	artifacts: ThinkingBlockArtifactRecord[] = []
	runs: Array<
		StartThinkingBlockRunInput & {
			id: string
			status: string
			finishedAt?: Date
			error?: Record<string, unknown>
			rejectionReason?: string
			rejection?: unknown
			finish?: FinishThinkingBlockRunInput
		}
	> = []
	modelCalls: Array<RecordThinkingBlockModelCallInput & { id: string }> = []
	validations: RecordThinkingBlockValidationInput[] = []
	phases: UpdateThinkingBlockArtifactPhaseInput[] = []

	async createArtifact(
		input: CreateThinkingBlockArtifactInput,
	): Promise<ThinkingBlockArtifactRecord> {
		const identityKey = normalizedIdentity(input.identity)
		const artifact: ThinkingBlockArtifactRecord = {
			id: crypto.randomUUID(),
			blockName: input.blockName,
			blockVersion: input.blockVersion,
			identityKey,
			input: input.input,
			status: "pending",
			output: null,
			rejection: null,
			error: null,
			phase: null,
			phaseLabel: null,
			phaseAt: null,
			createdAt: input.createdAt,
			updatedAt: input.createdAt,
			readyAt: null,
			supersededBy: null,
			supersededAt: null,
		}
		this.artifacts.push(artifact)
		return { ...artifact }
	}

	async findArtifactById(input: {
		artifactId: string
	}): Promise<ThinkingBlockArtifactRecord | null> {
		const artifact =
			this.artifacts.find((candidate) => candidate.id === input.artifactId) ??
			null
		return artifact ? { ...artifact } : null
	}

	async findActiveArtifact(input: {
		blockName: string
		blockVersion: string
		identity: ThinkingBlockIdentity
	}): Promise<ThinkingBlockArtifactRecord | null> {
		const identityKey = normalizedIdentity(input.identity)
		const artifact =
			this.artifacts.find(
				(artifact) =>
					artifact.blockName === input.blockName &&
					artifact.blockVersion === input.blockVersion &&
					artifact.identityKey === identityKey &&
					artifact.status === "ready",
			) ?? null
		return artifact ? { ...artifact } : null
	}

	async findLatestNonSupersededArtifact(input: {
		blockName: string
		blockVersion: string
		identity: ThinkingBlockIdentity
	}): Promise<ThinkingBlockArtifactRecord | null> {
		const identityKey = normalizedIdentity(input.identity)
		const artifact =
			this.artifacts
				.filter(
					(artifact) =>
						artifact.blockName === input.blockName &&
						artifact.blockVersion === input.blockVersion &&
						artifact.identityKey === identityKey &&
						artifact.status !== "superseded",
				)
				.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0] ??
			null
		return artifact ? { ...artifact } : null
	}

	async findArtifactStatus(input: {
		blockName: string
		blockVersion: string
		identity: ThinkingBlockIdentity
	}) {
		const identityKey = normalizedIdentity(input.identity)
		return (
			this.artifacts
				.filter(
					(artifact) =>
						artifact.blockName === input.blockName &&
						artifact.blockVersion === input.blockVersion &&
						artifact.identityKey === identityKey &&
						artifact.status !== "superseded",
				)
				.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0]
				?.status ?? null
		)
	}

	async claimPendingArtifacts(
		input: ClaimPendingThinkingBlockArtifactsInput,
	): Promise<ThinkingBlockArtifactRecord[]> {
		if (input.limit < 1) return []
		const claimed = this.artifacts
			.filter(
				(artifact) =>
					artifact.blockName === input.blockName &&
					artifact.blockVersion === input.blockVersion &&
					artifact.status === "pending",
			)
			.sort(
				(a, b) =>
					a.updatedAt.getTime() - b.updatedAt.getTime() ||
					a.createdAt.getTime() - b.createdAt.getTime(),
			)
			.slice(0, input.limit)
		for (const artifact of claimed) {
			artifact.status = "running"
			artifact.updatedAt = input.claimedAt
			artifact.error = null
		}
		return claimed.map((artifact) => ({ ...artifact }))
	}

	async requeueRetryableArtifacts(
		input: RequeueRetryableThinkingBlockArtifactsInput,
	): Promise<number> {
		const excluded = new Set(input.excludeArtifactIds ?? [])
		let requeued = 0
		for (const artifact of this.artifacts
			.filter(
				(artifact) =>
					artifact.blockName === input.blockName &&
					artifact.blockVersion === input.blockVersion &&
					artifact.status === input.status &&
					!excluded.has(artifact.id) &&
					artifact.updatedAt.getTime() <= input.updatedBefore.getTime() &&
					this.countRunsSync(artifact.id) === input.runCount,
			)
			.sort(
				(a, b) =>
					a.updatedAt.getTime() - b.updatedAt.getTime() ||
					a.createdAt.getTime() - b.createdAt.getTime(),
			)) {
			artifact.status = "pending"
			artifact.updatedAt = input.requeuedAt
			artifact.error = null
			requeued += 1
		}
		return requeued
	}

	async countRuns(input: { artifactId: string }): Promise<number> {
		return this.countRunsSync(input.artifactId)
	}

	async markArtifactReady(
		input: MarkThinkingBlockArtifactReadyInput,
	): Promise<{ supersededArtifactIds: string[] }> {
		const identityKey = normalizedIdentity(input.identity)
		const supersededArtifactIds: string[] = []
		for (const artifact of this.artifacts) {
			if (
				artifact.id !== input.artifactId &&
				artifact.blockName === input.blockName &&
				artifact.blockVersion === input.blockVersion &&
				artifact.identityKey === identityKey &&
				artifact.status === "ready"
			) {
				artifact.status = "superseded"
				artifact.supersededBy = input.artifactId
				artifact.supersededAt = input.readyAt
				artifact.updatedAt = input.readyAt
				supersededArtifactIds.push(artifact.id)
			}
		}
		const artifact = this.requireArtifact(input.artifactId)
		artifact.status = "ready"
		artifact.output = input.output
		artifact.rejection = null
		artifact.error = null
		artifact.readyAt = input.readyAt
		artifact.updatedAt = input.readyAt
		return { supersededArtifactIds }
	}

	async markArtifactRejected(
		input: MarkThinkingBlockArtifactRejectedInput,
	): Promise<void> {
		const artifact = this.requireArtifact(input.artifactId)
		artifact.status = "rejected"
		artifact.rejection = input.rejection
		artifact.error = null
		artifact.updatedAt = input.updatedAt
	}

	async markArtifactFailed(
		input: MarkThinkingBlockArtifactFailedInput,
	): Promise<void> {
		const artifact = this.requireArtifact(input.artifactId)
		artifact.status = "failed"
		artifact.error = input.error
		artifact.updatedAt = input.updatedAt
	}

	async updateArtifactPhase(
		input: UpdateThinkingBlockArtifactPhaseInput,
	): Promise<void> {
		const artifact = this.requireArtifact(input.artifactId)
		if (
			artifact.phase === input.phase &&
			artifact.phaseLabel === input.phaseLabel
		)
			return
		this.phases.push(input)
		artifact.phase = input.phase
		artifact.phaseLabel = input.phaseLabel
		artifact.phaseAt = input.phaseAt
		artifact.updatedAt = input.phaseAt
	}

	async dumpArtifacts(input: {
		blockName: string
		blockVersion: string
		identity: ThinkingBlockIdentity
		dumpedAt: Date
	}): Promise<ThinkingBlockArtifactRecord[]> {
		const identityKey = normalizedIdentity(input.identity)
		const dumped: ThinkingBlockArtifactRecord[] = []
		for (const artifact of this.artifacts) {
			if (
				artifact.blockName === input.blockName &&
				artifact.blockVersion === input.blockVersion &&
				artifact.identityKey === identityKey &&
				artifact.status === "ready"
			) {
				artifact.status = "superseded"
				artifact.supersededAt = input.dumpedAt
				artifact.updatedAt = input.dumpedAt
				dumped.push({ ...artifact })
			}
		}
		return dumped
	}

	async listArtifacts(input: {
		blockName: string
		blockVersion: string
		identity: ThinkingBlockIdentity
	}): Promise<ThinkingBlockArtifactRecord[]> {
		const identityKey = normalizedIdentity(input.identity)
		return this.artifacts
			.filter(
				(artifact) =>
					artifact.blockName === input.blockName &&
					artifact.blockVersion === input.blockVersion &&
					artifact.identityKey === identityKey,
			)
			.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
			.map((artifact) => ({ ...artifact }))
	}

	async startRun(input: StartThinkingBlockRunInput): Promise<{ id: string }> {
		const id = crypto.randomUUID()
		this.runs.push({ ...input, id, status: "running" })
		return { id }
	}

	async finishRun(input: FinishThinkingBlockRunInput): Promise<void> {
		const run = this.requireRun(input.runId)
		run.status = "success"
		run.finishedAt = input.finishedAt
		run.finish = input
	}

	async rejectRun(input: RejectThinkingBlockRunInput): Promise<void> {
		const run = this.requireRun(input.runId)
		run.status = "rejected"
		run.finishedAt = input.finishedAt
		run.rejectionReason = input.reason
		run.rejection = input.rejection
	}

	async failRun(input: FailThinkingBlockRunInput): Promise<void> {
		const run = this.requireRun(input.runId)
		run.status = "failed"
		run.finishedAt = input.finishedAt
		run.error = input.error
	}

	async recordModelCall(
		input: RecordThinkingBlockModelCallInput,
	): Promise<{ id: string }> {
		const id = crypto.randomUUID()
		this.modelCalls.push({ ...input, id })
		return { id }
	}

	async recordValidation(
		input: RecordThinkingBlockValidationInput,
	): Promise<void> {
		this.validations.push(input)
	}

	private requireArtifact(id: string) {
		const artifact = this.artifacts.find((candidate) => candidate.id === id)
		if (!artifact) throw new Error(`unknown thinking block artifact: ${id}`)
		return artifact
	}

	private requireRun(id: string) {
		const run = this.runs.find((candidate) => candidate.id === id)
		if (!run) throw new Error(`unknown thinking block run: ${id}`)
		return run
	}

	private countRunsSync(artifactId: string): number {
		return this.runs.filter((run) => run.artifactId === artifactId).length
	}
}

function normalizedIdentity(identity: ThinkingBlockIdentity): string {
	if (!identity) throw new Error("ThinkingBlock identity key is required")
	return identity
}
