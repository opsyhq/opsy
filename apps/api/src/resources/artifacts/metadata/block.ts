import { createAzure } from "@ai-sdk/azure"
import {
	type Field,
	fieldCtyType,
	fieldFacts,
	type ResourceTypeSchema,
} from "@opsy/provider"
import { Output, ToolLoopAgent } from "ai"
import { z } from "zod"
import { env } from "@/lib/env"
import { check, ThinkingBlock } from "@opsy/thinking-blocks"
import { thinkingBlockStore } from "@/thinking-blocks"

export const RESOURCE_TYPE_DISPLAY_METADATA_BLOCK_NAME =
	"resource-type-metadata"
export const RESOURCE_TYPE_DISPLAY_METADATA_BLOCK_VERSION = "v1"
export const RESOURCE_TYPE_DISPLAY_METADATA_MODEL = "gpt-5.4-mini"
export const RESOURCE_TYPE_DISPLAY_METADATA_CANDIDATE_MODEL = "gpt-5.4-mini"

export const generatedResourceTypeDisplayMetadataSchema = z.object({
	name: z.string().min(1),
	display: z.enum(["card", "chip"]),
})

export type GeneratedResourceTypeDisplayMetadata = z.infer<
	typeof generatedResourceTypeDisplayMetadataSchema
>

export type ResourceTypeDisplay = z.infer<
	typeof generatedResourceTypeDisplayMetadataSchema
>["display"]

export type ResourceTypeDisplayMetadataInput = {
	provider: string
	providerVersion: string | null
	kind: "resource" | "data"
	type: string
	schema: ResourceTypeSchema
	schemaHash: string
}

type ValidationFeedbackIssue = {
	path: string
	message: string
	value: unknown
	expected?: string
}

type TypePromptField = {
	path: string
	type?: unknown
	block?: true
	nesting?: string
	minItems?: number
	maxItems?: number
	required?: boolean
	optional?: boolean
	computed?: boolean
	sensitive?: boolean
	description?: string
	deprecated?: boolean
}

export function collectSchemaPromptFields(
	fields: Field[],
	options: {
		limit?: number
		maxDepth?: number
		descriptionLimit?: number
		typeLimit?: number
	} = {},
): TypePromptField[] {
	const limit = options.limit ?? 140
	const maxDepth = options.maxDepth ?? 3
	const { descriptionLimit, typeLimit } = options
	const out: TypePromptField[] = []
	const clip = (value: string, max: number | undefined): string =>
		max !== undefined && value.length > max
			? `${value.slice(0, max).trimEnd()}...`
			: value
	const visit = (nodes: Field[], depth: number) => {
		if (out.length >= limit || depth > maxDepth) return
		for (const field of nodes) {
			if (out.length >= limit) return
			const description = field.description
			if (field.kind === "attribute") {
				const cty = fieldCtyType(field)
				const type = typeof cty === "string" ? cty : JSON.stringify(cty)
				const facts = fieldFacts(field)
				out.push({
					path: field.name.path,
					type: typeLimit !== undefined ? clip(type, typeLimit) : type,
					required: facts.required,
					optional: facts.optional,
					computed: facts.computed,
					sensitive: facts.sensitive,
					...(description
						? { description: clip(description, descriptionLimit) }
						: {}),
					deprecated: facts.deprecated,
				})
				continue
			}
			out.push({
				path: field.name.path,
				block: true,
				nesting: field.nestingMode,
				...(field.minItems ? { minItems: field.minItems } : {}),
				...(field.maxItems !== null ? { maxItems: field.maxItems } : {}),
				...(description
					? { description: clip(description, descriptionLimit) }
					: {}),
			})
			visit(field.children, depth + 1)
		}
	}
	visit(fields, 0)
	return out
}

