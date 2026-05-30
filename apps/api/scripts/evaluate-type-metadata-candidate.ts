import { createAzure } from "@ai-sdk/azure"
import type { ResourceTypeSchema } from "@opsy/provider"
import {
	type LanguageModelUsage,
	Output,
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
	type GeneratedResourceTypeDisplayMetadata,
	generatedResourceTypeDisplayMetadataSchema,
	RESOURCE_TYPE_DISPLAY_METADATA_BLOCK_NAME,
	RESOURCE_TYPE_DISPLAY_METADATA_BLOCK_VERSION,
	RESOURCE_TYPE_DISPLAY_METADATA_CANDIDATE_MODEL,
	RESOURCE_TYPE_DISPLAY_METADATA_FIELD_OPTIONS,
	RESOURCE_TYPE_DISPLAY_METADATA_INSTRUCTIONS,
	resourceTypeDisplayMetadataBlock,
} from "../src/resources/artifacts/metadata"
import { collectSchemaPromptFields } from "../src/resources/types/promptFields"
import { thinkingBlockInputHash } from "../src/thinking-blocks"

resourceTypeDisplayMetadataBlock.stop()

const candidateAzure = createAzure({
	apiKey: env.AZURE_OPENAI_API_KEY,
	resourceName: env.AZURE_OPENAI_RESOURCE_NAME,
})

type Args = {
	provider: string
	kind: CapabilitySourceKind
	types: string[]
	limit: number
	model: string
	baselineBlockVersion: string
	timeoutMs: number
}

type EvaluationCase = {
	type: string
	schema: ResourceTypeSchema
	schemaHash: string
	baselineArtifactId: string | null
	baseline: GeneratedResourceTypeDisplayMetadata | null
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

function buildCandidateAgent(model: string) {
	return new ToolLoopAgent<
		never,
		ToolSet,
		ReturnType<typeof Output.object<GeneratedResourceTypeDisplayMetadata>>
	>({
		id: "resource-type-display-metadata-candidate",
		model: candidateAzure(model),
		instructions: RESOURCE_TYPE_DISPLAY_METADATA_INSTRUCTIONS,
		output: Output.object({
			schema: generatedResourceTypeDisplayMetadataSchema,
			name: "OpsyResourceTypeDisplayMetadataCandidate",
			description:
				"Candidate product name and card/chip footprint for one provider resource type.",
		}),
		maxOutputTokens: 1024,
		providerOptions: {
			azure: {
				strictJsonSchema: false,
				reasoningEffort: "low",
			},
		},
	})
}

function readArgs(argv: string[]): Args {
	const args: Args = {
		provider: "aws",
		kind: "resource",
		types: [],
		limit: 10,
		model: RESOURCE_TYPE_DISPLAY_METADATA_CANDIDATE_MODEL,
		baselineBlockVersion: RESOURCE_TYPE_DISPLAY_METADATA_BLOCK_VERSION,
		timeoutMs: 60_000,
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
				if (!Number.isInteger(value) || value < 1 || value > 50) {
					throw new Error("--limit must be between 1 and 50")
				}
				args.limit = value
				break
			}
			case "--model":
				args.model = next()
				break
			case "--baseline-block-version":
				args.baselineBlockVersion = next()
				break
			case "--timeout-ms": {
				const value = Number.parseInt(next(), 10)
				if (!Number.isInteger(value) || value < 1_000) {
					throw new Error("--timeout-ms must be at least 1000")
				}
				args.timeoutMs = value
				break
			}
			default:
				throw new Error(`unknown arg: ${arg}`)
		}
	}
	return args
}

async function recentReadyTypes(args: Args): Promise<string[]> {
	const rows = await db
		.select({ identityKey: thinkingBlockArtifacts.identityKey })
		.from(thinkingBlockArtifacts)
		.where(
			and(
				eq(
					thinkingBlockArtifacts.blockName,
					RESOURCE_TYPE_DISPLAY_METADATA_BLOCK_NAME,
				),
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

async function findReadyBaseline(input: {
	provider: string
	kind: CapabilitySourceKind
	type: string
	schemaHash: string
	baselineBlockVersion: string
}): Promise<Pick<EvaluationCase, "baseline" | "baselineArtifactId">> {
	const artifact = await db.query.thinkingBlockArtifacts.findFirst({
		where: and(
			eq(
				thinkingBlockArtifacts.blockName,
				RESOURCE_TYPE_DISPLAY_METADATA_BLOCK_NAME,
			),
			eq(thinkingBlockArtifacts.blockVersion, input.baselineBlockVersion),
			eq(thinkingBlockArtifacts.status, "ready"),
			eq(
				thinkingBlockArtifacts.identityKey,
				[input.provider, input.kind, input.type, input.schemaHash].join(":"),
			),
		),
	})
	if (!artifact) return { baseline: null, baselineArtifactId: null }
	const parsed = generatedResourceTypeDisplayMetadataSchema.safeParse(
		artifact.output,
	)
	return {
		baseline: parsed.success ? parsed.data : null,
		baselineArtifactId: artifact.id,
	}
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
					...(await findReadyBaseline({
						provider: args.provider,
						kind: args.kind,
						type,
						schemaHash: hash,
						baselineBlockVersion: args.baselineBlockVersion,
					})),
				}
			}),
		)
	).filter((item): item is EvaluationCase => item !== null)
}

