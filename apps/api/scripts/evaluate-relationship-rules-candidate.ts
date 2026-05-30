import { createAzure } from "@ai-sdk/azure"
import type { ResourceTypeSchema } from "@opsy/provider"
import {
	type LanguageModelUsage,
	Output,
	stepCountIs,
	ToolLoopAgent,
	type ToolSet,
} from "ai"
import { and, desc, eq } from "drizzle-orm"
import { db, shutdownDb } from "../src/lib/db/client"
import { migrate } from "../src/lib/db/migrate"
import {
	type CapabilitySourceKind,
	thinkingBlockArtifacts,
} from "../src/lib/db/schema"
import { env } from "../src/lib/env"
import { shutdownProviders } from "../src/lib/providers"
import {
	providerRefFromProviderName,
	providerRuntime,
} from "../src/provider-runtime"
import {
	findReadyRelationshipRules,
	findReadyRelationshipRulesInvolving,
	materializeRelationshipRules,
	RELATIONSHIP_RULES_BLOCK_NAME,
	RELATIONSHIP_RULES_BLOCK_VERSION,
	RELATIONSHIP_RULES_CANDIDATE_MODEL,
	RELATIONSHIP_RULES_INSTRUCTIONS,
	type RelationshipRulesArtifactOutput,
	type RelationshipRulesBlockInput,
	type RelationshipRulesLlmOutput,
	type RelationshipRuleValidationIssue,
	relationshipRulesBlock,
	relationshipRulesGenerationPrompt,
	relationshipRulesLlmSchema,
	validateRelationshipRuleIdentityUniqueness,
	validateRelationshipRulesProviderSchema,
} from "../src/resources/artifacts/relationship-rules"
import { thinkingBlockInputHash } from "../src/thinking-blocks"

relationshipRulesBlock.stop()

type Args = {
	provider: string
	kind: CapabilitySourceKind
	types: string[]
	limit: number
	model: string
	reasoningEffort: "low" | "medium" | "high"
	attempts: number
	baselineBlockVersion: string
	relationshipMemory: boolean
	relationshipMemoryBlockVersion: string | null
	compareRelationshipMemory: boolean
	timeoutMs: number
	summary: boolean
}

type EvaluationCase = {
	type: string
	schema: ResourceTypeSchema
	schemaHash: string
	baseline: Awaited<ReturnType<typeof findReadyRelationshipRules>> | null
}

type UsageSummary = {
	inputTokens?: number
	inputNoCacheTokens?: number
	cachedInputTokens?: number
	inputCacheWriteTokens?: number
	outputTokens?: number
	outputTextTokens?: number
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
		inputNoCacheTokens: usage?.inputTokenDetails?.noCacheTokens,
		cachedInputTokens: usage?.inputTokenDetails?.cacheReadTokens,
		inputCacheWriteTokens: usage?.inputTokenDetails?.cacheWriteTokens,
		outputTokens: usage?.outputTokens,
		outputTextTokens: usage?.outputTokenDetails?.textTokens,
		reasoningTokens: usage?.outputTokenDetails?.reasoningTokens,
		totalTokens: usage?.totalTokens,
	}
}

