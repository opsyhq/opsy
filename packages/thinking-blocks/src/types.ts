import type {
	Agent,
	Output as AiOutput,
	GenerateTextResult,
	ModelMessage,
	ToolSet,
} from "ai"
import type { z } from "zod"

type ThinkingBlockOutputSpec = AiOutput.Output<unknown, unknown, unknown>
export type ThinkingBlockAgentResult = GenerateTextResult<
	ToolSet,
	ThinkingBlockOutputSpec
>
export type ThinkingBlockAgentStep = ThinkingBlockAgentResult["steps"][number]

// biome-ignore lint/suspicious/noExplicitAny: ThinkingBlock erases agent call options and concrete tool sets so ToolLoopAgent instances share one surface.
export type ThinkingBlockAgent = Agent<any, any, ThinkingBlockOutputSpec>

export type ThinkingBlockArtifactStatus =
	| "pending"
	| "running"
	| "ready"
	| "rejected"
	| "failed"
	| "superseded"

type ThinkingBlockModelCallStatus = "success" | "error"
export type ThinkingBlockModelCallRole = "generate" | "judge"
type ThinkingBlockValidationType = "check" | "model"
type ThinkingBlockValidationStatus = "pass" | "fail"

export type ThinkingBlockIdentity = string

export interface ThinkingBlockArtifactRecord {
	id: string
	blockName: string
	blockVersion: string
	identityKey: string
	input: unknown
	status: ThinkingBlockArtifactStatus
	output: unknown | null
	rejection: unknown | null
	error: Record<string, unknown> | null
	phase: string | null
	phaseLabel: string | null
	phaseAt: Date | null
	createdAt: Date
	updatedAt: Date
	readyAt: Date | null
	supersededBy: string | null
	supersededAt: Date | null
}

export type ThinkingBlockResult<OUTPUT> =
	| {
			ok: true
			status: "success"
			source: "generated" | "cached"
			output: OUTPUT
			artifactId: string
			runId?: string
	  }
	| {
			ok: false
			status: "rejected"
			source: "generated"
			artifactId: string
			runId?: string
			reason: string
			output?: unknown
			details?: unknown
	  }

export type ThinkingBlockLookup<OUTPUT> = {
	status: ThinkingBlockArtifactStatus | null
	data: OUTPUT | null
	error: Record<string, unknown> | null
	artifactId: string | null
}

export interface ThinkingBlockRunOptions {
	trigger?: string
	metadata?: Record<string, unknown>
	maxAttempts?: number
	abortSignal?: AbortSignal
}

export type ThinkingBlockGetOptions =
	| (ThinkingBlockRunOptions & { mode?: "wait" })
	| (Omit<ThinkingBlockRunOptions, "maxAttempts" | "abortSignal"> & {
			mode: "cache"
	  })
	| (ThinkingBlockRunOptions & { mode: "background" })

type ThinkingBlockAttemptOptions = { max: number }

export type ThinkingBlockPreparedCall =
	| { prompt: string; messages?: never; options?: unknown }
	| { messages: ModelMessage[]; prompt?: never; options?: unknown }

export type ThinkingBlockValidationResult =
	| { success: true }
	| { success: false; feedback?: unknown }

export interface ThinkingBlockConfig<INPUT, OUTPUT, RESULT = OUTPUT> {
	name: string
	version?: string
	instructions?: string
	agent: ThinkingBlockAgent
	store: ThinkingBlockStore
	parallelism?: number
	input?: z.ZodType<INPUT>
	identity?: (input: INPUT) => ThinkingBlockIdentity
	prepareCall(args: {
		input: INPUT
		attempt: number
		feedback: unknown
	}): ThinkingBlockPreparedCall | Promise<ThinkingBlockPreparedCall>
	attempts?: ThinkingBlockAttemptOptions
	validators?: ThinkingBlockValidation<INPUT, OUTPUT>[]
	metadata?: (input: INPUT) => Record<string, unknown>
	artifact?: ArtifactAdapter<OUTPUT, INPUT, RESULT>
}