export const RESOURCE_TYPE_DISPLAY_METADATA_INSTRUCTIONS =
	"Classify how users would mentally place one Terraform provider type in an architecture diagram. " +
	'Return a human-facing product name and display as exactly "card" or "chip". ' +
	"Use only the supplied Terraform type, root description, and field sample. " +
	"Choose card for primary diagram subjects users arrange resources around: network boundaries, containers, compute runtimes, user-facing services, load entry points, or application/business data stores. " +
	"Choose chip for supporting resources that configure, secure, route, connect, observe, bind, retain, or modify another resource or edge. " +
	"Network gateway resources that only provide ingress or egress plumbing are chips; do not treat them like user-facing load entry points. " +
	"Operational resources such as logging, monitoring, policy, routing, attachment, association, listener, rule, and gateway helpers are usually chips even when named, durable, or managed. " +
	"Examples: VPCs, subnets, clusters, services, load balancers, buckets, queues, and databases are cards; NAT gateways, log groups, alarms, routes, rules, listeners, policy attachments, and endpoint associations are chips. " +
	"When unsure, choose chip."

export const RESOURCE_TYPE_DISPLAY_METADATA_FIELD_OPTIONS = {
	limit: 16,
	maxDepth: 0,
	descriptionLimit: 120,
	typeLimit: 80,
}

const azureOpenAI = createAzure({
	apiKey: env.AZURE_OPENAI_API_KEY,
	resourceName: env.AZURE_OPENAI_RESOURCE_NAME,
})

const resourceTypeDisplayMetadataAgent = new ToolLoopAgent({
	id: "resource-type-display-metadata",
	model: azureOpenAI(RESOURCE_TYPE_DISPLAY_METADATA_MODEL),
	output: Output.object({
		schema: generatedResourceTypeDisplayMetadataSchema,
		name: "OpsyResourceTypeDisplayMetadata",
		description: "Product name and card/chip footprint for one provider type.",
	}),
	maxOutputTokens: 1024,
	providerOptions: {
		azure: {
			strictJsonSchema: false,
			reasoningEffort: "low",
		},
	},
})

export const resourceTypeDisplayMetadataBlock = new ThinkingBlock<
	ResourceTypeDisplayMetadataInput,
	GeneratedResourceTypeDisplayMetadata
>({
	agent: resourceTypeDisplayMetadataAgent,
	name: RESOURCE_TYPE_DISPLAY_METADATA_BLOCK_NAME,
	version: RESOURCE_TYPE_DISPLAY_METADATA_BLOCK_VERSION,
	instructions: RESOURCE_TYPE_DISPLAY_METADATA_INSTRUCTIONS,
	store: thinkingBlockStore,
	identity: (input) =>
		[input.provider, input.kind, input.type, input.schemaHash].join(":"),
	prepareCall: ({ input, feedback }) => {
		const rootDescription = input.schema.identity.description ?? ""
		return {
			prompt: JSON.stringify(
				{
					task: "Generate resource type display metadata.",
					provider: input.provider,
					providerVersion: input.providerVersion,
					kind: input.kind,
					type: input.type,
					rootDescription:
						rootDescription.length > 320
							? `${rootDescription.slice(0, 320).trimEnd()}...`
							: rootDescription,
					previousFeedback: feedback ?? null,
					fields: collectSchemaPromptFields(
						input.schema.identity.fields,
						RESOURCE_TYPE_DISPLAY_METADATA_FIELD_OPTIONS,
					),
				},
				null,
				2,
			),
		}
	},
	attempts: { max: 5 },
	validators: [
		check<
			ResourceTypeDisplayMetadataInput,
			GeneratedResourceTypeDisplayMetadata
		>("display-metadata-shape", {
			validate: ({ input, output }) => {
				const issues: ValidationFeedbackIssue[] = []
				if (output.name.trim() === input.type) {
					issues.push({
						path: "name",
						message:
							"Expected a human-facing name, but got the raw type token.",
						value: output.name,
						expected:
							"A product name derived from the provider/type/schema context.",
					})
				}
				return issues.length === 0
					? { success: true }
					: { success: false, feedback: { issues } }
			},
		}),
	],
})

