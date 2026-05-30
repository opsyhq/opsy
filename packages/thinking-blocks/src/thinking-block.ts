import type { z } from "zod"
import { thinkingBlockInputHash } from "./hash"
import { serializeError, toJsonRecord, toJsonValue } from "./json"
import type {
	ArtifactAdapter,
	ThinkingBlockAgent,
	ThinkingBlockAgentResult,
	ThinkingBlockAgentStep,
	ThinkingBlockArtifactRecord,
	ThinkingBlockCheckValidation,
	ThinkingBlockConfig,
	ThinkingBlockGetOptions,
	ThinkingBlockIdentity,
	ThinkingBlockLookup,
	ThinkingBlockModelCallRole,
	ThinkingBlockModelValidation,
	ThinkingBlockPreparedCall,
	ThinkingBlockResult,
	ThinkingBlockRunOptions,
	ThinkingBlockStore,
	ThinkingBlockValidation,
	ThinkingBlockValidationResult,
} from "./types"

interface ThinkingBlockBindings<OUTPUT, INPUT = unknown, RESULT = OUTPUT> {
	store: ThinkingBlockStore
	artifact: ArtifactAdapter<OUTPUT, INPUT, RESULT>
}

type AttemptOutcome<OUTPUT> =
	| {
			ok: true
			output: OUTPUT
			raw: ThinkingBlockAgentResult
	  }
	| {
			ok: false
			lastOutput?: OUTPUT
			feedback: unknown
			attempts: Array<{ attempt: number; ok: boolean; feedback?: unknown }>
	  }

type PhaseEvent =
	| { kind: "attempt_started"; attempt: number }
	| { kind: "step_finished"; attempt: number; step: ThinkingBlockAgentStep }
	| { kind: "validator_started"; attempt: number; validator: string }
	| {
			kind: "validator_finished"
			attempt: number
			validator: string
			success: boolean
	  }

type RejectionRecord<OUTPUT> = {
	reason: string
	output?: OUTPUT
	details?: unknown
}

type QueuedRunOptions = Pick<
	ThinkingBlockRunOptions,
	"trigger" | "metadata" | "maxAttempts" | "abortSignal"
>

type ArtifactCompletion<RESULT> = {
	promise: Promise<ThinkingBlockResult<RESULT>>
	resolve: (result: ThinkingBlockResult<RESULT>) => void
	reject: (err: unknown) => void
	settled: boolean
}

type ThinkingBlockRunnerRegistry = Map<string, ThinkingBlock<unknown, unknown>>

const DEFAULT_PARALLELISM = 1
const DEFAULT_BLOCK_VERSION = "v1"
const RUNNER_POLL_MS = 1000
const WAITER_INITIAL_DELAY_MS = 10
const WAITER_MAX_DELAY_MS = 250
const DEFAULT_ATTEMPTS = 3
const MAX_OPERATIONAL_RUNS = 3
const FAILED_RETRY_BACKOFF_MS = [0, 50, 250]
const COMPLETION_CACHE_MS = 1000
const TERMINAL_COMPLETION_GRACE_MS = 25

export function check<INPUT, OUTPUT>(
	id: string,
	options: Omit<ThinkingBlockCheckValidation<INPUT, OUTPUT>, "id" | "type">,
): ThinkingBlockCheckValidation<INPUT, OUTPUT> {
	return { type: "check", id, ...options }
}

export function judge<INPUT, OUTPUT, JUDGEMENT>(
	id: string,
	options: Omit<
		ThinkingBlockModelValidation<INPUT, OUTPUT, JUDGEMENT>,
		"id" | "type"
	>,
): ThinkingBlockModelValidation<INPUT, OUTPUT, JUDGEMENT> {
	return { type: "model", id, ...options }
}

function jsonArtifact<OUTPUT, INPUT = unknown>(): ArtifactAdapter<
	OUTPUT,
	INPUT,
	OUTPUT
> {
	return {
		async read({ artifact }) {
			return artifact.output === null || artifact.output === undefined
				? null
				: (artifact.output as OUTPUT)
		},
		async commit({ output }) {
			return output
		},
		async cleanup() {},
	}
}

export class ThinkingBlock<INPUT, OUTPUT, RESULT = OUTPUT> {
	readonly name: string
	readonly version: string
	private readonly instructions?: string
	private readonly agent: ThinkingBlockAgent
	private readonly inputSchema?: z.ZodType<INPUT>
	private readonly identity?: (input: INPUT) => ThinkingBlockIdentity
	private readonly prepareCall: (args: {
		input: INPUT
		attempt: number
		feedback: unknown
	}) => ThinkingBlockPreparedCall | Promise<ThinkingBlockPreparedCall>
	private readonly attempts?: { max: number }
	private readonly validators?: ThinkingBlockValidation<INPUT, OUTPUT>[]
	private readonly metadata?: (input: INPUT) => Record<string, unknown>
	private readonly options: ThinkingBlockBindings<OUTPUT, INPUT, RESULT>
	private readonly parallelism: number
	private readonly activeArtifacts = new Set<string>()
	private readonly queuedRunOptions = new Map<string, QueuedRunOptions>()
	private readonly queuedInputs = new Map<
		string,
		{ input: INPUT; identity: ThinkingBlockIdentity }
	>()
	private readonly completions = new Map<string, ArtifactCompletion<RESULT>>()
	private runnerTimer: ReturnType<typeof setTimeout> | null = null
	private runnerTickPromise: Promise<void> | null = null
	private stopped = false

