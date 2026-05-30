import { beforeAll, describe, expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { Output, ToolLoopAgent } from "ai"
import { MockLanguageModelV3 } from "ai/test"
import { and, asc, eq } from "drizzle-orm"
import { z } from "zod"
import { db } from "@/lib/db/client"
import { migrate } from "@/lib/db/migrate"
import {
	thinkingBlockArtifacts,
	thinkingBlockModelCalls,
	thinkingBlockRuns,
	thinkingBlockValidationResults,
} from "@/lib/db/schema"
import { check, judge, ThinkingBlock } from "@opsy/thinking-blocks"
import { thinkingBlockStore } from "@/thinking-blocks"

type MockGenerateResult = Awaited<ReturnType<MockLanguageModelV3["doGenerate"]>>

beforeAll(async () => {
	await migrate()
})

describe("ThinkingBlock", () => {
	test("Drizzle claim does not double-claim pending artifacts", async () => {
		const id = `unit-claim-${randomUUID()}`
		const identity = `unit:${id}`
		const artifact = await thinkingBlockStore.createArtifact({
			blockName: id,
			blockVersion: "v1",
			identity,
			input: { name: "claim" },
			createdAt: new Date(),
		})

		const [first, second] = await Promise.all([
			thinkingBlockStore.claimPendingArtifacts({
				blockName: id,
				blockVersion: "v1",
				limit: 1,
				claimedAt: new Date(),
			}),
			thinkingBlockStore.claimPendingArtifacts({
				blockName: id,
				blockVersion: "v1",
				limit: 1,
				claimedAt: new Date(),
			}),
		])

		expect([...first, ...second].map((row) => row.id)).toEqual([artifact.id])
		const row = await db.query.thinkingBlockArtifacts.findFirst({
			where: eq(thinkingBlockArtifacts.id, artifact.id),
		})
		expect(row?.status).toBe("running")
	})

	test("constructor runner transitions pending to running to ready", async () => {
		const id = `unit-runner-transition-${randomUUID()}`
		const input = { name: "transition" }
		const identity = `unit:${input.name}`
		const artifact = await thinkingBlockStore.createArtifact({
			blockName: id,
			blockVersion: "v1",
			identity,
			input,
			createdAt: new Date(),
		})
		const deferred = defer<void>()
		new ThinkingBlock<{ name: string }, string>({
			agent: new ToolLoopAgent({
				id,
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
			name: id,
			store: thinkingBlockStore,
			identity: (input) => `unit:${input.name}`,
			prepareCall: () => ({ prompt: "draft" }),
		})

		await eventually(async () => {
			const row = await db.query.thinkingBlockArtifacts.findFirst({
				where: eq(thinkingBlockArtifacts.id, artifact.id),
			})
			return row?.status === "running"
		})
		deferred.resolve()
		await eventually(async () => {
			const row = await db.query.thinkingBlockArtifacts.findFirst({
				where: eq(thinkingBlockArtifacts.id, artifact.id),
			})
			return row?.status === "ready"
		})
	})

	test("records a successful generated artifact and run", async () => {
		const id = `unit-success-${randomUUID()}`
		const block = new ThinkingBlock<{ name: string }, string>({
			agent: textAgent(id, ["ready"]),
			name: id,
			store: thinkingBlockStore,
			identity: (input) => `unit:${input.name}`,
			prepareCall: () => ({ prompt: "draft something" }),
		})

		const result = await block.generate(
			{ name: "alpha" },
			{ trigger: "unit_test" },
		)

		expect(result.ok).toBe(true)
		expect(result.ok && result.output).toBe("ready")
		const artifact = await db.query.thinkingBlockArtifacts.findFirst({
			where: eq(thinkingBlockArtifacts.id, result.artifactId),
		})
		expect(artifact).toMatchObject({
			blockName: id,
			blockVersion: "v1",
			identityKey: "unit:alpha",
			status: "ready",
			output: "ready",
		})

		const run = await db.query.thinkingBlockRuns.findFirst({
			where: eq(thinkingBlockRuns.id, result.runId!),
		})
		expect(run).toMatchObject({
			thinkingBlockArtifactId: result.artifactId,
			status: "success",
			trigger: "unit_test",
		})
		expect(run?.finishedAt).toBeInstanceOf(Date)
		expect(run?.durationMs).toBeGreaterThanOrEqual(0)
	})

	test("get cache-hits without creating another run", async () => {
		const id = `unit-cache-${randomUUID()}`
		const block = new ThinkingBlock<{ name: string }, string>({
			agent: textAgent(id, ["fresh"]),
			name: id,
			store: thinkingBlockStore,
			identity: (input) => `unit:${input.name}`,
			prepareCall: () => ({ prompt: "draft" }),
		})

		const generated = await block.get({ name: "beta" })
		const cached = await block.get({ name: "beta" })

		expect(generated.ok && generated.source).toBe("generated")
		expect(cached.ok && cached.source).toBe("cached")
		const runs = await db
			.select()
			.from(thinkingBlockRuns)
			.where(eq(thinkingBlockRuns.blockName, id))
		expect(runs).toHaveLength(1)
	})

	test("records failed artifacts and runs", async () => {
		const id = `unit-fail-${randomUUID()}`
		let calls = 0
		const model = new MockLanguageModelV3({
			provider: "mock",
			modelId: "mock-model",
			doGenerate: async () => {
				calls += 1
				throw new Error("planned failure")
			},
		})
		const block = new ThinkingBlock<{ name: string }, string>({
			agent: new ToolLoopAgent({ id, model, output: Output.text() }),
			name: id,
			store: thinkingBlockStore,
			identity: (input) => `unit:${input.name}`,
			prepareCall: () => ({ prompt: "draft" }),
		})

		await expect(block.generate({ name: "gamma" })).rejects.toThrow(
			"planned failure",
		)

		const artifact = await db.query.thinkingBlockArtifacts.findFirst({
			where: eq(thinkingBlockArtifacts.blockName, id),
		})
		const run = await db.query.thinkingBlockRuns.findFirst({
			where: eq(thinkingBlockRuns.blockName, id),
		})
		expect(artifact?.status).toBe("failed")
		expect(artifact?.error?.message).toBe("planned failure")
		expect(run?.status).toBe("failed")
		expect(run?.error?.message).toBe("planned failure")
		expect(calls).toBe(3)
	})

	test("operational failures retry up to three total runs", async () => {
		const id = `unit-retry-${randomUUID()}`
		let calls = 0
		const block = new ThinkingBlock<{ name: string }, string>({
			agent: new ToolLoopAgent({
				id,
				model: new MockLanguageModelV3({
					provider: "mock",
					modelId: "mock-model",
					doGenerate: async () => {
						calls += 1
						if (calls < 3) throw new Error(`planned failure ${calls}`)
						return mockTextResult("ready")
					},
				}),
				output: Output.text(),
			}),
			name: id,
			store: thinkingBlockStore,
			identity: (input) => `unit:${input.name}`,
			prepareCall: () => ({ prompt: "draft" }),
		})

		const result = await block.get({ name: "retry" })

		expect(result.ok).toBe(true)
		expect(result.ok && result.output).toBe("ready")
		expect(calls).toBe(3)
		const artifact = await db.query.thinkingBlockArtifacts.findFirst({
			where: eq(thinkingBlockArtifacts.id, result.artifactId),
		})
		expect(artifact?.status).toBe("ready")
		const runs = await db
			.select()
			.from(thinkingBlockRuns)
			.where(eq(thinkingBlockRuns.blockName, id))
			.orderBy(asc(thinkingBlockRuns.startedAt))
		expect(runs.map((run) => run.status)).toEqual([
			"failed",
			"failed",
			"success",
		])
	})

	test("rejected artifacts do not retry", async () => {
		const id = `unit-rejected-no-retry-${randomUUID()}`
		const block = new ThinkingBlock<{ name: string }, string>({
			agent: textAgent(id, ["", "", ""]),
			name: id,
			store: thinkingBlockStore,
			identity: (input) => `unit:${input.name}`,
			prepareCall: () => ({ prompt: "draft" }),
			validators: [
				check<{ name: string }, string>("has-text", {
					validate: ({ output }) =>
						output.length > 0 ? { success: true } : { success: false },
				}),
			],
		})

		const result = await block.get({ name: "reject" })

		expect(result.ok).toBe(false)
		const artifact = await db.query.thinkingBlockArtifacts.findFirst({
			where: eq(thinkingBlockArtifacts.id, result.artifactId),
		})
		expect(artifact?.status).toBe("rejected")
		const cached = await block.get({ name: "reject" }, { mode: "background" })
		expect(cached.artifactId).toBe(result.artifactId)
		expect(cached.status).toBe("rejected")
		const runs = await db
			.select()
			.from(thinkingBlockRuns)
			.where(eq(thinkingBlockRuns.blockName, id))
		expect(runs).toHaveLength(1)
	})

	test("records model calls, validation results, and rejection state", async () => {
		const id = `unit-validation-${randomUUID()}`
		const judgementSchema = z.object({
			accepted: z.boolean(),
			feedback: z.string().optional(),
		})
		const model = mockModel([
			"draft 1",
			JSON.stringify({ accepted: false, feedback: "not enough detail" }),
			"draft 2",
			JSON.stringify({ accepted: false, feedback: "not enough detail" }),
			"draft 3",
			JSON.stringify({ accepted: false, feedback: "not enough detail" }),
		])
		const block = new ThinkingBlock<{ name: string }, string>({
			agent: new ToolLoopAgent({
				id: `${id}-draft`,
				model,
				output: Output.text(),
			}),
			name: id,
			store: thinkingBlockStore,
			identity: (input) => `unit:${input.name}`,
			prepareCall: () => ({ prompt: "draft something" }),
			validators: [
				check<{ name: string }, string>("has-text", {
					validate: ({ output }) =>
						output.length > 0 ? { success: true } : { success: false },
				}),
				judge<{ name: string }, string, z.infer<typeof judgementSchema>>(
					"quality",
					{
						agent: new ToolLoopAgent({
							id: `${id}-judge`,
							model,
							output: Output.object({ schema: judgementSchema }),
						}),
						schema: judgementSchema,
						prepareCall: ({ output }) => ({ prompt: `judge ${output}` }),
						validate: ({ judgement }) =>
							judgement.accepted
								? { success: true }
								: { success: false, feedback: judgement.feedback },
					},
				),
			],
		})

		const result = await block.generate({ name: "delta" })

		expect(result.ok).toBe(false)
		if (result.ok) throw new Error("expected rejection")
		const runId = result.runId
		if (!runId)
			throw new Error("expected generated rejection to include run id")
		expect(result.reason).toBe("validation_failed")
		const artifact = await db.query.thinkingBlockArtifacts.findFirst({
			where: eq(thinkingBlockArtifacts.id, result.artifactId),
		})
		const run = await db.query.thinkingBlockRuns.findFirst({
			where: eq(thinkingBlockRuns.id, runId),
		})
		expect(artifact?.status).toBe("rejected")
		expect(artifact?.rejection).toMatchObject({
			reason: "validation_failed",
			output: "draft 3",
		})
		expect(run?.status).toBe("rejected")
		expect(run?.rejectionReason).toBe("validation_failed")

		const calls = await db
			.select()
			.from(thinkingBlockModelCalls)
			.where(eq(thinkingBlockModelCalls.thinkingBlockRunId, runId))
			.orderBy(asc(thinkingBlockModelCalls.stepIndex))
		expect(calls.map((call) => call.role)).toEqual([
			"generate",
			"judge",
			"generate",
			"judge",
			"generate",
			"judge",
		])
		expect(calls.map((call) => call.stepIndex)).toEqual([0, 1, 2, 3, 4, 5])
		expect(calls.every((call) => call.blockName === id)).toBe(true)

		const validations = await db
			.select()
			.from(thinkingBlockValidationResults)
			.where(and(eq(thinkingBlockValidationResults.thinkingBlockRunId, runId)))
		const validationsById = new Map(
			validations.map((validation) => [validation.validatorId, validation]),
		)
		expect(validationsById.get("has-text")).toMatchObject({
			validatorId: "has-text",
			validatorType: "check",
			status: "pass",
		})
		expect(validationsById.get("quality")).toMatchObject({
			validatorId: "quality",
			validatorType: "model",
			status: "fail",
			feedback: "not enough detail",
		})
	})
})

function textAgent(id: string, outputs: string[]) {
	return new ToolLoopAgent({
		id,
		model: mockModel(outputs),
		output: Output.text(),
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
		content: [{ type: "text" as const, text }],
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

async function eventually(pass: () => Promise<boolean>): Promise<void> {
	for (let i = 0; i < 100; i++) {
		if (await pass()) return
		await new Promise((resolve) => setTimeout(resolve, 5))
	}
	expect(await pass()).toBe(true)
}
