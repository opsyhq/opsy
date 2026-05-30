import { createAzure } from "@ai-sdk/azure"
import {
	type Field,
	fieldCtyType,
	fieldFacts,
	flattenResourceFieldTree,
	type ResourceTypeSchema,
} from "@opsy/provider"
import { Output, stepCountIs, ToolLoopAgent } from "ai"
import { z } from "zod"
import { env } from "@/lib/env"
import { ThinkingBlock } from "@opsy/thinking-blocks"
import { thinkingBlockStore } from "@/thinking-blocks"
import { getResourceFieldMetadataTools } from "./iconify"
import { resourceFieldMetadataValidator } from "./validators"

export const RESOURCE_FIELD_METADATA_BLOCK_NAME = "resource-field-metadata"
// v2: the supplied field set now includes computed-only fields, so v1 metadata
// (generated without them) lacks their labels/help — bump forces regen.
export const RESOURCE_FIELD_METADATA_BLOCK_VERSION = "v2"

export const RESOURCE_FIELD_LABEL_MAX_LENGTH = 80
export const RESOURCE_FIELD_HELP_MAX_LENGTH = 180
export const RESOURCE_FIELD_ICON_PATTERN = /^lucide:[a-z0-9]+(?:-[a-z0-9]+)*$/

// The LLM emits only label/help/icon; core/reference are schema-derived and
// merged in server-side (see mergeFieldMetadata in resources/artifacts.ts).
// Both flags are optional on the wire so renderers can do a single per-path
// lookup without branching on origin.
const resourceFieldMetadataLlmFieldSchema = z.strictObject({
	label: z.string().min(1).max(RESOURCE_FIELD_LABEL_MAX_LENGTH),
	help: z.string().min(1).max(RESOURCE_FIELD_HELP_MAX_LENGTH).optional(),
	icon: z.string().regex(RESOURCE_FIELD_ICON_PATTERN).optional(),
})

const resourceFieldMetadataFieldSchema = resourceFieldMetadataLlmFieldSchema.extend({
	core: z.boolean().optional(),
	reference: z.boolean().optional(),
})

export const resourceFieldMetadataSchema = z.strictObject({
	fields: z.record(z.string().min(1), resourceFieldMetadataFieldSchema),
})

export const resourceFieldMetadataLlmSchema = z.strictObject({
	fields: z.record(z.string().min(1), resourceFieldMetadataLlmFieldSchema),
})

export type ResourceFieldMetadataLlmOutput = z.infer<
	typeof resourceFieldMetadataLlmSchema
>
export type GeneratedResourceFieldMetadata = z.infer<
	typeof resourceFieldMetadataSchema
>

export type ResourceFieldMetadataPromptField = {
	path: string
	terraformName: string
	type: unknown
	required: boolean
	optional: boolean
	computed: boolean
	sensitive: boolean
	deprecated: boolean
	description?: string
	deprecationMessage?: string
}

function collectResourceFieldMetadataPromptFields(
	fields: Field[],
): ResourceFieldMetadataPromptField[] {
	return flattenResourceFieldTree(fields).map((field) => ({
		path: field.name.path,
		terraformName: field.name.terraformName,
		type: fieldCtyType(field),
		...fieldFacts(field),
		...(field.description ? { description: field.description } : {}),
		...(field.deprecationMessage
			? { deprecationMessage: field.deprecationMessage }
			: {}),
	}))
}

// Exactly what the block consumes: identity is provider/kind/type/schemaHash,
// the prompt is the derived fields. The source schema is not carried forward —
// it would be dead weight (the whole field tree) in every persisted input.
export type ResourceFieldMetadataInput = {
	provider: string
	providerVersion: string | null
	kind: "resource" | "data"
	type: string
	schemaHash: string
	fields: ResourceFieldMetadataPromptField[]
}

type ResourceFieldMetadataResult = {
	artifactId: string
	schemaHash: string
	metadata: GeneratedResourceFieldMetadata
}

export type GeneratedFieldMetadataEntry = z.infer<
	typeof resourceFieldMetadataFieldSchema
>

export type GeneratedFieldMetadataData = Record<string, GeneratedFieldMetadataEntry>

const azureOpenAI = createAzure({
	apiKey: env.AZURE_OPENAI_API_KEY,
	resourceName: env.AZURE_OPENAI_RESOURCE_NAME,
})