	constructor(config: ThinkingBlockConfig<INPUT, OUTPUT, RESULT>) {
		this.agent = config.agent
		this.instructions = config.instructions
		this.inputSchema = config.input
		this.identity = config.identity
		this.prepareCall = config.prepareCall
		this.attempts = config.attempts
		this.validators = config.validators
		this.metadata = config.metadata
		this.options = {
			store: config.store,
			artifact:
				config.artifact ??
				(jsonArtifact<OUTPUT, INPUT>() as unknown as ArtifactAdapter<
					OUTPUT,
					INPUT,
					RESULT
				>),
		}
		this.name = config.name
		if (!this.name) throw new Error("ThinkingBlock name is required")
		this.version = config.version ?? DEFAULT_BLOCK_VERSION
		if (!this.version) throw new Error("ThinkingBlock version is required")
		this.parallelism = normalizeParallelism(
			config.parallelism ?? DEFAULT_PARALLELISM,
		)
		this.replaceRegisteredRunner()
		this.wakeRunner()
	}

	stop(): void {
		this.stopped = true
		if (this.runnerTimer) {
			clearTimeout(this.runnerTimer)
			this.runnerTimer = null
		}
		const registered = thinkingBlockRunnerRegistry().get(this.registryKey)
		if (registered === this) {
			thinkingBlockRunnerRegistry().delete(this.registryKey)
		}
	}

	private get registryKey(): string {
		return `${this.name}:${this.version}`
	}

	private replaceRegisteredRunner(): void {
		const registry = thinkingBlockRunnerRegistry()
		const previous = registry.get(this.registryKey)
		if (previous && previous !== this) previous.stop()
		registry.set(
			this.registryKey,
			this as unknown as ThinkingBlock<unknown, unknown>,
		)
	}

	async get(
		rawInput: INPUT,
		options?: ThinkingBlockRunOptions & { mode?: "wait" },
	): Promise<ThinkingBlockResult<RESULT>>
	async get(
		rawInput: INPUT,
		options: Extract<ThinkingBlockGetOptions, { mode: "cache" }>,
	): Promise<ThinkingBlockLookup<RESULT>>
	async get(
		rawInput: INPUT,
		options: Extract<ThinkingBlockGetOptions, { mode: "background" }>,
	): Promise<ThinkingBlockLookup<RESULT>>
	async get(
		rawInput: INPUT,
		options: ThinkingBlockGetOptions = {},
	): Promise<ThinkingBlockResult<RESULT> | ThinkingBlockLookup<RESULT>> {
		const input = this.parseInput(rawInput)
		const identity = this.resolveIdentity(input)
		if (options.mode === "cache") {
			return this.lookupLatest(input, identity)
		}
		if (options.mode === "background") {
			return this.lookupOrQueueBackground(input, identity, options)
		}
		const artifact = await this.options.store.findActiveArtifact({
			blockName: this.name,
			blockVersion: this.version,
			identity,
		})
		const cached = artifact
			? await this.readArtifactResult(input, identity, artifact)
			: null
		if (cached) {
			return cached
		}
		const latest = await this.options.store.findLatestNonSupersededArtifact({
			blockName: this.name,
			blockVersion: this.version,
			identity,
		})
		const queued =
			latest && latest.status !== "ready"
				? latest
				: await this.createArtifact(input, identity)
		this.rememberArtifactInput(queued.id, input, identity)
		this.rememberRunOptions(queued.id, options)
		this.wakeRunner()
		return this.waitForTerminalArtifact({
			input,
			identity,
			artifactId: queued.id,
			abortSignal: options.abortSignal,
		})
	}

	async getMany(
		rawInputs: INPUT[],
		options?: ThinkingBlockRunOptions & { mode?: "wait" },
	): Promise<ThinkingBlockResult<RESULT>[]>
	async getMany(
		rawInputs: INPUT[],
		options: Extract<ThinkingBlockGetOptions, { mode: "cache" }>,
	): Promise<ThinkingBlockLookup<RESULT>[]>
	async getMany(
		rawInputs: INPUT[],
		options: Extract<ThinkingBlockGetOptions, { mode: "background" }>,
	): Promise<ThinkingBlockLookup<RESULT>[]>
	async getMany(
		rawInputs: INPUT[],
		options: ThinkingBlockGetOptions = {},
	): Promise<Array<ThinkingBlockResult<RESULT> | ThinkingBlockLookup<RESULT>>> {
		// Dedupe by resolved identity so repeated identities issue one get and
		// share its promise; the returned array stays aligned with rawInputs.
		const byIdentity = new Map<
			ThinkingBlockIdentity,
			Promise<ThinkingBlockResult<RESULT> | ThinkingBlockLookup<RESULT>>
		>()
		return Promise.all(
			rawInputs.map((rawInput) => {
				const input = this.parseInput(rawInput)
				const identity = this.resolveIdentity(input)
				let pending = byIdentity.get(identity)
				if (!pending) {
					pending = this.get(
						input,
						options as Extract<ThinkingBlockGetOptions, { mode: "background" }>,
					)
					byIdentity.set(identity, pending)
				}
				return pending
			}),
		)
	}