export interface ThinkingBlockCheckValidation<INPUT, OUTPUT> {
	type: "check"
	id: string
	validate(args: {
		input: INPUT
		output: OUTPUT
		attempt: number
		raw: ThinkingBlockAgentResult
	}): ThinkingBlockValidationResult | Promise<ThinkingBlockValidationResult>
	metadata?: Record<string, unknown>
}

export interface ThinkingBlockModelValidation<INPUT, OUTPUT, JUDGEMENT> {
	type: "model"
	id: string
	instructions?: string
	agent: ThinkingBlockAgent
	schema: z.ZodType<JUDGEMENT>
	prepareCall(args: {
		input: INPUT
		output: OUTPUT
		attempt: number
	}): ThinkingBlockPreparedCall | Promise<ThinkingBlockPreparedCall>
	validate(args: {
		input: INPUT
		output: OUTPUT
		judgement: JUDGEMENT
		attempt: number
	}): ThinkingBlockValidationResult | Promise<ThinkingBlockValidationResult>
	metadata?: Record<string, unknown>
}

export type ThinkingBlockValidation<INPUT, OUTPUT> =
	| ThinkingBlockCheckValidation<INPUT, OUTPUT>
	| ThinkingBlockModelValidation<INPUT, OUTPUT, unknown>

interface ArtifactReadInput<INPUT> {
	artifactId: string
	input: INPUT
	identity: ThinkingBlockIdentity
	artifact: ThinkingBlockArtifactRecord
}

interface ArtifactCommitInput<INPUT, OUTPUT> {
	input: INPUT
	identity: ThinkingBlockIdentity
	artifactId: string
	runId: string
	output: OUTPUT
	raw: ThinkingBlockAgentResult
}

interface ArtifactCleanupInput<INPUT> {
	input?: INPUT
	identity: ThinkingBlockIdentity
	artifactId: string
}

export interface ArtifactAdapter<OUTPUT, INPUT = unknown, RESULT = OUTPUT> {
	read(args: ArtifactReadInput<INPUT>): Promise<RESULT | null>
	commit(args: ArtifactCommitInput<INPUT, OUTPUT>): Promise<RESULT>
	cleanup(args: ArtifactCleanupInput<INPUT>): Promise<void>
}

export interface CreateThinkingBlockArtifactInput {
	blockName: string
	blockVersion: string
	identity: ThinkingBlockIdentity
	input: unknown
	createdAt: Date
}

export interface MarkThinkingBlockArtifactReadyInput {
	artifactId: string
	blockName: string
	blockVersion: string
	identity: ThinkingBlockIdentity
	output: unknown
	readyAt: Date
}

export interface MarkThinkingBlockArtifactRejectedInput {
	artifactId: string
	rejection: unknown
	updatedAt: Date
}

export interface MarkThinkingBlockArtifactFailedInput {
	artifactId: string
	error: Record<string, unknown>
	updatedAt: Date
}

export interface UpdateThinkingBlockArtifactPhaseInput {
	artifactId: string
	phase: string
	phaseLabel: string
	phaseAt: Date
}

export interface ClaimPendingThinkingBlockArtifactsInput {
	blockName: string
	blockVersion: string
	limit: number
	claimedAt: Date
}

export interface RequeueRetryableThinkingBlockArtifactsInput {
	blockName: string
	blockVersion: string
	status: Extract<ThinkingBlockArtifactStatus, "failed">
	runCount: number
	updatedBefore: Date
	requeuedAt: Date
	excludeArtifactIds?: string[]
}

export interface StartThinkingBlockRunInput {
	artifactId: string
	blockName: string
	trigger?: string | null
	metadata: Record<string, unknown>
	startedAt: Date
}

