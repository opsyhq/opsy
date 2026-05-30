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
import { resourceFieldLayoutValidator } from "./validators"

export const RESOURCE_FIELD_LAYOUT_BLOCK_NAME = "resource-field-layout"
// v2: the supplied field set now includes computed-only fields, so v1 layouts
// (generated without them) no longer cover every path — bump forces regen.
export const RESOURCE_FIELD_LAYOUT_BLOCK_VERSION = "v2"

export type LayoutRowSpec =
	| string
	| {
			title: string
			collapsed?: boolean
			rows: LayoutRowSpec[]
	  }

export type SectionSpec = {
	title: string
	rows: LayoutRowSpec[]
}

const layoutRowSchema: z.ZodType<LayoutRowSpec> = z.lazy(() =>
	z.union([
		z.string().min(1),
		z.strictObject({
			title: z.string().min(1),
			collapsed: z.boolean().optional(),
			rows: z.array(layoutRowSchema),
		}),
	]),
)

const sectionSchema = z.strictObject({
	title: z.string().min(1),
	rows: z.array(layoutRowSchema),
})

export const resourceFieldLayoutLlmSchema = z.strictObject({
	create: sectionSchema,
	sections: z.array(sectionSchema),
})

export type ResourceFieldLayoutLlmOutput = z.infer<
	typeof resourceFieldLayoutLlmSchema
>

// One fixed model in production. Tune the candidate via the eval script, then
// promote the winner here — the same workflow as relationship-rules.
export const RESOURCE_FIELD_LAYOUT_MODEL = "gpt-5.4"
export const RESOURCE_FIELD_LAYOUT_CANDIDATE_MODEL = "gpt-5.4"

export type ResourceFieldLayoutPromptField = {
	path: string
	terraformName: string
	type: unknown
	required: boolean
	optional: boolean
	computed: boolean
	repeatedObject: boolean
	description?: string
}

function isRepeatedObject(field: Field): boolean {
	if (field.kind === "block") {
		return (
			(field.nestingMode === "list" || field.nestingMode === "set") &&
			field.maxItems !== 1
		)
	}
	return (
		Array.isArray(field.type) &&
		(field.type[0] === "list" || field.type[0] === "set") &&
		Array.isArray(field.type[1]) &&
		field.type[1][0] === "object"
	)
}

function collectResourceFieldLayoutPromptFields(
	fields: Field[],
): ResourceFieldLayoutPromptField[] {
	return flattenResourceFieldTree(fields).map((field) => {
		const { required, optional, computed } = fieldFacts(field)
		return {
			path: field.name.path,
			terraformName: field.name.terraformName,
			type: fieldCtyType(field),
			required,
			optional,
			computed,
			repeatedObject: isRepeatedObject(field),
			...(field.description ? { description: field.description } : {}),
		}
	})
}

// Exactly what the block consumes: identity is provider/kind/type/schemaHash,
// the prompt is the derived fields. The source ResourceSchema is not carried
// forward — it would be dead weight in every persisted artifact input.
export type ResourceFieldLayoutInput = {
	provider: string
	kind: "resource" | "data"
	type: string
	schemaHash: string
	fields: ResourceFieldLayoutPromptField[]
}

const azureOpenAI = createAzure({
	apiKey: env.AZURE_OPENAI_API_KEY,
	resourceName: env.AZURE_OPENAI_RESOURCE_NAME,
})

export const RESOURCE_FIELD_LAYOUT_INSTRUCTIONS =
	"You are Opsy's Terraform resource form layout designer. " +
	"You arrange supplied Terraform field records into the create section and the edit sections of a resource form. " +
	"The supplied records are your only source of fields; use only their exact paths and place every supplied path. " +
	"A section is a workflow surface a user intentionally switches between, such as Details, Networking, or Storage — the way a real AWS or Vercel console form is split. A section must hold several scan-line fields or multiple groups; never promote a single lone group or a single concept to its own section. " +
	"Low-frequency Terraform-mechanics fields such as timeouts belong as a trailing row or group inside an existing section, never as their own headline section. Do not create a section for a tiny visual heading. " +
	"A string row is a top-level scan-line field in that section; the provider schema owns whether it renders as a scalar, object, repeated object, or relationship picker. " +
	"A group row is a collapsed secondary cluster that collects several related lower-frequency fields or one very dense provider concept; never wrap a single stray field just to add a heading. " +
	"Within every rows list, put all direct field rows first and all group rows after them: a field after a group reads like it belongs to that group. " +
	"Put common scan-line fields first inside a section: identity, relationship anchors, primary sizing/addressing/placement choices, tags, and dense object or repeated-object controls. " +
	"The edit sections are the complete surface and must together place every supplied path. The create section is a short curated first-touch subset, not a second complete copy. " +
	"Put in create only the required fields plus the few most common day-one creation choices — aim for a single screen, typically well under a dozen rows. " +
	"Never give the create section a catch-all or advanced group, and never enumerate optional, advanced, or nested child paths there: those paths are covered by the edit sections alone. A path placed only in an edit section is still fully covered. " +
	"Return an object with a create section and a sections array. If validation feedback is present, revise only the affected placement using the same model."

const resourceFieldLayoutAgent = new ToolLoopAgent({
	id: "resource-field-layout",
	model: azureOpenAI(RESOURCE_FIELD_LAYOUT_MODEL),
	output: Output.object({
		schema: resourceFieldLayoutLlmSchema,
		name: "OpsyResourceFieldLayout",
		description:
			"Create and edit section/group/row arrangement for a Terraform resource form.",
	}),
	stopWhen: stepCountIs(2),
	maxOutputTokens: 16384,
	providerOptions: {
		azure: {
			strictJsonSchema: false,
			reasoningEffort: "low",
		},
	},
})

export function resourceFieldLayoutPrompt(
	input: ResourceFieldLayoutInput,
	feedback?: unknown,
): string {
	const validationFeedback = (
		Array.isArray(feedback) ? feedback : feedback ? [feedback] : []
	).slice(0, 12)
	return (
		"Can you please arrange this resource form into a create section and edit sections using these supplied field records?\n\n" +
		"Context:\n" +
		"```json\n" +
		`${JSON.stringify({ fields: input.fields, validationFeedback }, null, 2)}\n` +
		"```"
	)
}

export const resourceFieldLayoutBlock = new ThinkingBlock<
	ResourceFieldLayoutInput,
	ResourceFieldLayoutLlmOutput
>({
	agent: resourceFieldLayoutAgent,
	name: RESOURCE_FIELD_LAYOUT_BLOCK_NAME,
	version: RESOURCE_FIELD_LAYOUT_BLOCK_VERSION,
	instructions: RESOURCE_FIELD_LAYOUT_INSTRUCTIONS,
	store: thinkingBlockStore,
	identity: (input) =>
		[input.provider, input.kind, input.type, input.schemaHash].join(":"),
	attempts: { max: 3 },
	prepareCall: ({ input, feedback }) => ({
		prompt: resourceFieldLayoutPrompt(input, feedback),
	}),
	validators: [resourceFieldLayoutValidator],
})

export function resourceFieldLayoutInput(input: {
	provider: string
	kind: "resource" | "data"
	type: string
	schema: ResourceTypeSchema
	schemaHash: string
}): ResourceFieldLayoutInput {
	const { schema, ...identity } = input
	return {
		...identity,
		fields: collectResourceFieldLayoutPromptFields(schema.identity.fields),
	}
}