	async generate(
		rawInput: INPUT,
		options: ThinkingBlockRunOptions = {},
	): Promise<ThinkingBlockResult<RESULT>> {
		const input = this.parseInput(rawInput)
		const identity = this.resolveIdentity(input)
		const latest = await this.options.store.findLatestNonSupersededArtifact({
			blockName: this.name,
			blockVersion: this.version,
			identity,
		})
		const artifact =
			latest &&
			(latest.status === "pending" ||
				latest.status === "running" ||
				(latest.status === "failed" && (await this.isRetryableFailed(latest))))
				? latest
				: await this.createArtifact(input, identity)
		this.rememberArtifactInput(artifact.id, input, identity)
		this.rememberRunOptions(artifact.id, options)
		this.wakeRunner()
		return this.waitForTerminalArtifact({
			input,
			identity,
			artifactId: artifact.id,
			abortSignal: options.abortSignal,
		})
	}

	private async projectLookup(
		input: INPUT,
		identity: ThinkingBlockIdentity,
		artifact: ThinkingBlockArtifactRecord,
	): Promise<ThinkingBlockLookup<RESULT>> {
		const ready =
			artifact.status === "ready"
				? await this.readArtifactResult(input, identity, artifact)
				: null
		return {
			status: artifact.status,
			data: ready?.output ?? null,
			error: artifact.error,
			artifactId: artifact.id,
		}
	}

	private async lookupLatest(
		input: INPUT,
		identity: ThinkingBlockIdentity,
	): Promise<ThinkingBlockLookup<RESULT>> {
		const artifact = await this.options.store.findLatestNonSupersededArtifact({
			blockName: this.name,
			blockVersion: this.version,
			identity,
		})
		if (!artifact) {
			return { status: null, data: null, error: null, artifactId: null }
		}
		return this.projectLookup(input, identity, artifact)
	}

	private async lookupOrQueueBackground(
		input: INPUT,
		identity: ThinkingBlockIdentity,
		options: ThinkingBlockRunOptions,
	): Promise<ThinkingBlockLookup<RESULT>> {
		const latest = await this.options.store.findLatestNonSupersededArtifact({
			blockName: this.name,
			blockVersion: this.version,
			identity,
		})
		if (latest) {
			this.rememberArtifactInput(latest.id, input, identity)
			this.rememberRunOptions(latest.id, options)
			const artifact = await this.backgroundArtifactStatus(latest)
			if (artifact.status === "pending" || artifact.status === "running") {
				this.wakeRunner()
			}
			return this.projectLookup(input, identity, artifact)
		}

		const artifact = await this.createArtifact(input, identity)
		this.rememberArtifactInput(artifact.id, input, identity)
		this.rememberRunOptions(artifact.id, options)
		this.wakeRunner()
		return this.projectLookup(input, identity, artifact)
	}

	private async readArtifactResult(
		input: INPUT,
		identity: ThinkingBlockIdentity,
		artifact: ThinkingBlockArtifactRecord,
		source: "cached" | "generated" = "cached",
	): Promise<Extract<ThinkingBlockResult<RESULT>, { ok: true }> | null> {
		const output = await this.options.artifact.read({
			artifactId: artifact.id,
			input,
			identity,
			artifact,
		})
		if (output === null) return null
		return {
			ok: true,
			status: "success",
			source,
			output,
			artifactId: artifact.id,
		}
	}

	private async createArtifact(
		input: INPUT,
		identity: ThinkingBlockIdentity,
	): Promise<ThinkingBlockArtifactRecord> {
		return this.options.store.createArtifact({
			blockName: this.name,
			blockVersion: this.version,
			identity,
			input: toJsonValue(input),
			createdAt: new Date(),
		})
	}

	private rememberArtifactInput(
		artifactId: string,
		input: INPUT,
		identity: ThinkingBlockIdentity,
	): void {
		this.queuedInputs.set(artifactId, { input, identity })
	}

	private rememberRunOptions(
		artifactId: string,
		options: ThinkingBlockRunOptions,
	): void {
		const existing = this.queuedRunOptions.get(artifactId)
		const abortSignal = selectQueuedAbortSignal(
			existing?.abortSignal,
			options.abortSignal,
		)
		this.queuedRunOptions.set(artifactId, {
			trigger: existing?.trigger ?? options.trigger,
			metadata: {
				...(existing?.metadata ?? {}),
				...(options.metadata ?? {}),
			},
			maxAttempts: options.maxAttempts ?? existing?.maxAttempts,
			abortSignal,
		})
	}

	private async backgroundArtifactStatus(
		artifact: ThinkingBlockArtifactRecord,
	): Promise<ThinkingBlockArtifactRecord> {
		if (artifact.status !== "failed") return artifact
		if (!(await this.isRetryableFailed(artifact))) return artifact
		return { ...artifact, status: "pending", error: null }
	}

	private async isRetryableFailed(
		artifact: ThinkingBlockArtifactRecord,
	): Promise<boolean> {
		if (artifact.status !== "failed") return false
		const runs = await this.options.store.countRuns({ artifactId: artifact.id })
		return runs < MAX_OPERATIONAL_RUNS
	}

