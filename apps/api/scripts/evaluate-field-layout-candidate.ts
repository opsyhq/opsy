import { createAzure } from "@ai-sdk/azure"
import type { ResourceTypeSchema } from "@opsy/provider"
import {
	type LanguageModelUsage,
	Output,
	stepCountIs,
	ToolLoopAgent,
	type ToolSet,
} from "ai"
import { env } from "../src/lib/env"
import { shutdownProviders } from "../src/lib/providers"
import {
	providerRefFromProviderName,
	providerRuntime,
} from "../src/provider-runtime"
import {
	RESOURCE_FIELD_LAYOUT_CANDIDATE_MODEL,
	RESOURCE_FIELD_LAYOUT_INSTRUCTIONS,
	resourceFieldLayoutBlock,
	resourceFieldLayoutInput,
	resourceFieldLayoutPrompt,
} from "../src/resources/artifacts/field-layout/block"
import {
	RESOURCE_FIELD_LAYOUT_BLOCK_NAME,
	RESOURCE_FIELD_LAYOUT_BLOCK_VERSION,
	type ResourceFieldLayoutLlmOutput,
	resourceFieldLayoutLlmSchema,
} from "../src/resources/artifacts/field-layout/schema"
import {
	fieldLayoutCoverage,
	validateResourceFieldLayoutPartition,
} from "../src/resources/artifacts/field-layout/validators"
import { thinkingBlockInputHash } from "../src/thinking-blocks"

resourceFieldLayoutBlock.stop()

type Args = {
	provider: string
	kind: "resource" | "data"
	types: string[]
	model: string
	reasoningEffort: "low" | "medium" | "high"
	attempts: number
	timeoutMs: number
	summary: boolean
}

type UsageSummary = {
	inputTokens?: number
	cachedInputTokens?: number
	outputTokens?: number
	reasoningTokens?: number
	totalTokens?: number
}

function addTokenCount(
	a: number | undefined,
	b: number | undefined,
): number | undefined {
	return a === undefined && b === undefined ? undefined : (a ?? 0) + (b ?? 0)
}

function summarizeUsage(usage: LanguageModelUsage | undefined): UsageSummary {
	return {
		inputTokens: usage?.inputTokens,
		cachedInputTokens: usage?.inputTokenDetails?.cacheReadTokens,
		outputTokens: usage?.outputTokens,
		reasoningTokens: usage?.outputTokenDetails?.reasoningTokens,
		totalTokens: usage?.totalTokens,
	}
}

function addUsageSummary(a: UsageSummary, b: UsageSummary): UsageSummary {
	return {
		inputTokens: addTokenCount(a.inputTokens, b.inputTokens),
		cachedInputTokens: addTokenCount(a.cachedInputTokens, b.cachedInputTokens),
		outputTokens: addTokenCount(a.outputTokens, b.outputTokens),
		reasoningTokens: addTokenCount(a.reasoningTokens, b.reasoningTokens),
		totalTokens: addTokenCount(a.totalTokens, b.totalTokens),
	}
}

const candidateAzure = createAzure({
	apiKey: env.AZURE_OPENAI_API_KEY,
	resourceName: env.AZURE_OPENAI_RESOURCE_NAME,
})

function buildCandidateAgent(input: {
	model: string
	reasoningEffort: Args["reasoningEffort"]
}) {
	return new ToolLoopAgent<
		never,
		ToolSet,
		ReturnType<typeof Output.object<ResourceFieldLayoutLlmOutput>>
	>({
		id: "resource-field-layout-candidate",
		model: candidateAzure(input.model),
		instructions: RESOURCE_FIELD_LAYOUT_INSTRUCTIONS,
		output: Output.object({
			schema: resourceFieldLayoutLlmSchema,
			name: "OpsyResourceFieldLayoutCandidate",
			description:
				"Candidate create and edit section/group/row arrangement for a Terraform resource form.",
		}),
		stopWhen: stepCountIs(2),
		maxOutputTokens: 16384,
		providerOptions: {
			azure: {
				strictJsonSchema: false,
				reasoningEffort: input.reasoningEffort,
			},
		},
	})
}

