import { describe, expect, test } from "bun:test"
import { Output, ToolLoopAgent } from "ai"
import { MockLanguageModelV3 } from "ai/test"
import { z } from "zod"
import {
	type ArtifactAdapter,
	check,
	InMemoryThinkingBlockStore,
	judge,
	ThinkingBlock,
	type ThinkingBlockValidation,
	thinkingBlockInputHash,
} from "../src"

type MockGenerateResult = Awaited<ReturnType<MockLanguageModelV3["doGenerate"]>>

describe("ThinkingBlock", () => {
	test("get cache-hits ready artifacts without opening a run", async () => {
		const store = new InMemoryThinkingBlockStore()
		const input = { id: "alpha" }
		const block = textBlock({
			store,
			name: "unit-cache",
			outputs: ["fresh"],
			prompt: () => "draft",
		})

		const generated = await block.generate(input)
		const cached = await block.get(input)

		expect(generated.ok).toBe(true)
		expect(cached.ok).toBe(true)
		if (!cached.ok) throw new Error("expected cache hit")
		expect(cached.source).toBe("cached")
		expect(cached.output).toBe("fresh")
		expect(store.runs).toHaveLength(1)
		expect(store.artifacts[0]?.identityKey).toBe(thinkingBlockInputHash(input))
		expect(store.artifacts[0]?.output).toBe("fresh")
	})

	test("cache mode is read-only and never opens a run", async () => {
		const store = new InMemoryThinkingBlockStore()
		const block = textBlock({
			store,
			name: "unit-cache-mode",
			outputs: ["fresh"],
			prompt: () => "draft",
		})

		const empty = await block.get({ id: "missing" }, { mode: "cache" })
		const generated = await block.generate({ id: "missing" })
		const cached = await block.get({ id: "missing" }, { mode: "cache" })

		expect(empty.result).toBeNull()
		expect(empty.artifact).toBeNull()
		expect(generated.ok).toBe(true)
		expect(cached.result?.output).toBe("fresh")
		expect(cached.artifact?.status).toBe("ready")
		expect(store.runs).toHaveLength(1)
	})

	test("sync get waits for ready artifacts", async () => {
		const store = new InMemoryThinkingBlockStore()
		const deferred = defer<void>()
		let settled = false
		const block = new ThinkingBlock<{ id: string }, string>({
			agent: new ToolLoopAgent({
				id: "unit-sync-wait-agent",
				model: new MockLanguageModelV3({
					provider: "mock",
					modelId: "mock-model",
					doGenerate: async () => {
						await deferred.promise
						return mockTextResult("ready")
					},
				}),
				output: Output.text(),
			}),
			name: "unit-sync-wait",
			store,
			prepareCall: () => ({ prompt: "draft" }),
		})

		const pending = block.get({ id: "slow" }).then((result) => {
			settled = true
			return result
		})
		await eventually(() => store.artifacts[0]?.status === "running")
		expect(settled).toBe(false)
		deferred.resolve()
		const result = await pending

		expect(result.ok).toBe(true)
		expect(result.ok && result.source).toBe("generated")
		expect(result.ok && result.output).toBe("ready")
	})

	test("sync generate passes abort signal to queued fulfillment", async () => {
		const store = new InMemoryThinkingBlockStore()
		const controller = new AbortController()
		let observedSignal: AbortSignal | undefined
		const block = new ThinkingBlock<{ id: string }, string>({
			agent: new ToolLoopAgent({
				id: "unit-abort-signal-agent",
				model: new MockLanguageModelV3({
					provider: "mock",
					modelId: "mock-model",
					doGenerate: async (options) => {
						observedSignal = options.abortSignal
						return mockTextResult("ready")
					},
				}),
				output: Output.text(),
			}),
			name: "unit-abort-signal",
			store,
			prepareCall: () => ({ prompt: "draft" }),
		})

		const result = await block.generate(
			{ id: "cancelable" },
			{ abortSignal: controller.signal },
		)

		expect(result.ok).toBe(true)
		expect(observedSignal).toBe(controller.signal)
	})

	test("sync get reads terminal artifacts fulfilled by another runner", async () => {
		const store = new InMemoryThinkingBlockStore()
		const deferred = defer<void>()
		const input = { id: "external" }
		const blockName = "unit-external-terminal"
		const block = new ThinkingBlock<{ id: string }, string>({
			agent: new ToolLoopAgent({
				id: "unit-external-terminal-agent",
				model: new MockLanguageModelV3({
					provider: "mock",
					modelId: "mock-model",
					doGenerate: async () => {
						await deferred.promise
						return mockTextResult("local")
					},
				}),
				output: Output.text(),
			}),
			name: blockName,
			store,
			prepareCall: () => ({ prompt: "draft" }),
		})

		const pending = block.get(input)
		await eventually(() => store.artifacts[0]?.status === "running")
		await store.markArtifactReady({
			artifactId: store.artifacts[0]!.id,
			blockName,
			blockVersion: "v1",
			identity: thinkingBlockInputHash(input),
			output: "external",
			readyAt: new Date(),
		})

		const result = await pending
		deferred.resolve()

		expect(result.ok).toBe(true)
		expect(result.ok && result.output).toBe("external")
		await eventually(() => store.runs[0]?.status === "success")
	})

	test("background mode returns before model execution", async () => {
		const store = new InMemoryThinkingBlockStore()
		const deferred = defer<void>()
		let modelStarted = false
		const block = new ThinkingBlock<{ id: string }, string>({
			agent: new ToolLoopAgent({
				id: "unit-background-return-agent",
				model: new MockLanguageModelV3({
					provider: "mock",
					modelId: "mock-model",
					doGenerate: async () => {
						modelStarted = true
						await deferred.promise
						return mockTextResult("ready")
					},
				}),
				output: Output.text(),
			}),
			name: "unit-background-return",
			store,
			prepareCall: () => ({ prompt: "draft" }),
		})

		const lookup = await block.get(
			{ id: "slow" },
			{ mode: "background", trigger: "unit" },
		)

		expect(lookup.result).toBeNull()
		expect(lookup.artifact?.status).toBe("pending")
		expect(modelStarted).toBe(false)
		deferred.resolve()
		await eventually(() => store.artifacts[0]?.status === "ready")
	})

	test("background mode creates one pending or running artifact and reuses it", async () => {
		const store = new InMemoryThinkingBlockStore()
		const deferred = defer<void>()
		const block = new ThinkingBlock<{ id: string }, string>({
			agent: new ToolLoopAgent({
				id: "unit-background-agent",
				model: new MockLanguageModelV3({
					provider: "mock",
					modelId: "mock-model",
					doGenerate: async () => {
						await deferred.promise
						return mockTextResult("ready")
					},
				}),
				output: Output.text(),
			}),
			name: "unit-background",
			store,
			prepareCall: () => ({ prompt: "draft" }),
		})

		const first = await block.get(
			{ id: "slow" },
			{ mode: "background", trigger: "unit" },
		)
		const second = await block.get(
			{ id: "slow" },
			{ mode: "background", trigger: "unit" },
		)

		expect(first.result).toBeNull()
		const firstStatus = first.artifact?.status
		expect(firstStatus === "pending" || firstStatus === "running").toBe(true)
		expect(second.artifact?.id).toBe(first.artifact?.id)
		expect(store.artifacts).toHaveLength(1)

		deferred.resolve()
		await eventually(() => store.artifacts[0]?.status === "ready")
		const ready = await block.get(
			{ id: "slow" },
			{ mode: "background", trigger: "unit" },
		)
		expect(ready.result?.output).toBe("ready")
		expect(ready.artifact?.id).toBe(first.artifact?.id)
	})

	test("constructor-started runner fulfills pending artifacts", async () => {
		const store = new InMemoryThinkingBlockStore()
		const input = { id: "queued" }
		await store.createArtifact({
			blockName: "unit-constructor-runner",
			blockVersion: "v1",
			identity: thinkingBlockInputHash(input),
			input,
			createdAt: new Date(),
		})
		new ThinkingBlock<{ id: string }, string>({
			agent: new ToolLoopAgent({
				id: "unit-constructor-runner-agent",
				model: mockModel(["ready"]),
				output: Output.text(),
			}),
			name: "unit-constructor-runner",
			store,
			prepareCall: () => ({ prompt: "draft" }),
		})

		await eventually(() => store.artifacts[0]?.status === "ready")
		expect(store.artifacts[0]?.output).toBe("ready")
		expect(store.runs).toHaveLength(1)
	})

	test("parallelism caps active generations", async () => {
		const store = new InMemoryThinkingBlockStore()
		const release = defer<void>()
		let active = 0
		let maxActive = 0
		let started = 0
		const firstPairStarted = defer<void>()
		const block = new ThinkingBlock<{ id: string }, string>({
			agent: new ToolLoopAgent({
				id: "unit-parallelism-agent",
				model: new MockLanguageModelV3({
					provider: "mock",
					modelId: "mock-model",
					doGenerate: async () => {
						active += 1
						started += 1
						maxActive = Math.max(maxActive, active)
						if (started === 2) firstPairStarted.resolve()
						await release.promise
						active -= 1
						return mockTextResult("ready")
					},
				}),
				output: Output.text(),
			}),
			name: "unit-parallelism",
			store,
			parallelism: 2,
			identity: (input) => input.id,
			prepareCall: () => ({ prompt: "draft" }),
		})

		await Promise.all(
			Array.from({ length: 5 }, (_, index) =>
				block.get(
					{ id: `item-${index}` },
					{ mode: "background", trigger: "unit" },
				),
			),
		)
		await firstPairStarted.promise
		expect(started).toBe(2)
		expect(maxActive).toBe(2)

		release.resolve()
		await eventually(() =>
			store.artifacts.every((artifact) => artifact.status === "ready"),
		)
		expect(maxActive).toBeLessThanOrEqual(2)
		expect(store.runs).toHaveLength(5)
	})

	test("replacing a block runner stops the previous runner for that block name", async () => {
		const store = new InMemoryThinkingBlockStore()
		const release = defer<void>()
		let active = 0
		let maxActive = 0
		let started = 0
		const firstStarted = defer<void>()
		const makeBlock = (index: number) =>
			new ThinkingBlock<{ id: string }, string>({
				agent: new ToolLoopAgent({
					id: `unit-replaced-runner-agent-${index}`,
					model: new MockLanguageModelV3({
						provider: "mock",
						modelId: "mock-model",
						doGenerate: async () => {
							active += 1
							started += 1
							maxActive = Math.max(maxActive, active)
							if (started === 1) firstStarted.resolve()
							await release.promise
							active -= 1
							return mockTextResult("ready")
						},
					}),
					output: Output.text(),
				}),
				name: "unit-replaced-runner",
				store,
				parallelism: 1,
				identity: (input) => input.id,
				prepareCall: () => ({ prompt: "draft" }),
			})

		makeBlock(1)
		makeBlock(2)
		const current = makeBlock(3)

		await Promise.all(
			Array.from({ length: 5 }, (_, index) =>
				current.get(
					{ id: `item-${index}` },
					{ mode: "background", trigger: "unit" },
				),
			),
		)
		await firstStarted.promise
		await new Promise((resolve) => setTimeout(resolve, 1_200))
		expect(started).toBe(1)
		expect(maxActive).toBe(1)

		release.resolve()
		await eventually(() =>
			store.artifacts.every((artifact) => artifact.status === "ready"),
		)
		expect(maxActive).toBe(1)
	})

	test("runner does not requeue running artifacts from another worker", async () => {
		const store = new InMemoryThinkingBlockStore()
		const name = "unit-stale-running"
		const input = { id: "running" }
		await store.createArtifact({
			blockName: name,
			blockVersion: "v1",
			identity: thinkingBlockInputHash(input),
			input,
			createdAt: new Date(Date.now() - 120_000),
		})
		await store.claimPendingArtifacts({
			blockName: name,
			blockVersion: "v1",
			limit: 1,
			claimedAt: new Date(Date.now() - 120_000),
		})
		new ThinkingBlock<{ id: string }, string>({
			agent: new ToolLoopAgent({
				id: "unit-stale-running-agent",
				model: mockModel(["ready"]),
				output: Output.text(),
			}),
			name,
			store,
			prepareCall: () => ({ prompt: "draft" }),
		})

		await new Promise((resolve) => setTimeout(resolve, 20))

		expect(store.artifacts[0]?.status).toBe("running")
		expect(store.runs).toHaveLength(0)
	})

	test("runner tick errors are handled", async () => {
		const store = new InMemoryThinkingBlockStore()
		const originalRequeue = store.requeueRetryableArtifacts.bind(store)
		const originalConsoleError = console.error
		let requeueCalls = 0
		const errors: unknown[][] = []
		store.requeueRetryableArtifacts = async () => {
			requeueCalls += 1
			throw new Error("store unavailable")
		}
		console.error = (...args: unknown[]) => {
			errors.push(args)
		}

		try {
			new ThinkingBlock<{ id: string }, string>({
				agent: new ToolLoopAgent({
					id: "unit-runner-error-agent",
					model: mockModel(["ready"]),
					output: Output.text(),
				}),
				name: "unit-runner-error",
				store,
				prepareCall: () => ({ prompt: "draft" }),
			})

			await eventually(() => requeueCalls > 0)
			await eventually(() =>
				errors.some((args) => String(args[0]).includes("runner tick failed")),
			)
		} finally {
			store.requeueRetryableArtifacts = originalRequeue
			console.error = originalConsoleError
		}
	})

	test("background mode returns terminal artifacts without retrying", async () => {
		const store = new InMemoryThinkingBlockStore()
		const block = textBlock({
			store,
			name: "unit-background-terminal",
			outputs: ["", "", ""],
			prompt: () => "draft",
			validators: [
				check<{ id: string }, string>("nonempty", {
					validate: ({ output }) =>
						output.length > 0 ? { success: true } : { success: false },
				}),
			],
		})

		const rejected = await block.generate({ id: "reject" })
		const lookup = await block.get(
			{ id: "reject" },
			{ mode: "background", trigger: "unit" },
		)

		expect(rejected.ok).toBe(false)
		expect(lookup.result).toBeNull()
		expect(lookup.artifact?.status).toBe("rejected")
		expect(store.runs).toHaveLength(1)
	})

	test("background mode reports retryable failed artifacts as generating", async () => {
		const store = new InMemoryThinkingBlockStore()
		const name = "unit-background-retryable-failed"
		const input = { id: "retryable" }
		const block = textBlock({
			store,
			name,
			outputs: ["ready"],
			prompt: () => "draft",
		})
		const artifact = await store.createArtifact({
			blockName: name,
			blockVersion: "v1",
			identity: thinkingBlockInputHash(input),
			input,
			createdAt: new Date(),
		})
		const startedAt = new Date()
		const failedAt = new Date()
		const run = await store.startRun({
			artifactId: artifact.id,
			blockName: name,
			metadata: {},
			startedAt,
		})
		await store.markArtifactFailed({
			artifactId: artifact.id,
			error: { message: "temporary" },
			updatedAt: failedAt,
		})
		await store.failRun({
			runId: run.id,
			error: { message: "temporary" },
			startedAt,
			finishedAt: failedAt,
		})

		const lookup = await block.get(input, {
			mode: "background",
			trigger: "unit",
		})

		expect(lookup.artifact?.id).toBe(artifact.id)
		expect(lookup.artifact?.status).toBe("pending")
	})

	test("sync get waits for rejected artifacts", async () => {
		const store = new InMemoryThinkingBlockStore()
		const block = textBlock({
			store,
			name: "unit-sync-rejected",
			outputs: ["", "", ""],
			prompt: () => "draft",
			validators: [
				check<{ id: string }, string>("nonempty", {
					validate: ({ output }) =>
						output.length > 0 ? { success: true } : { success: false },
				}),
			],
		})

		const result = await block.get({ id: "reject" })

		expect(result.ok).toBe(false)
		if (result.ok) throw new Error("expected rejection")
		expect(result.reason).toBe("validation_failed")
		expect(store.artifacts[0]?.status).toBe("rejected")
		expect(store.runs).toHaveLength(1)
	})

	test("sync get waits for failed artifacts after retry budget", async () => {
		const store = new InMemoryThinkingBlockStore()
		const block = new ThinkingBlock<{ id: string }, string>({
			agent: new ToolLoopAgent({
				id: "unit-sync-failed-agent",
				model: new MockLanguageModelV3({
					provider: "mock",
					modelId: "mock-model",
					doGenerate: async () => {
						throw new Error("planned failure")
					},
				}),
				output: Output.text(),
			}),
			name: "unit-sync-failed",
			store,
			prepareCall: () => ({ prompt: "draft" }),
		})

		await expect(block.get({ id: "fail" })).rejects.toThrow("planned failure")

		expect(store.artifacts[0]?.status).toBe("failed")
		expect(store.runs).toHaveLength(3)
	})

	test("a null adapter read falls through to fresh generation", async () => {
		const store = new InMemoryThinkingBlockStore()
		let readCount = 0
		const adapter = {
			async read() {
				readCount += 1
				return readCount === 1 ? "cached" : null
			},
			async commit({ output }) {
				return output
			},
			async cleanup() {},
		} satisfies ArtifactAdapter<string, { id: string }>
		const block = textBlock({
			store,
			name: "unit-null-read",
			outputs: ["generated"],
			prompt: () => "draft",
			artifact: adapter,
		})
		await store.createArtifact({
			blockName: "unit-null-read",
			blockVersion: "v1",
			identity: thinkingBlockInputHash({ id: "a" }),
			input: { id: "a" },
			createdAt: new Date(),
		})
		await store.markArtifactReady({
			artifactId: store.artifacts[0]!.id,
			blockName: "unit-null-read",
			blockVersion: "v1",
			identity: thinkingBlockInputHash({ id: "a" }),
			output: "old",
			readyAt: new Date(),
		})

		const cached = await block.get({ id: "a" })
		const regenerated = await block.get({ id: "a" })

		expect(cached.ok && cached.source).toBe("cached")
		expect(regenerated.ok && regenerated.source).toBe("generated")
		expect(store.runs).toHaveLength(1)
		expect(store.artifacts.map((artifact) => artifact.status)).toEqual([
			"superseded",
			"ready",
		])
	})

	test("generate skips cache, supersedes the previous ready artifact, and cleans up", async () => {
		const store = new InMemoryThinkingBlockStore()
		const cleaned: string[] = []
		const adapter = {
			async read({ artifact }) {
				return artifact.output as string
			},
			async commit({ output }) {
				return output
			},
			async cleanup({ artifactId }) {
				cleaned.push(artifactId)
			},
		} satisfies ArtifactAdapter<string, { id: string }>
		const block = textBlock({
			store,
			name: "unit-supersede",
			outputs: ["one", "two"],
			prompt: () => "draft",
			artifact: adapter,
		})

		const first = await block.generate({ id: "same" })
		const second = await block.generate({ id: "same" })

		expect(first.ok).toBe(true)
		expect(second.ok).toBe(true)
		expect(store.artifacts.map((artifact) => artifact.status)).toEqual([
			"superseded",
			"ready",
		])
		expect(store.artifacts[0]?.supersededBy).toBe(store.artifacts[1]?.id)
		expect(cleaned).toEqual([store.artifacts[0]?.id])
	})

	test("check validation defaults to three attempts with feedback and records phases", async () => {
		const store = new InMemoryThinkingBlockStore()
		let validateCalls = 0
		let failedValidateCalls = 0
		const generationFeedbacks: unknown[] = []
		const block = textBlock({
			store,
			name: "unit-check",
			outputs: ["", "", "usable"],
			prompt: ({ attempt, feedback }) => {
				generationFeedbacks.push(feedback)
				return `attempt ${attempt} ${String(feedback ?? "")}`
			},
			validators: [
				check<{ id: string }, string>("has-text", {
					validate: ({ output }) => {
						validateCalls += 1
						if (output.length > 0) return { success: true }
						failedValidateCalls += 1
						return { success: false, feedback: { reason: "empty_text" } }
					},
				}),
			],
		})

		const result = await block.generate({ id: "two" })

		expect(result.ok).toBe(true)
		expect(result.ok && result.output).toBe("usable")
		expect(validateCalls).toBe(3)
		expect(failedValidateCalls).toBe(2)
		expect(generationFeedbacks).toEqual([
			undefined,
			{ reason: "empty_text" },
			{ reason: "empty_text" },
		])
		expect(store.modelCalls.map((call) => call.attempt)).toEqual([1, 2, 3])
		expect(store.validations.map((validation) => validation.status)).toEqual([
			"fail",
			"fail",
			"pass",
		])
		expect(store.validations[0]?.feedback).toEqual({ reason: "empty_text" })
		expect(store.phases.map((phase) => phase.phase)).toEqual([
			"generating",
			"validating",
			"generating",
			"validating",
			"generating",
			"validating",
		])
	})

	test("judge validation records judge calls and terminal rejection", async () => {
		const store = new InMemoryThinkingBlockStore()
		const judgementSchema = z.object({
			accepted: z.boolean(),
			feedback: z.string().optional(),
		})
		const model = mockModel([
			"draft 1",
			JSON.stringify({ accepted: false, feedback: "too vague" }),
			"draft 2",
			JSON.stringify({ accepted: false, feedback: "too vague" }),
			"draft 3",
			JSON.stringify({ accepted: false, feedback: "too vague" }),
		])
		const draftAgent = new ToolLoopAgent({
			id: "draft-agent",
			model,
			output: Output.text(),
		})
		const judgeAgent = new ToolLoopAgent({
			id: "judge-agent",
			model,
			output: Output.object({ schema: judgementSchema }),
		})
		const parsedJudgements: Array<z.infer<typeof judgementSchema>> = []
		const block = new ThinkingBlock<{ id: string }, string>({
			agent: draftAgent,
			name: "unit-judge",
			store,
			prepareCall: () => ({ prompt: "draft" }),
			validators: [
				judge<{ id: string }, string, z.infer<typeof judgementSchema>>(
					"quality",
					{
						agent: judgeAgent,
						schema: judgementSchema,
						instructions: "judge instructions",
						prepareCall: ({ output }) => ({ prompt: `judge ${output}` }),
						validate: ({ judgement }) => {
							parsedJudgements.push(judgement)
							return judgement.accepted
								? { success: true }
								: { success: false, feedback: judgement.feedback }
						},
					},
				),
			],
		})

		const result = await block.generate({ id: "three" })

		expect(result.ok).toBe(false)
		if (result.ok) throw new Error("expected rejection")
		expect(result.reason).toBe("validation_failed")
		expect(result.output).toBe("draft 3")
		expect(store.artifacts[0]?.status).toBe("rejected")
		expect(store.runs[0]?.status).toBe("rejected")
		expect(store.modelCalls.map((call) => call.role)).toEqual([
			"generate",
			"judge",
			"generate",
			"judge",
			"generate",
			"judge",
		])
		expect(
			store.modelCalls.filter((call) => call.role === "judge"),
		).toHaveLength(3)
		expect(
			store.modelCalls
				.filter((call) => call.role === "judge")
				.every(
					(call) =>
						call.instructions === "judge instructions" &&
						call.instructionsHash ===
							thinkingBlockInputHash("judge instructions"),
				),
		).toBe(true)
		expect(parsedJudgements).toEqual([
			{ accepted: false, feedback: "too vague" },
			{ accepted: false, feedback: "too vague" },
			{ accepted: false, feedback: "too vague" },
		])
		expect(store.validations[0]).toMatchObject({
			validatorId: "quality",
			validatorType: "model",
			status: "fail",
			feedback: "too vague",
		})
	})

	test("instructions changes are provenance only until the block version changes", async () => {
		const store = new InMemoryThinkingBlockStore()
		const input = { id: "stable" }
		const first = instructionsBlock({
			store,
			name: "unit-provenance-cache",
			instructions: "first instructions",
			outputs: ["ready", "regenerated"],
		})
		const generated = await first.generate(input)
		expect(generated.ok && generated.output).toBe("ready")

		const second = instructionsBlock({
			store,
			name: "unit-provenance-cache",
			instructions: "second instructions",
			outputs: ["regenerated"],
		})
		const cached = await second.get(input)
		expect(cached.ok && cached.source).toBe("cached")
		expect(cached.ok && cached.output).toBe("ready")
		expect(store.runs).toHaveLength(1)

		const regenerated = await second.generate(input)
		expect(regenerated.ok && regenerated.output).toBe("regenerated")
		expect(store.modelCalls.map((call) => call.instructions)).toEqual([
			"first instructions",
			"second instructions",
		])
		expect(store.modelCalls.map((call) => call.instructionsHash)).toEqual([
			thinkingBlockInputHash("first instructions"),
			thinkingBlockInputHash("second instructions"),
		])
	})

	test("dynamic prompts are retained in model-call traces without changing instructions provenance", async () => {
		const store = new InMemoryThinkingBlockStore()
		const block = instructionsBlock({
			store,
			name: "unit-dynamic-prompt-provenance",
			instructions: "stable instructions",
			outputs: ["one", "two"],
		})

		await block.generate({ id: "one" })
		await block.generate({ id: "two" })

		expect(store.modelCalls.map((call) => call.input.prompt)).toEqual([
			"prompt one",
			"prompt two",
		])
		expect(
			store.modelCalls.every(
				(call) =>
					call.instructions === "stable instructions" &&
					call.instructionsHash ===
						thinkingBlockInputHash("stable instructions"),
			),
		).toBe(true)
	})

	test("instructions are sent to the agent separately from the dynamic prompt", async () => {
		const store = new InMemoryThinkingBlockStore()
		const model = new MockLanguageModelV3({
			provider: "mock",
			modelId: "mock-model",
			doGenerate: async () => mockTextResult("ready"),
		})
		const block = new ThinkingBlock<{ id: string }, string>({
			agent: new ToolLoopAgent({
				id: "unit-system-sent-agent",
				model,
				output: Output.text(),
			}),
			name: "unit-instructions-sent",
			store,
			identity: (input) => input.id,
			instructions: "instructions sent",
			prepareCall: () => ({
				prompt: "dynamic prompt sent",
			}),
		})

		await block.generate({ id: "one" })

		expect(model.doGenerateCalls[0]?.prompt).toEqual([
			{ role: "system", content: "instructions sent" },
			{
				role: "user",
				content: [{ type: "text", text: "dynamic prompt sent" }],
			},
		])
	})

	test("prepareCall supports messages and records them as dynamic input", async () => {
		const store = new InMemoryThinkingBlockStore()
		const model = new MockLanguageModelV3({
			provider: "mock",
			modelId: "mock-model",
			doGenerate: async () => mockTextResult("ready"),
		})
		const block = new ThinkingBlock<{ id: string }, string>({
			agent: new ToolLoopAgent({
				id: "unit-messages-agent",
				model,
				output: Output.text(),
			}),
			name: "unit-messages",
			store,
			identity: (input) => input.id,
			prepareCall: ({ input }) => ({
				messages: [{ role: "user", content: `message ${input.id}` }],
			}),
		})

		const result = await block.generate({ id: "one" })

		expect(result.ok).toBe(true)
		expect(store.modelCalls[0]?.input).toMatchObject({
			messages: [{ role: "user", content: "message one" }],
		})
		expect(model.doGenerateCalls[0]?.prompt).toEqual([
			{ role: "user", content: [{ type: "text", text: "message one" }] },
		])
	})

	test("prepareCall must include exactly one of prompt or messages", async () => {
		const block = new ThinkingBlock<{ id: string }, string>({
			agent: new ToolLoopAgent({
				id: "unit-invalid-call-agent",
				model: mockModel(["ready"]),
				output: Output.text(),
			}),
			name: "unit-invalid-call",
			store: new InMemoryThinkingBlockStore(),
			prepareCall: () =>
				({
					prompt: "prompt",
					messages: [{ role: "user", content: "message" }],
				}) as never,
		})

		await expect(block.generate({ id: "bad" })).rejects.toThrow(
			"ThinkingBlock call must include exactly one of prompt or messages",
		)
	})

	test("block version namespaces lookup and supersession", async () => {
		const store = new InMemoryThinkingBlockStore()
		const input = { id: "same" }
		const v1 = instructionsBlock({
			store,
			name: "unit-version-namespace",
			version: "v1",
			instructions: "instructions",
			outputs: ["v1"],
		})
		const v2 = instructionsBlock({
			store,
			name: "unit-version-namespace",
			version: "v2",
			instructions: "instructions",
			outputs: ["v2", "v2-new"],
		})

		await v1.generate(input)
		await v2.get(input)
		await v2.generate(input)

		expect(store.artifacts.map((artifact) => artifact.blockVersion)).toEqual([
			"v1",
			"v2",
			"v2",
		])
		expect(store.artifacts.map((artifact) => artifact.status)).toEqual([
			"ready",
			"superseded",
			"ready",
		])
	})

	test("custom identities must provide explicit cache keys", async () => {
		const block = new ThinkingBlock<{ id: string }, string>({
			agent: new ToolLoopAgent({
				id: "empty-key-agent",
				model: mockModel(["draft"]),
				output: Output.text(),
			}),
			name: "unit-empty-key",
			store: new InMemoryThinkingBlockStore(),
			identity: () => "",
			prepareCall: () => ({ prompt: "draft" }),
		})

		await expect(block.generate({ id: "missing-key" })).rejects.toThrow(
			"ThinkingBlock unit-empty-key identity key is required",
		)
	})
})