	private async waitForTerminalArtifact(input: {
		input: INPUT
		identity: ThinkingBlockIdentity
		artifactId: string
		abortSignal?: AbortSignal
	}): Promise<ThinkingBlockResult<RESULT>> {
		const completion = this.completionFor(input.artifactId)
		let delayMs = WAITER_INITIAL_DELAY_MS
		try {
			for (;;) {
				throwIfAborted(input.abortSignal)
				const artifact = await this.options.store.findArtifactById({
					artifactId: input.artifactId,
				})
				if (!artifact) {
					throw new Error(
						`unknown thinking block artifact: ${input.artifactId}`,
					)
				}
				const terminal = await this.resultForTerminalArtifact({
					input: input.input,
					identity: input.identity,
					artifact,
				})
				if (terminal) return terminal
				this.wakeRunner()
				const waited = await Promise.race([
					completion.promise.then(
						(result) => ({ kind: "complete" as const, result }),
						(err) => ({ kind: "error" as const, err }),
					),
					sleep(delayMs, input.abortSignal).then(() => ({
						kind: "sleep" as const,
					})),
				])
				if (waited.kind === "complete") return waited.result
				if (waited.kind === "error") throw waited.err
				delayMs = Math.min(WAITER_MAX_DELAY_MS, Math.ceil(delayMs * 1.5))
			}
		} finally {
			if (!completion.settled) this.completions.delete(input.artifactId)
		}
	}

	private async resultForTerminalArtifact(input: {
		input: INPUT
		identity: ThinkingBlockIdentity
		artifact: ThinkingBlockArtifactRecord
	}): Promise<ThinkingBlockResult<RESULT> | null> {
		if (
			input.artifact.status === "ready" ||
			input.artifact.status === "rejected"
		) {
			const local = await this.localTerminalCompletion(input.artifact.id)
			if (local) return local
		}
		if (input.artifact.status === "ready") {
			const result = await this.readArtifactResult(
				input.input,
				input.identity,
				input.artifact,
				"generated",
			)
			if (!result) {
				throw new Error(
					`thinking block artifact ${input.artifact.id} is ready but could not be read`,
				)
			}
			return result
		}
		if (input.artifact.status === "rejected") {
			return this.rejectedArtifactResult(input.artifact)
		}
		if (input.artifact.status === "failed") {
			const retryable = await this.isRetryableFailed(input.artifact)
			if (!retryable) throw this.failedArtifactError(input.artifact)
		}
		if (input.artifact.status === "superseded") {
			throw new Error(
				`thinking block artifact ${input.artifact.id} was superseded`,
			)
		}
		return null
	}

	private async localTerminalCompletion(
		artifactId: string,
	): Promise<ThinkingBlockResult<RESULT> | null> {
		const completion = this.completions.get(artifactId)
		if (!completion) return null
		if (completion.settled) return completion.promise
		const result = await Promise.race([
			completion.promise.then(
				(value) => ({ kind: "complete" as const, value }),
				(err) => ({ kind: "error" as const, err }),
			),
			sleep(TERMINAL_COMPLETION_GRACE_MS).then(() => ({
				kind: "timeout" as const,
			})),
		])
		if (result.kind === "complete") return result.value
		if (result.kind === "error") throw result.err
		return null
	}

	private rejectedArtifactResult(
		artifact: ThinkingBlockArtifactRecord,
	): ThinkingBlockResult<RESULT> {
		const rejection = readRejectionRecord<OUTPUT>(artifact.rejection)
		return {
			ok: false,
			status: "rejected",
			source: "generated",
			artifactId: artifact.id,
			reason: rejection.reason,
			output: rejection.output,
			details: rejection.details,
		}
	}

	private failedArtifactError(artifact: ThinkingBlockArtifactRecord): Error {
		const message =
			typeof artifact.error?.message === "string"
				? artifact.error.message
				: `thinking block artifact ${artifact.id} failed`
		return new Error(message)
	}

	private completionFor(artifactId: string): ArtifactCompletion<RESULT> {
		const existing = this.completions.get(artifactId)
		if (existing) return existing
		let resolve!: (result: ThinkingBlockResult<RESULT>) => void
		let reject!: (err: unknown) => void
		const promise = new Promise<ThinkingBlockResult<RESULT>>((res, rej) => {
			resolve = res
			reject = rej
		})
		const completion = { promise, resolve, reject, settled: false }
		this.completions.set(artifactId, completion)
		return completion
	}

	private resolveCompletion(
		artifactId: string,
		result: ThinkingBlockResult<RESULT>,
	): void {
		const completion = this.completions.get(artifactId)
		if (!completion) return
		completion.settled = true
		completion.resolve(result)
		this.expireCompletion(artifactId)
	}

	private rejectCompletion(artifactId: string, err: unknown): void {
		const completion = this.completions.get(artifactId)
		if (!completion) return
		completion.settled = true
		completion.reject(err)
		this.expireCompletion(artifactId)
	}

	private expireCompletion(artifactId: string): void {
		const timer = setTimeout(() => {
			this.completions.delete(artifactId)
		}, COMPLETION_CACHE_MS)
		unrefTimer(timer)
	}

