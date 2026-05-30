import { createAzure } from "@ai-sdk/azure"
import {
	AthenaClient,
	GetQueryExecutionCommand,
	GetQueryResultsCommand,
	StartQueryExecutionCommand,
} from "@aws-sdk/client-athena"
import { HeadObjectCommand, S3Client } from "@aws-sdk/client-s3"
import type { ThinkingBlockIdentity } from "@opsy/thinking-blocks"
import { Output, stepCountIs, ToolLoopAgent, tool } from "ai"
import { z } from "zod"
import { env } from "@/lib/env"
import { check, ThinkingBlock } from "@opsy/thinking-blocks"
import { thinkingBlockStore } from "@/thinking-blocks"

export const resourceTypeIconSchema = z.object({
	assetKey: z.string().min(1).nullable(),
	reason: z.string().min(1).optional(),
})

export type ResourceTypeIcon = z.infer<typeof resourceTypeIconSchema>

export type ResourceTypeIconInput = {
	provider: string
	type: string
	friendlyName?: string
}

export const RESOURCE_TYPE_ICON_BLOCK_VERSION = "v1"
const ICON_METADATA_VERSION = "s3-metadata-v4"
let s3Client: S3Client | null = null
let athenaClient: AthenaClient | null = null

export const RESOURCE_TYPE_ICON_INSTRUCTIONS =
	"Choose an icon asset for one Terraform resource type. " +
	"The S3 inventory is the provider icon catalog mirrored as object keys. " +
	"Use queryAthenaSql to run SELECT queries against the configured S3 Metadata inventory table through Athena. " +
	"Query actual object key text only, using lower(key) for case-insensitive matching because catalog filenames may be mixed case. " +
	"Return one existing SVG object key from queryAthenaSql rows. Return null only after searching provider service, resource, category, acronym, and expanded-name terms and finding no truthful match. Do not invent keys."

const azureOpenAI = createAzure({
	apiKey: env.AZURE_OPENAI_API_KEY,
	resourceName: env.AZURE_OPENAI_RESOURCE_NAME,
})

const resourceTypeIconCallOptionsSchema = z.object({
	provider: z.string().min(1),
})

const resourceTypeIconAgent = new ToolLoopAgent({
	id: "resource-type-icon",
	model: azureOpenAI("gpt-5.4-mini"),
	output: Output.object({
		schema: resourceTypeIconSchema,
		name: "OpsyResourceTypeIcon",
		description: "S3 icon asset choice for one provider resource type.",
	}),
	callOptionsSchema: resourceTypeIconCallOptionsSchema,
	stopWhen: stepCountIs(10),
	maxRetries: 0,
	maxOutputTokens: 4096,
	providerOptions: {
		azure: {
			strictJsonSchema: false,
			reasoningEffort: "medium",
		},
	},
	prepareCall: ({ options, ...base }) => ({
		...base,
		tools: getResourceTypeIconTools(options.provider),
	}),
})

export function resourceTypeIconIdentity(
	input: ResourceTypeIconInput,
): ThinkingBlockIdentity {
	return [
		"resource-type-icon",
		input.provider,
		input.type,
		iconMetadataSetId(input.provider),
	].join(":")
}

export const resourceTypeIconAssetKeyValidator = check<
	ResourceTypeIconInput,
	ResourceTypeIcon
>("asset-key", {
	validate: async ({ input, output }) => {
		if (output.assetKey === null) return { success: true }
		const key = output.assetKey.trim().replace(/^\/+/, "")
		const feedback = {
			issues: [
				{
					path: "assetKey",
					message:
						"Asset key is not a canonical existing SVG under the configured S3 icon asset prefix.",
					value: output.assetKey,
					expected:
						"An existing SVG object key returned by queryAthenaSql without trimming, rewriting, or a leading slash; or null.",
				},
			],
		}
		if (output.assetKey !== key) return { success: false, feedback }
		if (!key.startsWith(`icons/${input.provider}/`) || !key.endsWith(".svg")) {
			return { success: false, feedback }
		}
		if (!env.OPSY_ASSETS_S3_BUCKET) return { success: false, feedback }
		try {
			await s3(env.OPSY_ASSETS_S3_REGION).send(
				new HeadObjectCommand({
					Bucket: env.OPSY_ASSETS_S3_BUCKET,
					Key: key,
				}),
			)
			return { success: true }
		} catch {
			return { success: false, feedback }
		}
	},
})

export const resourceTypeIconBlock = new ThinkingBlock<
	ResourceTypeIconInput,
	ResourceTypeIcon