function addUsageSummary(a: UsageSummary, b: UsageSummary): UsageSummary {
	return {
		inputTokens: addTokenCount(a.inputTokens, b.inputTokens),
		inputNoCacheTokens: addTokenCount(
			a.inputNoCacheTokens,
			b.inputNoCacheTokens,
		),
		cachedInputTokens: addTokenCount(a.cachedInputTokens, b.cachedInputTokens),
		inputCacheWriteTokens: addTokenCount(
			a.inputCacheWriteTokens,
			b.inputCacheWriteTokens,
		),
		outputTokens: addTokenCount(a.outputTokens, b.outputTokens),
		outputTextTokens: addTokenCount(a.outputTextTokens, b.outputTextTokens),
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
		{ tools: ReturnType<typeof relationshipRulesGenerationPrompt>["tools"] },
		ToolSet,
		ReturnType<typeof Output.object<RelationshipRulesLlmOutput>>
	>({
		id: "resource-relationship-rules-candidate",
		model: candidateAzure(input.model),
		instructions: RELATIONSHIP_RULES_INSTRUCTIONS,
		output: Output.object({
			schema: relationshipRulesLlmSchema,
			name: "OpsyResourceRelationshipRulesCandidate",
			description:
				"Candidate artifact-only Terraform schema relationship rules with semantic roles.",
		}),
		stopWhen: stepCountIs(10),
		maxOutputTokens: 8192,
		providerOptions: {
			azure: {
				strictJsonSchema: false,
				reasoningEffort: input.reasoningEffort,
			},
		},
		prepareCall: ({ options, ...base }) => ({
			...base,
			tools: options?.tools,
		}),
	})
}

function readArgs(argv: string[]): Args {
	const args: Args = {
		provider: "aws",
		kind: "resource",
		types: [],
		limit: 5,
		model: RELATIONSHIP_RULES_CANDIDATE_MODEL,
		reasoningEffort: "low",
		attempts: 3,
		baselineBlockVersion: RELATIONSHIP_RULES_BLOCK_VERSION,
		relationshipMemory: true,
		relationshipMemoryBlockVersion: RELATIONSHIP_RULES_BLOCK_VERSION,
		compareRelationshipMemory: false,
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
			case "--limit": {
				const value = Number.parseInt(next(), 10)
				if (!Number.isInteger(value) || value < 1 || value > 25) {
					throw new Error("--limit must be between 1 and 25")
				}
				args.limit = value
				break
			}
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
			case "--baseline-block-version":
				args.baselineBlockVersion = next()
				break
			case "--relationship-memory-block-version":
				args.relationshipMemoryBlockVersion = next()
				break
			case "--no-relationship-memory":
				args.relationshipMemory = false
				break
			case "--compare-relationship-memory":
				args.compareRelationshipMemory = true
				break
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
	return args
}

async function recentReadyTypes(args: Args): Promise<string[]> {
	const rows = await db
		.select({
			identityKey: thinkingBlockArtifacts.identityKey,
			readyAt: thinkingBlockArtifacts.readyAt,
			createdAt: thinkingBlockArtifacts.createdAt,
		})
		.from(thinkingBlockArtifacts)
		.where(
			and(
				eq(thinkingBlockArtifacts.blockName, RELATIONSHIP_RULES_BLOCK_NAME),
				eq(thinkingBlockArtifacts.status, "ready"),
			),
		)
		.orderBy(
			desc(thinkingBlockArtifacts.readyAt),
			desc(thinkingBlockArtifacts.createdAt),
		)
		.limit(args.limit * 10)

	const types: string[] = []
	const seen = new Set<string>()
	for (const row of rows) {
		const [provider, kind, type] = row.identityKey.split(":")
		if (provider !== args.provider) continue
		if (kind !== args.kind) continue
		if (!type) continue
		if (seen.has(type)) continue
		seen.add(type)
		types.push(type)
		if (types.length >= args.limit) break
	}
	return types
}

async function loadEvaluationCases(args: Args): Promise<EvaluationCase[]> {
	const ref = providerRefFromProviderName(args.provider)
	const provider = await providerRuntime.require(ref)
	const types =
		args.types.length > 0 ? args.types : await recentReadyTypes(args)
	return (
		await Promise.all(
			types.map(async (type) => {
				const schema = await provider.getSchema(type, args.kind)
				if (!schema) return null
				const hash = thinkingBlockInputHash(schema.identity)
				return {
					type,
					schema,
					schemaHash: hash,
					baseline: await findReadyRelationshipRules({
						ref,
						kind: args.kind,
						type,
						schemaHash: hash,
						blockVersion: args.baselineBlockVersion,
					}),
				}
			}),
		)
	).filter((item): item is EvaluationCase => item !== null)
}

function relationshipRuleKey(
	rule: RelationshipRulesArtifactOutput["rules"][number],
): string {
	return [
		rule.source.kind,
		rule.source.type,
		rule.source.path,
		rule.target.kind,
		rule.target.type,
		rule.target.path,
		rule.relationship,
	].join("\0")
}

function compareRules(input: {
	baseline: RelationshipRulesArtifactOutput["rules"]
	candidate: RelationshipRulesArtifactOutput["rules"]
}) {
	const baselineKeys = new Set(input.baseline.map(relationshipRuleKey))
	const candidateKeys = new Set(input.candidate.map(relationshipRuleKey))
	return {
		exactMatch:
			baselineKeys.size === candidateKeys.size &&
			[...baselineKeys].every((key) => candidateKeys.has(key)),
		added: input.candidate.filter(
			(rule) => !baselineKeys.has(relationshipRuleKey(rule)),
		),
		removed: input.baseline.filter(
			(rule) => !candidateKeys.has(relationshipRuleKey(rule)),
		),
	}
}

async function evaluateCase(args: {
	provider: Awaited<ReturnType<typeof providerRuntime.require>>
	ref: ReturnType<typeof providerRefFromProviderName>
	kind: CapabilitySourceKind
	item: EvaluationCase
	candidateAgent: ReturnType<typeof buildCandidateAgent>
	candidateModel: string
	relationshipMemoryMode:
		| "with_relationship_memory"
		| "without_relationship_memory"
	maxAttempts: number
	relationshipMemory: boolean
	relationshipMemoryBlockVersion: string
	timeoutMs: number
}) {
	if (!args.item.baseline) {
		return {
			type: args.item.type,
			relationshipMemoryMode: args.relationshipMemoryMode,
			status: "no_ready_baseline",
			schemaHash: args.item.schemaHash,
		}
	}
	const blockInput = {
		ref: args.ref,
		provider: args.provider,
		kind: args.kind,
		type: args.item.type,
		schema: args.item.schema,
		schemaHash: args.item.schemaHash,
	} satisfies RelationshipRulesBlockInput
	const currentRelationships = args.relationshipMemory
		? await findReadyRelationshipRulesInvolving({
				ref: args.ref,
				provider: args.provider,
				kind: args.kind,
				type: args.item.type,
				schema: args.item.schema,
				schemaHash: args.item.schemaHash,
				blockVersion: args.relationshipMemoryBlockVersion,
				limit: 40,
			})
		: []
	const attempts = []
	let feedback: unknown
	let output: RelationshipRulesLlmOutput | null = null
	let modelSteps = 0
	let promptChars = 0
	let usage: UsageSummary = {}
	let providerIssues: RelationshipRuleValidationIssue[] = []
	let uniquenessIssues: RelationshipRuleValidationIssue[] = []
	for (let attempt = 1; attempt <= args.maxAttempts; attempt += 1) {
		const promptParts = relationshipRulesGenerationPrompt(
			blockInput,
			feedback,
			{
				currentRelationships,
			},
		)
		const raw = await generateWithTimeout({
			agent: args.candidateAgent,
			prompt: promptParts.prompt,
			options: promptParts,
			timeoutMs: args.timeoutMs,
		})
		output = relationshipRulesLlmSchema.parse(raw.output)
		const attemptUsage = summarizeUsage(raw.totalUsage)
		providerIssues = await validateRelationshipRulesProviderSchema({
			provider: args.provider,
			kind: args.kind,
			type: args.item.type,
			schema: args.item.schema,
			output,
		})
		uniquenessIssues = validateRelationshipRuleIdentityUniqueness({
			output,
		})
		modelSteps += raw.steps.length
		promptChars +=
			RELATIONSHIP_RULES_INSTRUCTIONS.length + promptParts.prompt.length
		usage = addUsageSummary(usage, attemptUsage)
		attempts.push({
			attempt,
			ruleCount: output.rules.length,
			modelSteps: raw.steps.length,
			usage: attemptUsage,
			providerIssueCount: providerIssues.length,
			uniquenessIssueCount: uniquenessIssues.length,
		})
		if (providerIssues.length === 0 && uniquenessIssues.length === 0) break
		feedback =
			providerIssues.length > 0
				? { issues: providerIssues }
				: { issues: uniquenessIssues }
	}
	if (!output) throw new Error("candidate did not produce output")
	const candidate = materializeRelationshipRules({ output })
	const effectiveRulesByKey = new Map(
		currentRelationships.map((rule) => [relationshipRuleKey(rule), rule]),
	)
	for (const rule of candidate.rules) {
		effectiveRulesByKey.set(relationshipRuleKey(rule), rule)
	}
	const effectiveRules = [...effectiveRulesByKey.values()]
	const comparison = compareRules({
		baseline: args.item.baseline.rules,
		candidate: effectiveRules,
	})
	const currentRelationshipKeys = new Set(
		currentRelationships.map(relationshipRuleKey),
	)
	return {
		type: args.item.type,
		relationshipMemoryMode: args.relationshipMemoryMode,
		status:
			providerIssues.length === 0 && uniquenessIssues.length === 0
				? "valid"
				: "invalid",
		schemaHash: args.item.schemaHash,
		baseline: {
			artifactId: args.item.baseline.artifactId,
			ruleCount: args.item.baseline.rules.length,
		},
		candidate: {
			model: args.candidateModel,
			relationshipMemory: args.relationshipMemory,
			relationshipMemoryBlockVersion: args.relationshipMemoryBlockVersion,
			ruleCount: candidate.rules.length,
			effectiveRuleCount: effectiveRules.length,
			currentRelationshipCount: currentRelationships.length,
			attempts,
			modelSteps,
			promptChars,
			usage,
			providerIssues,
			uniquenessIssues,
		},
		comparison: {
			...comparison,
			addedFromCurrentRelationships: comparison.added.filter((rule) =>
				currentRelationshipKeys.has(relationshipRuleKey(rule)),
			),
			addedNovel: comparison.added.filter(
				(rule) => !currentRelationshipKeys.has(relationshipRuleKey(rule)),
			),
		},
	}
}

function compactRule(rule: RelationshipRulesArtifactOutput["rules"][number]) {
	return `${rule.source.kind}.${rule.source.type}.${rule.source.path} -> ${rule.target.kind}.${rule.target.type}.${rule.target.path} (${rule.relationship})`
}

type RelationshipEvaluationResult = Awaited<ReturnType<typeof evaluateCase>>

function compactEvaluationResult(
	result: RelationshipEvaluationResult | Record<string, unknown>,
) {
	if (!("comparison" in result)) return result
	if (!("baseline" in result) || !("candidate" in result)) return result
	const typed = result as Extract<
		RelationshipEvaluationResult,
		{ comparison: unknown }
	>
	const candidate = typed.candidate
	const providerIssues = candidate.providerIssues ?? []
	const uniquenessIssues = candidate.uniquenessIssues ?? []
	return {
		type: typed.type,
		relationshipMemoryMode: typed.relationshipMemoryMode,
		status: typed.status,
		schemaHash: typed.schemaHash,
		baseline: typed.baseline,
		candidate: {
			model: candidate.model,
			relationshipMemory: candidate.relationshipMemory,
			relationshipMemoryBlockVersion: candidate.relationshipMemoryBlockVersion,
			ruleCount: candidate.ruleCount,
			effectiveRuleCount: candidate.effectiveRuleCount,
			currentRelationshipCount: candidate.currentRelationshipCount,
			attempts: candidate.attempts,
			modelSteps: candidate.modelSteps,
			promptChars: candidate.promptChars,
			usage: candidate.usage,
			providerIssueCount: providerIssues.length,
			uniquenessIssueCount: uniquenessIssues.length,
			providerIssues,
			uniquenessIssues,
		},
		comparison: {
			exactMatch: typed.comparison.exactMatch,
			addedCount: typed.comparison.added.length,
			removedCount: typed.comparison.removed.length,
			addedFromCurrentRelationshipCount:
				typed.comparison.addedFromCurrentRelationships?.length ?? 0,
			addedNovelCount: typed.comparison.addedNovel?.length ?? 0,
			added: typed.comparison.added.map(compactRule),
			addedFromCurrentRelationships:
				typed.comparison.addedFromCurrentRelationships?.map(compactRule) ?? [],
			addedNovel: typed.comparison.addedNovel?.map(compactRule) ?? [],
			removed: typed.comparison.removed.map(compactRule),
		},
	}
}

async function main() {
	const args = readArgs(Bun.argv.slice(2))
	const candidateAgent = buildCandidateAgent({
		model: args.model,
		reasoningEffort: args.reasoningEffort,
	})
	await migrate()
	try {
		const ref = providerRefFromProviderName(args.provider)
		const provider = await providerRuntime.require(ref)
		const cases = await loadEvaluationCases(args)
		const results = []
		const memoryBlockVersion =
			args.relationshipMemoryBlockVersion ?? RELATIONSHIP_RULES_BLOCK_VERSION
		const modes = args.compareRelationshipMemory
			? ([
					{
						label: "without_relationship_memory",
						relationshipMemory: false,
					},
					{
						label: "with_relationship_memory",
						relationshipMemory: true,
					},
				] as const)
			: ([
					{
						label: args.relationshipMemory
							? "with_relationship_memory"
							: "without_relationship_memory",
						relationshipMemory: args.relationshipMemory,
					},
				] as const)
		for (const item of cases) {
			for (const mode of modes) {
				try {
					results.push(
						await evaluateCase({
							provider,
							ref,
							kind: args.kind,
							item,
							candidateAgent,
							candidateModel: args.model,
							relationshipMemoryMode: mode.label,
							maxAttempts: args.attempts,
							relationshipMemory: mode.relationshipMemory,
							relationshipMemoryBlockVersion: memoryBlockVersion,
							timeoutMs: args.timeoutMs,
						}),
					)
				} catch (err) {
					results.push({
						type: item.type,
						relationshipMemoryMode: mode.label,
						status: "candidate_error",
						schemaHash: item.schemaHash,
						candidate: {
							model: args.model,
							blockVersion: RELATIONSHIP_RULES_BLOCK_VERSION,
							baselineBlockVersion: args.baselineBlockVersion,
							relationshipMemory: mode.relationshipMemory,
							relationshipMemoryBlockVersion: memoryBlockVersion,
							reasoningEffort: args.reasoningEffort,
							attempts: args.attempts,
							timeoutMs: args.timeoutMs,
						},
						error: serializeError(err),
					})
				}
			}
		}
		console.log(
			JSON.stringify(
				{
					candidate: {
						blockName: RELATIONSHIP_RULES_BLOCK_NAME,
						model: args.model,
						blockVersion: RELATIONSHIP_RULES_BLOCK_VERSION,
						baselineBlockVersion: args.baselineBlockVersion,
						relationshipMemory: args.relationshipMemory,
						relationshipMemoryBlockVersion: memoryBlockVersion,
						compareRelationshipMemory: args.compareRelationshipMemory,
						reasoningEffort: args.reasoningEffort,
						attempts: args.attempts,
						timeoutMs: args.timeoutMs,
					},
					selectedTypes: cases.map((item) => item.type),
					results: args.summary
						? results.map(compactEvaluationResult)
						: results,
				},
				null,
				2,
			),
		)
	} finally {
		relationshipRulesBlock.stop()
		await shutdownProviders()
	}
}

async function run() {
	try {
		await main()
	} catch (err) {
		console.error(err)
		process.exitCode = 1
	} finally {
		await shutdownDb()
	}
}

void run()

async function generateWithTimeout(input: {
	agent: ReturnType<typeof buildCandidateAgent>
	prompt: string
	options: ReturnType<typeof relationshipRulesGenerationPrompt>
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
			options: { tools: input.options.tools },
			abortSignal: controller.signal,
		})
	} finally {
		clearTimeout(timer)
	}
}

function serializeError(err: unknown) {
	if (err instanceof Error) {
		return {
			name: err.name,
			message: err.message,
		}
	}
	return { message: String(err) }
}