function readArgs(argv: string[]): Args {
	const args: Args = {
		provider: "aws",
		kind: "resource",
		types: [],
		model: RESOURCE_FIELD_LAYOUT_CANDIDATE_MODEL,
		reasoningEffort: "low",
		attempts: 3,
		timeoutMs: 120_000,
		summary: false,
	}
	for (let i = 0; i < argv.length; i += 1) {
		const arg = argv[i]
		const next = () => {
			const value = argv[i + 1]
			if (!value || value.startsWith("--")) throw new Error("missing value")
			i += 1
			return value
		}
		switch (arg) {
			case "--provider":
				args.provider = next()
				break
			case "--kind": {
				const value = next()
				if (value !== "resource" && value !== "data") {
					throw new Error("--kind must be resource or data")
				}
				args.kind = value
				break
			}
			case "--type":
				args.types.push(next())
				break
			case "--model":
				args.model = next()
				break
			case "--reasoning-effort": {
				const value = next()
				if (value !== "low" && value !== "medium" && value !== "high") {
					throw new Error("--reasoning-effort must be low, medium, or high")
				}
				args.reasoningEffort = value
				break
			}
			case "--attempts": {
				const value = Number.parseInt(next(), 10)
				if (!Number.isInteger(value) || value < 1 || value > 10) {
					throw new Error("--attempts must be between 1 and 10")
				}
				args.attempts = value
				break
			}
			case "--timeout-ms": {
				const value = Number.parseInt(next(), 10)
				if (!Number.isInteger(value) || value < 1_000) {
					throw new Error("--timeout-ms must be at least 1000")
				}
				args.timeoutMs = value
				break
			}
			case "--summary":
				args.summary = true
				break
			default:
				throw new Error(`unknown arg: ${arg}`)
		}
	}
	if (args.types.length === 0) args.types = ["aws_subnet", "aws_instance"]
	return args
}

async function generateWithTimeout(input: {
	agent: ReturnType<typeof buildCandidateAgent>
	prompt: string
	timeoutMs: number
}) {
	const controller = new AbortController()
	const timer = setTimeout(() => {
		controller.abort(
			new Error(`candidate timed out after ${input.timeoutMs}ms`),
		)
	}, input.timeoutMs)
	timer.unref?.()
	try {
		return await input.agent.generate({
			prompt: input.prompt,
			abortSignal: controller.signal,
		})
	} finally {
		clearTimeout(timer)
	}
}