>({
	agent: resourceTypeIconAgent,
	name: "resource-type-icon",
	version: RESOURCE_TYPE_ICON_BLOCK_VERSION,
	instructions: RESOURCE_TYPE_ICON_INSTRUCTIONS,
	store: thinkingBlockStore,
	parallelism: 5,
	identity: resourceTypeIconIdentity,
	prepareCall: ({ input, feedback }) => ({
		prompt: resourceTypeIconPrompt(input, feedback),
		options: { provider: input.provider },
	}),
	attempts: { max: 5 },
	validators: [resourceTypeIconAssetKeyValidator],
})

export function resourceTypeIconPrompt(
	input: ResourceTypeIconInput,
	feedback?: unknown,
): string {
	const displayName = input.friendlyName ?? input.type
	return JSON.stringify(
		{
			task: "Choose an S3 icon asset for this resource type.",
			catalog: "Provider icon catalog mirrored into S3 object keys.",
			provider: input.provider,
			type: input.type,
			displayName,
			athena: {
				table: env.OPSY_ASSETS_S3_BUCKET
					? `"s3tablescatalog/aws-s3"."b_${env.OPSY_ASSETS_S3_BUCKET}"."inventory"`
					: null,
				providerPrefix: `icons/${input.provider}/`,
				constraints: [
					"SELECT only",
					"SVG object keys",
					"LIMIT 50 or less",
					"Use lower(key) for case-insensitive matching",
				],
			},
			validationFeedback: feedback ?? null,
			selectionPolicy: [
				"Choose only from object keys returned by queryAthenaSql.",
				"Prefer provider-specific resource icons for concrete Terraform resources when a clear resource asset exists.",
				"Prefer 48px catalog assets for node icons when a truthful 48px option exists.",
				"Prefer the exact or shortest catalog filename/resource noun match over broader service icons or more specific adjacent variants.",
				"Treat extra catalog qualifiers as mismatches unless the resource type or display name also contains that concept.",
				"Avoid mutually exclusive variants unless the resource type or display name includes that qualifier; prefer the broader truthful icon instead.",
				"When no exact resource icon exists, prefer the generic service icon over a neighboring product, feature, integration, or deployment variant.",
				"If the same truthful icon exists in several sizes, choose the 48px object key.",
				"Search with lowercase comparisons over service words, resource words, acronyms, and likely expanded names from the Terraform type/display name.",
				"Return null only after provider catalog searches do not produce a truthful match.",
			],
			instructions:
				"Use queryAthenaSql to inspect actual S3 object keys from the provider icon catalog. Use the table and providerPrefix values from the athena object in SQL, with SVG keys and LIMIT 50 or less. Use lower(key) in WHERE clauses for case-insensitive matching. Search with terms that help find a clear provider catalog filename/path match; refine across resource, service, category, group, and general icon folders when those concepts exist in the catalog. For short Terraform tokens or acronyms, search likely expanded provider catalog terms before falling back to generic service icons. When several rows match, prefer truthful exact resource/group/general icons, then truthful service icons; avoid smaller sizes when a 48px option exists, avoid wrong-service exact nouns, avoid mutually exclusive variants when the type is generic, and avoid compound variants when a simpler exact resource noun exists. Extra filename words that are not implied by the Terraform type or display name should make a candidate less relevant, not more relevant. Address validationFeedback directly when present. Return assetKey exactly as listed in a returned row, or null only if no truthful provider catalog match exists. Do not invent or rewrite keys.",
		},
		null,
		2,
	)
}

function iconMetadataSetId(provider: string): string {
	if (!env.OPSY_ASSETS_S3_BUCKET) return "unconfigured"
	return [
		ICON_METADATA_VERSION,
		env.OPSY_ASSETS_S3_BUCKET,
		`icons/${provider}/`,
	].join(":")
}

function s3(region: string): S3Client {
	if (!s3Client) s3Client = new S3Client({ region })
	return s3Client
}

export type GeneratedTypeIconData = {
	assetKey: string | null
	url: string | null
}

// Pairs the LLM-chosen asset key with the public URL derived from the
// configured S3 bucket. Returns null when the LLM result is absent so the
// wire lookup carries `data: null` instead of a half-populated record.
export function resourceTypeIconWireData(
	data: ResourceTypeIcon | null,
): GeneratedTypeIconData | null {
	if (!data) return null
	const assetKey = data.assetKey
	const url =
		assetKey && env.OPSY_ASSETS_S3_BUCKET
			? `https://${env.OPSY_ASSETS_S3_BUCKET}.s3.${env.OPSY_ASSETS_S3_REGION}.amazonaws.com/${assetKey
					.trim()
					.replace(/^\/+/, "")
					.split("/")
					.map(encodeURIComponent)
					.join("/")}`
			: null
	return { assetKey, url }
}