	private async generateOnArtifact(input: {
		input: INPUT
		identity: ThinkingBlockIdentity
		artifactId: string
		options: ThinkingBlockRunOptions
		metadata: Record<string, unknown>
		startedAt: Date
	}): Promise<ThinkingBlockResult<RESULT>> {
		const run = await this.options.store.startRun({
			artifactId: input.artifactId,
			blockName: this.name,
			trigger: input.options.trigger ?? null,
			metadata: input.metadata,
			startedAt: input.startedAt,
		})

		try {
			const generated = await this.runAttempts({
				input: input.input,
				identity: input.identity,
				artifactId: input.artifactId,
				runId: run.id,
				maxAttempts: input.options.maxAttempts,
				abortSignal: input.options.abortSignal,
			})
			if (!generated.ok) {
				return this.commitRejected({
					input: input.input,
					artifactId: input.artifactId,
					runId: run.id,
					metadata: input.metadata,
					startedAt: input.startedAt,
					generation: generated,
				})
			}

			return this.commitReady({
				input: input.input,
				identity: input.identity,
				artifactId: input.artifactId,
				runId: run.id,
				metadata: input.metadata,
				startedAt: input.startedAt,
				generated,
			})
		} catch (err) {
			await this.commitFailed({
				err,
				artifactId: input.artifactId,
				runId: run.id,
				startedAt: input.startedAt,
			})
			throw err
		}
	}

	private async commitReady(input: {
		input: INPUT
		identity: ThinkingBlockIdentity
		artifactId: string
		runId: string
		metadata: Record<string, unknown>
		startedAt: Date
		generated: Extract<AttemptOutcome<OUTPUT>, { ok: true }>
	}): Promise<ThinkingBlockResult<RESULT>> {
		const committed = await this.options.artifact.commit({
			input: input.input,
			identity: input.identity,
			artifactId: input.artifactId,
			runId: input.runId,
			output: input.generated.output,
			raw: input.generated.raw,
		})
		const finishedAt = new Date()
		const { supersededArtifactIds } =
			await this.options.store.markArtifactReady({
				artifactId: input.artifactId,
				blockName: this.name,
				blockVersion: this.version,
				identity: input.identity,
				output: toJsonValue(committed),
				readyAt: finishedAt,
			})
		await this.options.store.finishRun({
			runId: input.runId,
			metadata: input.metadata,
			startedAt: input.startedAt,
			finishedAt,
		})
		await Promise.all(
			supersededArtifactIds.map((artifactId) =>
				this.options.artifact.cleanup({
					input: input.input,
					identity: input.identity,
					artifactId,
				}),
			),
		)
		return {
			ok: true,
			status: "success",
			source: "generated",
			output: committed,
			artifactId: input.artifactId,
			runId: input.runId,
		}
	}

	private async commitRejected(input: {
		input: INPUT
		artifactId: string
		runId: string
		metadata: Record<string, unknown>
		startedAt: Date
		generation: Extract<AttemptOutcome<OUTPUT>, { ok: false }>
	}): Promise<ThinkingBlockResult<RESULT>> {
		const finishedAt = new Date()
		const rejection = this.buildRejection(input.generation)
		await this.options.store.markArtifactRejected({
			artifactId: input.artifactId,
			rejection: toJsonValue(rejection),
			updatedAt: finishedAt,
		})
		await this.options.store.rejectRun({
			runId: input.runId,
			reason: rejection.reason,
			rejection: toJsonValue(rejection),
			metadata: input.metadata,
			startedAt: input.startedAt,
			finishedAt,
		})
		return {
			ok: false,
			status: "rejected",
			source: "generated",
			artifactId: input.artifactId,
			runId: input.runId,
			reason: rejection.reason,
			output: rejection.output,
			details: rejection.details,
		}
	}

	private async commitFailed(input: {
		err: unknown
		artifactId: string
		runId: string
		startedAt: Date
	}): Promise<void> {
		const finishedAt = new Date()
		const error = serializeError(input.err)
		await this.options.store.markArtifactFailed({
			artifactId: input.artifactId,
			error,
			updatedAt: finishedAt,
		})
		await this.options.store.failRun({
			runId: input.runId,
			error,
			startedAt: input.startedAt,
			finishedAt,
		})
	}

	private wakeRunner(delayMs = 0): void {
		if (this.stopped) return
		if (this.runnerTimer) {
			if (delayMs > 0) return
			clearTimeout(this.runnerTimer)
			this.runnerTimer = null
		}
		this.runnerTimer = setTimeout(() => {
			this.runnerTimer = null
			void this.runnerTick().catch((err) => {
				this.handleRunnerTickError(err)
			})
		}, delayMs)
		unrefTimer(this.runnerTimer)
	}

	private handleRunnerTickError(err: unknown): void {
		console.error(`ThinkingBlock ${this.name} runner tick failed`, err)
	}

	private async runnerTick(): Promise<void> {
		if (this.stopped) return
		if (this.runnerTickPromise) return this.runnerTickPromise
		this.runnerTickPromise = this.runRunnerTick()
		try {
			await this.runnerTickPromise
		} finally {
			this.runnerTickPromise = null
			this.wakeRunner(RUNNER_POLL_MS)
		}
	}

	private async runRunnerTick(): Promise<void> {
		if (this.stopped) return
		await this.requeueRetryableArtifacts()
		const available = this.parallelism - this.activeArtifacts.size
		if (available <= 0) return
		const claimed = await this.options.store.claimPendingArtifacts({
			blockName: this.name,
			blockVersion: this.version,
			limit: available,
			claimedAt: new Date(),
		})
		for (const artifact of claimed) {
			if (this.activeArtifacts.has(artifact.id)) continue
			this.activeArtifacts.add(artifact.id)
			void this.fulfillClaimedArtifact(artifact).finally(() => {
				this.activeArtifacts.delete(artifact.id)
				this.wakeRunner()
			})
		}
	}