export interface FinishThinkingBlockRunInput {
	runId: string
	metadata: Record<string, unknown>
	startedAt: Date
	finishedAt: Date
}

export interface RejectThinkingBlockRunInput {
	runId: string
	reason: string
	rejection?: unknown
	metadata: Record<string, unknown>
	startedAt: Date
	finishedAt: Date
}

export interface FailThinkingBlockRunInput {
	runId: string
	error: Record<string, unknown>
	startedAt: Date
	finishedAt: Date
}

export interface RecordThinkingBlockModelCallInput {
	runId: string
	operationId?: string | null
	attempt: number
	stepIndex: number
	role: ThinkingBlockModelCallRole
	blockName: string
	modelProvider: string
	model: string
	responseModel?: string | null
	status: ThinkingBlockModelCallStatus
	metadata: Record<string, unknown>
	input: Record<string, unknown>
	instructions?: string | null
	instructionsHash?: string | null
	output?: Record<string, unknown>
	error?: Record<string, unknown>
	validatorId?: string | null
	validatorType?: ThinkingBlockValidationType | null
}

export interface RecordThinkingBlockValidationInput {
	runId: string
	operationId?: string | null
	attempt: number
	validatorId: string
	validatorType: ThinkingBlockValidationType
	status: ThinkingBlockValidationStatus
	feedback?: unknown
	metadata?: Record<string, unknown>
}

export interface ThinkingBlockStore {
	createArtifact(
		input: CreateThinkingBlockArtifactInput,
	): Promise<ThinkingBlockArtifactRecord>
	findArtifactById(input: {
		artifactId: string
	}): Promise<ThinkingBlockArtifactRecord | null>
	findActiveArtifact(input: {
		blockName: string
		blockVersion: string
		identity: ThinkingBlockIdentity
	}): Promise<ThinkingBlockArtifactRecord | null>
	findLatestNonSupersededArtifact(input: {
		blockName: string
		blockVersion: string
		identity: ThinkingBlockIdentity
	}): Promise<ThinkingBlockArtifactRecord | null>
	findArtifactStatus(input: {
		blockName: string
		blockVersion: string
		identity: ThinkingBlockIdentity
	}): Promise<ThinkingBlockArtifactStatus | null>
	claimPendingArtifacts(
		input: ClaimPendingThinkingBlockArtifactsInput,
	): Promise<ThinkingBlockArtifactRecord[]>
	requeueRetryableArtifacts(
		input: RequeueRetryableThinkingBlockArtifactsInput,
	): Promise<number>
	countRuns(input: { artifactId: string }): Promise<number>
	markArtifactReady(
		input: MarkThinkingBlockArtifactReadyInput,
	): Promise<{ supersededArtifactIds: string[] }>
	markArtifactRejected(
		input: MarkThinkingBlockArtifactRejectedInput,
	): Promise<void>
	markArtifactFailed(input: MarkThinkingBlockArtifactFailedInput): Promise<void>
	updateArtifactPhase(input: UpdateThinkingBlockArtifactPhaseInput): Promise<void>
	dumpArtifacts(input: {
		blockName: string
		blockVersion: string
		identity: ThinkingBlockIdentity
		dumpedAt: Date
	}): Promise<ThinkingBlockArtifactRecord[]>
	listArtifacts(input: {
		blockName: string
		blockVersion: string
		identity: ThinkingBlockIdentity
	}): Promise<ThinkingBlockArtifactRecord[]>
	startRun(input: StartThinkingBlockRunInput): Promise<{ id: string }>
	finishRun(input: FinishThinkingBlockRunInput): Promise<void>
	rejectRun(input: RejectThinkingBlockRunInput): Promise<void>
	failRun(input: FailThinkingBlockRunInput): Promise<void>
	recordModelCall(
		input: RecordThinkingBlockModelCallInput,
	): Promise<{ id?: string } | undefined>
	recordValidation(input: RecordThinkingBlockValidationInput): Promise<void>
}