const queryAthenaSqlInputSchema = z.object({
	sql: z
		.string()
		.trim()
		.min(1)
		.max(4_000)
		.describe(
			"Read-only Athena SQL SELECT over the S3 Metadata inventory table.",
		),
})

function getResourceTypeIconTools(provider: string) {
	return {
		queryAthenaSql: tool({
			description:
				"Run read-only Athena SQL against the configured S3 Metadata inventory table for icon object keys. Queries must be SELECT-only, include the provider prefix, include LIMIT 50 or less, and should use lower(key) for case-insensitive filename searches.",
			inputSchema: queryAthenaSqlInputSchema,
			execute: async (input) => {
				if (!env.OPSY_ASSETS_S3_BUCKET) {
					return { error: "OPSY_ASSETS_S3_BUCKET is not configured." }
				}
				const prefix = `icons/${provider}/`
				const sql = validateAthenaIconQuery(input.sql, prefix)
				if ("error" in sql) return sql

				const queryExecutionId = await startQuery({
					bucket: env.OPSY_ASSETS_S3_BUCKET,
					region: env.OPSY_ASSETS_S3_REGION,
					sql: sql.value,
				})
				await waitForQuery(queryExecutionId, env.OPSY_ASSETS_S3_REGION)
				return {
					rows: await readRows(queryExecutionId, env.OPSY_ASSETS_S3_REGION),
				}
			},
		}),
	}
}

async function startQuery(input: {
	bucket: string
	region: string
	sql: string
}): Promise<string> {
	const response = await athena(input.region).send(
		new StartQueryExecutionCommand({
			QueryString: input.sql,
			QueryExecutionContext: {
				Catalog: "s3tablescatalog/aws-s3",
				Database: `b_${input.bucket}`,
			},
			ResultConfiguration: {
				OutputLocation: `s3://${input.bucket}/athena-results/`,
			},
		}),
	)
	if (!response.QueryExecutionId) {
		throw new Error("Athena did not return a query execution id")
	}
	return response.QueryExecutionId
}

async function waitForQuery(
	queryExecutionId: string,
	region: string,
): Promise<void> {
	const deadline = Date.now() + 20_000
	while (Date.now() < deadline) {
		const response = await athena(region).send(
			new GetQueryExecutionCommand({ QueryExecutionId: queryExecutionId }),
		)
		const status = response.QueryExecution?.Status
		const state = status?.State
		if (state === "SUCCEEDED") return
		if (state === "FAILED" || state === "CANCELLED") {
			throw new Error(
				`Athena metadata query ${state.toLowerCase()}: ${status?.StateChangeReason ?? "unknown reason"}`,
			)
		}
		await new Promise((resolve) => setTimeout(resolve, 250))
	}
	throw new Error("Athena metadata query timed out")
}

async function readRows(queryExecutionId: string, region: string) {
	const response = await athena(region).send(
		new GetQueryResultsCommand({ QueryExecutionId: queryExecutionId }),
	)
	const columns =
		response.ResultSet?.ResultSetMetadata?.ColumnInfo?.map((column) =>
			String(column.Label ?? column.Name ?? ""),
		) ?? []
	return (response.ResultSet?.Rows ?? [])
		.slice(1)
		.map((row) =>
			Object.fromEntries(
				(row.Data ?? []).map((value, index) => [
					columns[index] || `column_${index + 1}`,
					value.VarCharValue ?? null,
				]),
			),
		)
}

function athena(region: string): AthenaClient {
	if (!athenaClient) athenaClient = new AthenaClient({ region })
	return athenaClient
}

function validateAthenaIconQuery(
	input: string,
	providerPrefix: string,
): { value: string } | { error: string } {
	const sql = input.trim().replace(/;+\s*$/, "")
	const lower = sql.toLowerCase()
	if (!lower.startsWith("select ")) {
		return { error: "Only SELECT statements are allowed." }
	}
	if (sql.includes(";")) return { error: "Only one SQL statement is allowed." }
	if (forbiddenSqlPattern.test(lower)) {
		return { error: "Only read-only SELECT queries are allowed." }
	}
	if (!lower.includes("inventory")) {
		return { error: "Query must read from the S3 Metadata inventory table." }
	}
	if (!sql.includes(providerPrefix)) {
		return {
			error: `Query must constrain results to provider prefix ${providerPrefix}.`,
		}
	}
	const limit = /\blimit\s+(\d+)\b/i.exec(sql)?.[1]
	if (!limit) return { error: "Query must include LIMIT 50 or less." }
	if (Number(limit) > 50) {
		return { error: "Query LIMIT must be 50 or less." }
	}
	return { value: sql }
}

const forbiddenSqlPattern =
	/\b(insert|update|delete|drop|create|alter|truncate|merge|unload|msck|repair|call|grant|revoke)\b/