	private async requeueRetryableArtifacts(): Promise<void> {
		const now = Date.now()
		for (let runCount = 0; runCount < MAX_OPERATIONAL_RUNS; runCount++) {
			const failedBackoff = retryBackoffMs(runCount)
			await this.options.store.requeueRetryableArtifacts({
				blockName: this.name,
				blockVersion: this.version,
				status: "failed",
				runCount,
				updatedBefore: new Date(now - failedBackoff),
				requeuedAt: new Date(),
				excludeArtifactIds: [...this.activeArtifacts],
			})
		}
	}

	private async fulfillClaimedArtifact(
		artifact: ThinkingBlockArtifactRecord,
	): Promise<void> {
		const queuedInput = this.queuedInputs.get(artifact.id)
		const input = queuedInput?.input ?? this.parseInput(artifact.input as INPUT)
		const identity = queuedInput?.identity ?? artifact.identityKey
		const queuedOptions = this.queuedRunOptions.get(artifact.id) ?? {}
		const startedAt = new Date()
		const metadata = {
			...(this.metadata?.(input) ?? {}),
			...(queuedOptions.metadata ?? {}),
			identity,
			blockVersion: this.version,
		}
		try {
			const result = await this.generateOnArtifact({
				input,
				identity,
				artifactId: artifact.id,
				options: queuedOptions,
				metadata,
				startedAt,
			})
			this.resolveCompletion(artifact.id, result)
		} catch (err) {
			const runs = await this.options.store.countRuns({
				artifactId: artifact.id,
			})
			if (runs >= MAX_OPERATIONAL_RUNS) {
				this.rejectCompletion(artifact.id, err)
			}
		} finally {
			this.queuedRunOptions.delete(artifact.id)
			this.queuedInputs.delete(artifact.id)
		}
	}

	async dump(identity: ThinkingBlockIdentity): Promise<void> {
		const normalized = normalizeIdentity(this.name, identity)
		const dumped = await this.options.store.dumpArtifacts({
			blockName: this.name,
			blockVersion: this.version,
			identity: normalized,
			dumpedAt: new Date(),
		})
		await Promise.all(
			dumped.map((artifact) =>
				this.options.artifact.cleanup({
					identity: normalized,
					artifactId: artifact.id,
				}),
			),
		)
	}

	async audit(
		identity: ThinkingBlockIdentity,
	): Promise<Awaited<ReturnType<ThinkingBlockStore["listArtifacts"]>>> {
		return this.options.store.listArtifacts({
			blockName: this.name,
			blockVersion: this.version,
			identity: normalizeIdentity(this.name, identity),
		})
	}

	private parseInput(rawInput: INPUT): INPUT {
		return this.inputSchema ? this.inputSchema.parse(rawInput) : rawInput
	}

	private resolveIdentity(input: INPUT): ThinkingBlockIdentity {
		return normalizeIdentity(
			this.name,
			this.identity?.(input) ?? thinkingBlockInputHash(input),
		)
	}

	private async runAttempts(input: {
		input: INPUT
		identity: ThinkingBlockIdentity
		artifactId: string
		runId: string
		maxAttempts?: number
		abortSignal?: AbortSignal
	}): Promise<AttemptOutcome<OUTPUT>> {
		const maxAttempts = this.maxAttemptsFor(input.maxAttempts)
		const attempts: Array<{
			attempt: number
			ok: boolean
			feedback?: unknown
		}> = []
		let feedback: unknown
		let lastOutput: OUTPUT | undefined
		// Step indexes are run-scoped, so retries and judge calls preserve one
		// chronological sequence in the durable model-call log.
		let stepIndex = 0

		for (let attemptIndex = 0; attemptIndex < maxAttempts; attemptIndex++) {
			const attempt = attemptIndex + 1
			await this.emitPhase(input.artifactId, {
				kind: "attempt_started",
				attempt,
			})
			const call = validatePreparedCall(
				await this.prepareCall({ input: input.input, attempt, feedback }),
			)
			const raw = await this.generateOnce({
				agent: this.agent,
				runId: input.runId,
				operationId: this.name,
				attempt,
				nextStepIndex: () => stepIndex++,
				role: "generate",
				instructions: this.instructions,
				call,
				abortSignal: input.abortSignal,
				phaseArtifactId: input.artifactId,
			})
			const output = raw.output as OUTPUT
			lastOutput = output
			const validation = await this.validateOutput({
				input: input.input,
				artifactId: input.artifactId,
				runId: input.runId,
				output,
				raw,
				attempt,
				nextStepIndex: () => stepIndex++,
				abortSignal: input.abortSignal,
			})
			attempts.push({
				attempt,
				ok: validation.success,
				feedback: validation.success ? undefined : validation.feedback,
			})
			if (validation.success) {
				return {
					ok: true,
					output,
					raw,
				}
			}
			feedback = validation.feedback
		}
		return {
			ok: false,
			lastOutput,
			feedback,
			attempts,
		}
	}

	private buildRejection(generation: {
		lastOutput?: OUTPUT
		feedback: unknown
		attempts: Array<{ attempt: number; ok: boolean; feedback?: unknown }>
	}): RejectionRecord<OUTPUT> {
		return {
			reason: "validation_failed",
			output: generation.lastOutput,
			details: {
				feedback: generation.feedback,
				attempts: generation.attempts,
			},
		}
	}