const RESOURCE_FIELD_METADATA_INSTRUCTIONS =
	"You are Opsy's Terraform field metadata curator. " +
	"You turn supplied Terraform field records into concise form labels, genuinely useful form help, and occasional field icons. " +
	"The supplied records are your only source of field facts. " +
	"The result is a fields object keyed only by supplied path, with { label, help?, icon? } values. " +
	"Labels are concise, but preserve enough path meaning that labels like ids do not lose their subject. " +
	"Help is one short sentence that helps someone decide what value to enter, where that value should come from, or what practical effect setting the field has. " +
	"Write help for complex fields, reference IDs, networking or security fields, sensitive fields, deprecated fields, nested fields, and fields whose operational choice is not obvious from the label. " +
	"Do not write help that merely expands the field name, repeats the label, repeats the type, or restates the Terraform description. " +
	"For reference ID fields, explain the choice or relationship being configured instead of saying that the field is an ID. " +
	"If the supplied records do not support practical guidance, omit help for that field. " +
	"Icons are optional quick visual anchors, not decoration for every row. " +
	"Use searchLucideIcons to inspect Iconify's Lucide collection before choosing an icon, and return only exact lucide:* ids from the tool results. " +
	"Choose icons tastefully for fields with clear visual concepts such as compute, storage, networking, security, identity, region, tags, lifecycle, monitoring, or code/configuration. " +
	"Omit icon when the field is generic, self-evident, or no searched Lucide result clearly fits."

const resourceFieldMetadataAgent = new ToolLoopAgent({
	id: "resource-field-metadata",
	model: azureOpenAI("gpt-5.4-mini"),
	output: Output.object({
		schema: resourceFieldMetadataLlmSchema,
		name: "OpsyResourceFieldMetadata",
		description:
			"Labels, optional actionable help, and optional Lucide icons for Terraform resource fields.",
	}),
	stopWhen: stepCountIs(8),
	maxOutputTokens: 8192,
	providerOptions: {
		azure: {
			strictJsonSchema: false,
			reasoningEffort: "low",
		},
	},
	tools: getResourceFieldMetadataTools(),
})

export const resourceFieldMetadataBlock = new ThinkingBlock<
	ResourceFieldMetadataInput,
	ResourceFieldMetadataLlmOutput
>({
	agent: resourceFieldMetadataAgent,
	name: RESOURCE_FIELD_METADATA_BLOCK_NAME,
	version: RESOURCE_FIELD_METADATA_BLOCK_VERSION,
	instructions: RESOURCE_FIELD_METADATA_INSTRUCTIONS,
	store: thinkingBlockStore,
	identity: (input) =>
		[input.provider, input.kind, input.type, input.schemaHash].join(":"),
	prepareCall: ({ input }) => ({
		prompt: resourceFieldMetadataPrompt(input),
	}),
	validators: [resourceFieldMetadataValidator],
})

export function resourceFieldMetadataInput(input: {
	provider: string
	providerVersion: string | null
	kind: "resource" | "data"
	type: string
	schema: ResourceTypeSchema
	schemaHash: string
}): ResourceFieldMetadataInput {
	const { schema, ...identity } = input
	return {
		...identity,
		fields: collectResourceFieldMetadataPromptFields(schema.identity.fields),
	}
}

export function resourceFieldMetadataPrompt(
	input: ResourceFieldMetadataInput,
): string {
	return (
		"Can you please create field metadata for this form using these supplied field records?\n\n" +
		"Supplied field records:\n" +
		"```json\n" +
		`${JSON.stringify(input.fields, null, 2)}\n` +
		"```"
	)
}

export async function findReadyResourceFieldMetadata(input: {
	provider: string
	kind: "resource" | "data"
	type: string
	schemaHash: string
}): Promise<ResourceFieldMetadataResult | null> {
	const artifact = await thinkingBlockStore.findActiveArtifact({
		blockName: RESOURCE_FIELD_METADATA_BLOCK_NAME,
		blockVersion: RESOURCE_FIELD_METADATA_BLOCK_VERSION,
		identity: [input.provider, input.kind, input.type, input.schemaHash].join(
			":",
		),
	})
	if (!artifact) return null

	return {
		artifactId: artifact.id,
		schemaHash: input.schemaHash,
		metadata: resourceFieldMetadataSchema.parse(artifact.output),
	}
}