async function evaluateCase(
	args: Args,
	item: EvaluationCase,
	candidateAgent: ReturnType<typeof buildCandidateAgent>,
) {
	if (!item.baseline) {
		return {
			type: item.type,
			status: "no_ready_baseline",
			schemaHash: item.schemaHash,
			baselineArtifactId: item.baselineArtifactId,
		}
	}
	const rootDescription = item.schema.identity.description ?? ""
	const prompt = JSON.stringify(
		{
			task: "Generate resource type display metadata.",
			provider: args.provider,
			providerVersion: null,
			kind: args.kind,
			type: item.type,
			rootDescription:
				rootDescription.length > 320
					? `${rootDescription.slice(0, 320).trimEnd()}...`
					: rootDescription,
			previousFeedback: null,
			fields: collectSchemaPromptFields(
				item.schema.identity.fields,
				RESOURCE_TYPE_DISPLAY_METADATA_FIELD_OPTIONS,
			),
		},
		null,
		2,
	)
	const raw = await generateWithTimeout({
		candidateAgent,
		prompt,
		timeoutMs: args.timeoutMs,
	})
	const candidate = generatedResourceTypeDisplayMetadataSchema.parse(raw.output)
	return {
		type: item.type,
		status:
			candidate.display === item.baseline.display
				? "display_match"
				: "display_mismatch",
		schemaHash: item.schemaHash,
		baselineArtifactId: item.baselineArtifactId,
		baseline: item.baseline,
		candidate: {
			model: args.model,
			output: candidate,
			modelSteps: raw.steps.length,
			promptChars:
				RESOURCE_TYPE_DISPLAY_METADATA_INSTRUCTIONS.length + prompt.length,
			usage: summarizeUsage(raw.totalUsage),
		},
		comparison: {
			displayMatch: candidate.display === item.baseline.display,
			nameMatch: candidate.name.trim() === item.baseline.name.trim(),
		},
	}
}

async function main() {
	const args = readArgs(Bun.argv.slice(2))
	const candidateAgent = buildCandidateAgent(args.model)
	await migrate()
	try {
		const cases = await loadEvaluationCases(args)
		const results = []
		for (const item of cases) {
			try {
				results.push(await evaluateCase(args, item, candidateAgent))
			} catch (err) {
				results.push({
					type: item.type,
					status: "candidate_error",
					schemaHash: item.schemaHash,
					baselineArtifactId: item.baselineArtifactId,
					candidate: { model: args.model, timeoutMs: args.timeoutMs },
					error: serializeError(err),
				})
			}
		}
		console.log(
			JSON.stringify(
				{
					candidate: {
						blockName: RESOURCE_TYPE_DISPLAY_METADATA_BLOCK_NAME,
						model: args.model,
						blockVersion: RESOURCE_TYPE_DISPLAY_METADATA_BLOCK_VERSION,
						baselineBlockVersion: args.baselineBlockVersion,
						timeoutMs: args.timeoutMs,
					},
					selectedTypes: cases.map((item) => item.type),
					results,
				},
				null,
				2,
			),
		)
	} finally {
		resourceTypeDisplayMetadataBlock.stop()
		await shutdownProviders()
	}
}

async function generateWithTimeout(input: {
	candidateAgent: ReturnType<typeof buildCandidateAgent>
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
		return await input.candidateAgent.generate({
			prompt: input.prompt,
			abortSignal: controller.signal,
		})
	} finally {
		clearTimeout(timer)
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

function serializeError(err: unknown) {
	if (err instanceof Error) {
		return { name: err.name, message: err.message }
	}
	return { message: String(err) }
}