	private maxAttemptsFor(runMaxAttempts?: number): number {
		if (runMaxAttempts !== undefined) {
			return normalizeMaxAttempts(runMaxAttempts)
		}
		if (!this.attempts) return DEFAULT_ATTEMPTS
		return normalizeMaxAttempts(this.attempts.max)
	}

	private async validateOutput(input: {
		input: INPUT
		artifactId: string
		runId: string
		output: OUTPUT
		raw: ThinkingBlockAgentResult
		attempt: number
		nextStepIndex: () => number
		abortSignal?: AbortSignal
	}): Promise<ThinkingBlockValidationResult> {
		for (const validator of this.validators ?? []) {
			await this.emitPhase(input.artifactId, {
				kind: "validator_started",
				attempt: input.attempt,
				validator: validator.id,
			})
			const result =
				validator.type === "check"
					? await validator.validate({
							input: input.input,
							output: input.output,
							raw: input.raw,
							attempt: input.attempt,
						})
					: await this.runModelValidation(input, validator)
			await this.options.store.recordValidation({
				runId: input.runId,
				operationId: this.name,
				attempt: input.attempt,
				validatorId: validator.id,
				validatorType: validator.type,
				status: result.success ? "pass" : "fail",
				feedback: result.success ? undefined : result.feedback,
				metadata: validator.metadata,
			})
			await this.emitPhase(input.artifactId, {
				kind: "validator_finished",
				attempt: input.attempt,
				validator: validator.id,
				success: result.success,
			})
			if (!result.success) return result
		}
		return { success: true }
	}

	private async runModelValidation<JUDGEMENT>(
		input: {
			input: INPUT
			runId: string
			artifactId: string
			output: OUTPUT
			raw: ThinkingBlockAgentResult
			attempt: number
			nextStepIndex: () => number
			abortSignal?: AbortSignal
		},
		validator: ThinkingBlockModelValidation<INPUT, OUTPUT, JUDGEMENT>,
	): Promise<ThinkingBlockValidationResult> {
		const call = validatePreparedCall(
			await validator.prepareCall({
				input: input.input,
				output: input.output,
				attempt: input.attempt,
			}),
		)
		const raw = await this.generateOnce({
			agent: validator.agent,
			runId: input.runId,
			operationId: this.name,
			attempt: input.attempt,
			nextStepIndex: input.nextStepIndex,
			role: "judge",
			instructions: validator.instructions,
			call,
			abortSignal: input.abortSignal,
			validatorId: validator.id,
			validatorType: "model",
			phaseArtifactId: input.artifactId,
		})
		const judgement = validator.schema.parse(raw.output)
		return validator.validate({
			input: input.input,
			output: input.output,
			judgement,
			attempt: input.attempt,
		})
	}

	private async generateOnce(input: {
		agent: ThinkingBlockAgent
		runId: string
		operationId: string
		attempt: number
		nextStepIndex: () => number
		role: ThinkingBlockModelCallRole
		instructions?: string
		call: ThinkingBlockPreparedCall
		abortSignal?: AbortSignal
		validatorId?: string
		validatorType?: "model"
		phaseArtifactId: string
	}): Promise<ThinkingBlockAgentResult> {
		const instructions = input.instructions ?? null
		const instructionsHash =
			instructions === null ? null : thinkingBlockInputHash(instructions)
		const agentOptions = input.call.options
		const metadata = {
			thinkingBlock: {
				id: this.name,
				version: this.version,
				runId: input.runId,
			},
			agentId: input.agent.id,
		}
		try {
			const result = await input.agent.generate({
				...(input.instructions === undefined
					? {}
					: { instructions: input.instructions }),
				...(input.call.prompt !== undefined
					? { prompt: input.call.prompt }
					: { messages: input.call.messages }),
				options: agentOptions,
				abortSignal: input.abortSignal,
				onStepFinish: async (step: ThinkingBlockAgentStep) => {
					const stepIndex = input.nextStepIndex()
					await this.options.store.recordModelCall({
						runId: input.runId,
						operationId: input.operationId,
						attempt: input.attempt,
						stepIndex,
						role: input.role,
						blockName: this.name,
						modelProvider: step.model?.provider ?? "unknown",
						model: step.model?.modelId ?? "unknown",
						responseModel: step.response?.modelId ?? step.model?.modelId,
						status: "success",
						metadata,
						input: modelCallInput({
							call: input.call,
							agent: input.agent,
							attempt: input.attempt,
						}),
						instructions,
						instructionsHash,
						output: toJsonRecord(step) ?? {},
						validatorId: input.validatorId ?? null,
						validatorType: input.validatorType ?? null,
					})
					await this.emitPhase(input.phaseArtifactId, {
						kind: "step_finished",
						attempt: input.attempt,
						step,
					})
				},
			} as Parameters<ThinkingBlockAgent["generate"]>[0] & {
				instructions?: string
			})
			return result as ThinkingBlockAgentResult
		} catch (err) {
			console.error(
				"thinking block model call failed",
				{
					blockName: this.name,
					agentId: input.agent.id,
					role: input.role,
					attempt: input.attempt,
					operationId: input.operationId,
					validatorId: input.validatorId ?? null,
					validatorType: input.validatorType ?? null,
				},
				err,
			)
			await this.options.store.recordModelCall({
				runId: input.runId,
				operationId: input.operationId,
				attempt: input.attempt,
				stepIndex: input.nextStepIndex(),
				role: input.role,
				blockName: this.name,
				modelProvider: "unknown",
				model: input.agent.id ?? "unknown",
				status: "error",
				metadata,
				input: modelCallInput({
					call: input.call,
					agent: input.agent,
					attempt: input.attempt,
				}),
				instructions,
				instructionsHash,
				error: serializeError(err),
				validatorId: input.validatorId ?? null,
				validatorType: input.validatorType ?? null,
			})
			throw err
		}
	}