function textBlock(input: {
	store: InMemoryThinkingBlockStore
	name: string
	outputs: string[]
	prompt: (args: {
		input: { id: string }
		attempt: number
		feedback: unknown
	}) => string
	attempts?: { max: number }
	validators?: ThinkingBlockValidation<{ id: string }, string>[]
	artifact?: ArtifactAdapter<string, { id: string }>
}) {
	return new ThinkingBlock<{ id: string }, string>({
		agent: new ToolLoopAgent({
			id: `${input.name}-agent`,
			model: mockModel(input.outputs),
			output: Output.text(),
		}),
		name: input.name,
		store: input.store,
		prepareCall: (args) => ({ prompt: input.prompt(args) }),
		attempts: input.attempts,
		validators: input.validators,
		artifact: input.artifact,
	})
}

function instructionsBlock(input: {
	store: InMemoryThinkingBlockStore
	name: string
	version?: string
	instructions: string
	outputs: string[]
}) {
	return new ThinkingBlock<{ id: string }, string>({
		agent: new ToolLoopAgent({
			id: `${input.name}-${input.version ?? "v1"}-agent`,
			model: mockModel(input.outputs),
			output: Output.text(),
		}),
		name: input.name,
		version: input.version,
		store: input.store,
		instructions: input.instructions,
		identity: (value) => value.id,
		prepareCall: ({ input: value }) => ({
			prompt: `prompt ${value.id}`,
		}),
	})
}

function mockModel(outputs: string[]) {
	const queue = [...outputs]
	return new MockLanguageModelV3({
		provider: "mock",
		modelId: "mock-model",
		doGenerate: async () => mockTextResult(queue.shift() ?? "missing"),
	})
}

function mockTextResult(text: string): MockGenerateResult {
	return {
		content: [{ type: "text", text }],
		finishReason: { unified: "stop", raw: "stop" },
		usage: {
			inputTokens: {
				total: 1,
				noCache: 1,
				cacheRead: 0,
				cacheWrite: 0,
			},
			outputTokens: {
				total: 1,
				text: 1,
				reasoning: 0,
			},
		},
		response: {
			modelId: "mock-model",
		},
		warnings: [],
	}
}

function defer<T>() {
	let resolve!: (value: T | PromiseLike<T>) => void
	let reject!: (reason?: unknown) => void
	const promise = new Promise<T>((res, rej) => {
		resolve = res
		reject = rej
	})
	return { promise, resolve, reject }
}

async function eventually(pass: () => boolean): Promise<void> {
	for (let i = 0; i < 100; i++) {
		if (pass()) return
		await new Promise((resolve) => setTimeout(resolve, 5))
	}
	expect(pass()).toBe(true)
}