async function evaluateCase(input: {
	provider: string
	kind: "resource" | "data"
	type: string
	schema: ResourceTypeSchema
	candidateAgent: ReturnType<typeof buildCandidateAgent>
	candidateModel: string
	maxAttempts: number
	timeoutMs: number
}) {
	const hash = thinkingBlockInputHash(input.schema.identity)
	const blockInput = resourceFieldLayoutInput({
		provider: input.provider,
		kind: input.kind,
		type: input.type,
		schema: input.schema,
		schemaHash: hash,
	})
	const attempts: Array<{
		attempt: number
		modelSteps: number
		usage: UsageSummary
		unplacedCount: number
		unplacedRequiredCount: number
		missingSpecCount: number
		partitionIssueCount: number
	}> = []
	let feedback: unknown
	let output: ResourceFieldLayoutLlmOutput | null = null
	let usage: UsageSummary = {}
	let coverage = fieldLayoutCoverage({
		fields: blockInput.fields,
		layout: { create: { title: "", rows: [] }, sections: [] },
	})
	let partitionIssues: ReturnType<typeof validateResourceFieldLayoutPartition> =
		[]
	for (let attempt = 1; attempt <= input.maxAttempts; attempt += 1) {
		const prompt = resourceFieldLayoutPrompt(blockInput, feedback)
		const raw = await generateWithTimeout({
			agent: input.candidateAgent,
			prompt,
			timeoutMs: input.timeoutMs,
		})
		output = resourceFieldLayoutLlmSchema.parse(raw.output)
		coverage = fieldLayoutCoverage({
			fields: blockInput.fields,
			layout: output,
		})
		partitionIssues = validateResourceFieldLayoutPartition({ layout: output })
		const attemptUsage = summarizeUsage(raw.totalUsage)
		usage = addUsageSummary(usage, attemptUsage)
		attempts.push({
			attempt,
			modelSteps: raw.steps.length,
			usage: attemptUsage,
			unplacedCount: coverage.unplacedPaths.length,
			unplacedRequiredCount: coverage.unplacedRequiredPaths.length,
			missingSpecCount: coverage.missingSpecPaths.length,
			partitionIssueCount: partitionIssues.length,
		})
		const aligned =
			coverage.unplacedPaths.length === 0 &&
			coverage.unplacedRequiredPaths.length === 0 &&
			coverage.missingSpecPaths.length === 0 &&
			partitionIssues.length === 0
		if (aligned) break
		feedback = {
			unplacedPaths: coverage.unplacedPaths,
			unplacedRequiredPaths: coverage.unplacedRequiredPaths,
			missingSpecPaths: coverage.missingSpecPaths,
			partitionIssues,
		}
	}
	if (!output) throw new Error("candidate did not produce output")
	const aligned =
		coverage.unplacedPaths.length === 0 &&
		coverage.unplacedRequiredPaths.length === 0 &&
		coverage.missingSpecPaths.length === 0 &&
		partitionIssues.length === 0
	return {
		type: input.type,
		status: aligned ? "aligned" : "misaligned",
		schemaHash: hash,
		writablePathCount: coverage.writablePaths.length,
		candidate: {
			model: input.candidateModel,
			attempts,
			usage,
			layout: output,
			coverage: {
				unplacedPaths: coverage.unplacedPaths,
				unplacedRequiredPaths: coverage.unplacedRequiredPaths,
				missingSpecPaths: coverage.missingSpecPaths,
				repeatedObjectPaths: coverage.repeatedObjectPaths,
			},
			partitionIssues,
		},
	}
}

async function main() {
	const args = readArgs(Bun.argv.slice(2))
	const candidateAgent = buildCandidateAgent({
		model: args.model,
		reasoningEffort: args.reasoningEffort,
	})
	try {
		const ref = providerRefFromProviderName(args.provider)
		const provider = await providerRuntime.require(ref)
		const results = []
		for (const type of args.types) {
			const schema = await provider.getSchema(type, args.kind)
			if (!schema) {
				results.push({ type, status: "no_schema" })
				continue
			}
			try {
				results.push(
					await evaluateCase({
						provider: args.provider,
						kind: args.kind,
						type,
						schema,
						candidateAgent,
						candidateModel: args.model,
						maxAttempts: args.attempts,
						timeoutMs: args.timeoutMs,
					}),
				)
			} catch (err) {
				results.push({
					type,
					status: "candidate_error",
					error: serializeError(err),
				})
			}
		}
		console.log(
			JSON.stringify(
				{
					candidate: {
						blockName: RESOURCE_FIELD_LAYOUT_BLOCK_NAME,
						blockVersion: RESOURCE_FIELD_LAYOUT_BLOCK_VERSION,
						model: args.model,
						reasoningEffort: args.reasoningEffort,
						attempts: args.attempts,
						timeoutMs: args.timeoutMs,
					},
					selectedTypes: args.types,
					results: args.summary
						? results.map((result) =>
								"candidate" in result
									? {
											type: result.type,
											status: result.status,
											unplacedCount:
												result.candidate.coverage.unplacedPaths.length,
											unplacedRequiredCount:
												result.candidate.coverage.unplacedRequiredPaths.length,
											missingSpecCount:
												result.candidate.coverage.missingSpecPaths.length,
											partitionIssueCount:
												result.candidate.partitionIssues.length,
											attempts: result.candidate.attempts.length,
											usage: result.candidate.usage,
										}
									: result,
							)
						: results,
				},
				null,
				2,
			),
		)
	} finally {
		resourceFieldLayoutBlock.stop()
		await shutdownProviders()
	}
}

async function run() {
	try {
		await main()
	} catch (err) {
		console.error(err)
		process.exitCode = 1
	}
}

void run()

function serializeError(err: unknown) {
	if (err instanceof Error) {
		return { name: err.name, message: err.message }
	}
	return { message: String(err) }
}