	private async emitPhase(
		artifactId: string,
		event: PhaseEvent,
	): Promise<void> {
		const phase = phaseForEvent(event)
		if (!phase) return
		await this.options.store.updateArtifactPhase({
			artifactId,
			phase: phase.phase,
			phaseLabel: phase.label,
			phaseAt: new Date(),
		})
	}
}

function phaseForEvent(
	event: PhaseEvent,
): { phase: string; label: string } | null {
	if (event.kind === "attempt_started") {
		return { phase: "generating", label: "Generating" }
	}
	if (event.kind === "validator_started") {
		return { phase: "validating", label: "Validating" }
	}
	return null
}

function normalizeIdentity(
	blockName: string,
	identity: ThinkingBlockIdentity,
): ThinkingBlockIdentity {
	if (typeof identity !== "string" || identity.length === 0) {
		throw new Error(`ThinkingBlock ${blockName} identity key is required`)
	}
	return identity
}

function normalizeMaxAttempts(maxAttempts: number): number {
	if (!Number.isFinite(maxAttempts) || !Number.isInteger(maxAttempts)) {
		throw new Error("ThinkingBlock maxAttempts must be an integer")
	}
	if (maxAttempts < 1) {
		throw new Error("ThinkingBlock maxAttempts must be at least 1")
	}
	return maxAttempts
}

function normalizeParallelism(parallelism: number): number {
	if (!Number.isFinite(parallelism) || !Number.isInteger(parallelism)) {
		throw new Error("ThinkingBlock parallelism must be an integer")
	}
	if (parallelism < 1) {
		throw new Error("ThinkingBlock parallelism must be at least 1")
	}
	return parallelism
}

function retryBackoffMs(runCount: number): number {
	return (
		FAILED_RETRY_BACKOFF_MS[
			Math.min(runCount, FAILED_RETRY_BACKOFF_MS.length - 1)
		] ?? 0
	)
}

function selectQueuedAbortSignal(
	existing?: AbortSignal,
	incoming?: AbortSignal,
): AbortSignal | undefined {
	if (incoming && !incoming.aborted) return incoming
	if (existing && !existing.aborted) return existing
	return incoming ?? existing
}

function readRejectionRecord<OUTPUT>(value: unknown): RejectionRecord<OUTPUT> {
	if (value && typeof value === "object") {
		const record = value as {
			reason?: unknown
			output?: OUTPUT
			details?: unknown
		}
		return {
			reason:
				typeof record.reason === "string" ? record.reason : "validation_failed",
			output: record.output,
			details: record.details,
		}
	}
	return { reason: "validation_failed" }
}

async function sleep(ms: number, abortSignal?: AbortSignal): Promise<void> {
	if (ms <= 0) return
	throwIfAborted(abortSignal)
	await new Promise<void>((resolve, reject) => {
		const timer = setTimeout(resolve, ms)
		if (!abortSignal) return
		const onAbort = () => {
			clearTimeout(timer)
			reject(abortSignal.reason ?? new Error("aborted"))
		}
		abortSignal.addEventListener("abort", onAbort, { once: true })
	})
}

function throwIfAborted(abortSignal?: AbortSignal): void {
	if (!abortSignal?.aborted) return
	throw abortSignal.reason ?? new Error("aborted")
}

function unrefTimer(timer: ReturnType<typeof setTimeout>): void {
	const maybeTimer = timer as { unref?: () => void }
	maybeTimer.unref?.()
}

declare global {
	// eslint-disable-next-line no-var
	var __thinkingBlockRunnerRegistry: ThinkingBlockRunnerRegistry | undefined
}

function thinkingBlockRunnerRegistry(): ThinkingBlockRunnerRegistry {
	globalThis.__thinkingBlockRunnerRegistry ??= new Map()
	return globalThis.__thinkingBlockRunnerRegistry
}

function modelCallInput(input: {
	call: ThinkingBlockPreparedCall
	agent: ThinkingBlockAgent
	attempt: number
}): Record<string, unknown> {
	const tools = input.agent.tools
	return {
		...(input.call.prompt !== undefined
			? { prompt: input.call.prompt }
			: { messages: toJsonValue(input.call.messages) }),
		attempt: input.attempt,
		options: toJsonValue(input.call.options),
		agentId: input.agent.id,
		tools:
			tools && typeof tools === "object"
				? Object.keys(tools).sort()
				: undefined,
	}
}

function validatePreparedCall(
	call: ThinkingBlockPreparedCall,
): ThinkingBlockPreparedCall {
	const hasPrompt = "prompt" in call && call.prompt !== undefined
	const hasMessages = "messages" in call && call.messages !== undefined
	if (hasPrompt === hasMessages) {
		throw new Error(
			"ThinkingBlock call must include exactly one of prompt or messages",
		)
	}
	return call
}
