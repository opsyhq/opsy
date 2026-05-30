import { createHash } from "node:crypto"
import { createAzure } from "@ai-sdk/azure"
import type { OpsyProvider, ResourceTypeSchema } from "@opsy/provider"
import type {
	ArtifactAdapter,
	ThinkingBlockArtifactStatus,
} from "@opsy/thinking-blocks"
import { Output, stepCountIs, ToolLoopAgent, type ToolSet } from "ai"
import { env } from "@/lib/env"
import { type ProviderRef, providerRuntime } from "@/provider-runtime"
import { check, ThinkingBlock } from "@opsy/thinking-blocks"
import { thinkingBlockStore } from "@/thinking-blocks"
import {
	collectSourceRelationshipPromptFields,
	getProviderSearchTools,
} from "./context"
import {
	getReadyRelationshipRules,
	getReadyRelationshipRulesInvolving,
} from "./query"
import {
	type ArtifactRelationshipRule,
	RELATIONSHIP_RULES_BLOCK_NAME,
	RELATIONSHIP_RULES_BLOCK_VERSION,
	type RelationshipRulesArtifactOutput,
	type RelationshipRulesLlmOutput,
	relationshipRulesArtifactSchema,
	relationshipRulesIdentityKey,
	relationshipRulesLlmSchema,
} from "./schema"
import {
	validateRelationshipRuleIdentityUniqueness,
	validateRelationshipRulesProviderSchema,
} from "./validators"

export const RELATIONSHIP_RULES_MODEL = "gpt-5.4"
export const RELATIONSHIP_RULES_CANDIDATE_MODEL = "gpt-5.4"

export type GenerationStatus =
	| "ready"
	| "missing"
	| "generating"
	| "failed"
	| "rejected"

function generationStatusFromArtifact(
	status: ThinkingBlockArtifactStatus | null,
): GenerationStatus {
	if (status === "ready") return "ready"
	if (status === "pending" || status === "running") return "generating"
	if (status === "failed") return "failed"
	if (status === "rejected") return "rejected"
	return "missing"
}

type RelationshipRulesPromptInput = {
	provider: OpsyProvider
	ref: ProviderRef
	kind: "resource" | "data"
	type: string
	schema: ResourceTypeSchema
	schemaHash: string
	rejectionFeedback?: string[]
}

export type RelationshipRulesBlockInput = Omit<
	RelationshipRulesPromptInput,
	"provider"
> & {
	provider?: OpsyProvider
}

const RELATIONSHIP_RULE_PROVIDER_OPTIONS = {
	azure: {
		strictJsonSchema: false,
		reasoningEffort: "low",
	},
}

export const RELATIONSHIP_RULES_INSTRUCTIONS =
	"Generate Terraform provider relationship rules for one supplied type as part of a shared relationship graph. A rule is directional: source is a field handle users use to choose, open, or bind the target; target is the field with the equal runtime handle value. Return rules with source {kind,type,path}, target {kind,type,path}, and relationship REFERENCE, SCOPE, ATTACHMENT, or ASSOCIATION.\n\n" +
	"Rules:\n" +
	"- Every emitted rule source is the supplied kind/type, using the supplied type token exactly.\n" +
	"- Paths are exact dotted schema paths with no array indexes.\n" +
	"- Use searchProviderTypes and getProviderTypeSchema only to identify and confirm the target for a supplied source field.\n" +
	"- Optional, required, and computed fields can all be handles. A source field may produce multiple rules only when the same handle targets multiple concrete provider types.\n\n" +
	"Current graph context:\n" +
	"- currentRelationships are ready rules already present in the graph for this supplied type. They already exist outside this output.\n" +
	"- Return only new rules whose source is a supplied field and whose binding is not already covered by currentRelationships.\n\n" +
	"Handle boundary:\n" +
	"- Emit rules for source fields that identify, select, attach to, scope into, or join another object.\n" +
	"- Runtime facts are handles only when this source type is the association/join object using that fact to bind endpoints.\n" +
	"- Own identity, status, address, name, endpoint, and other observed facts are sources only when used as handles by this source type.\n\n" +
	"Discovery:\n" +
	"- Walk supplied fields as source handles. For each field that stores another object's runtime handle, find the target type and target field with the equal value.\n" +
	"- Relationships where another type points at the supplied type belong to that other type's block and may appear in currentRelationships, not in this output.\n\n" +
	"Classification:\n" +
	"- Default to REFERENCE for ordinary object handles. Multi-value selections are REFERENCE unless the source is an explicit join object.\n" +
	"- Use ASSOCIATION when the source type is the explicit binding, join, or assignment object. Emit one ASSOCIATION edge from that source to each endpoint it binds. A field whose value is the identity of a binding object is also ASSOCIATION.\n" +
	"- Use ATTACHMENT when the source object is installed, allocated, mounted, plugged, or registered on exactly one active host/receiver.\n" +
	"- Use SCOPE only when the target is the lifecycle container or placement namespace where the source object exists, such as a parent network, subnet, account, project, cluster, region, zone, or namespace.\n" +
	"- Creation-time selection is not enough for SCOPE. Use REFERENCE when the target is a reusable input, allocation source, pool, key, secret, role, policy, template, image, or default object that the source uses but does not live inside.\n" +
	"- Names are hints, not proof. If lifecycle meaning is ambiguous, keep REFERENCE.\n\n" +
	"Direction:\n" +
	"- REFERENCE owner -> referenced object. SCOPE scoped object -> boundary. ATTACHMENT attached object -> host or receiver. ASSOCIATION join object -> bound endpoint.\n" +
	"- If the host stores an attached object's identity, use attached identity as source and host reference field as target. If the attached object stores host identity, use that handle as source and host identity as target.\n" +
	"- For child-to-host links, use the field storing host/collection identity, not the child's own identity.\n\n" +
	"Return an object with a rules array. If validation feedback is present, revise the affected bindings using the same source-handle-to-target-field model."

const azureOpenAI = createAzure({
	apiKey: env.AZURE_OPENAI_API_KEY,
	resourceName: env.AZURE_OPENAI_RESOURCE_NAME,
})

export function relationshipRulesGenerationPrompt(
	input: RelationshipRulesPromptInput,
	feedback?: unknown,
	options: { currentRelationships?: ArtifactRelationshipRule[] } = {},
) {
	const fields = collectSourceRelationshipPromptFields(
		input.schema.identity.fields,
	)
	const validationFeedback = [
		...(input.rejectionFeedback ?? []),
		...(Array.isArray(feedback) ? feedback : feedback ? [feedback] : []),
	].slice(0, 12)
	const currentRelationships = (options.currentRelationships ?? []).map(
		(rule) => ({
			key: rule.key,
			source: rule.source,
			target: rule.target,
			relationship: rule.relationship,
		}),
	)
	const tools = getProviderSearchTools(input.provider)
	return {
		prompt:
			"Generate field relationship rules for this Terraform type. Walk the supplied fields and emit only directional source-handle-to-target-field bindings.\n\n" +
			"Context:\n" +
			"```json\n" +
			`${JSON.stringify(
				{
					provider: input.ref.name,
					providerVersion: input.ref.version,
					kind: input.kind,
					type: input.type,
					schemaHash: input.schemaHash,
					validationFeedback,
					currentRelationships,
					fields,
				},
				null,
				2,
			)}\n` +
			"```",
		tools,
	}
}

const relationshipRulesGenerationOutput = Output.object({
	schema: relationshipRulesLlmSchema,
	name: "OpsyResourceRelationshipRules",
	description:
		"Artifact-only Terraform schema relationship rules with semantic roles.",
})

const relationshipRulesGenerationAgent = new ToolLoopAgent<
	{ tools: ToolSet },
	ToolSet,
	typeof relationshipRulesGenerationOutput
>({
	id: "resource-relationship-rules",
	model: azureOpenAI(RELATIONSHIP_RULES_MODEL),
	output: relationshipRulesGenerationOutput,
	stopWhen: stepCountIs(10),
	maxOutputTokens: 8192,
	providerOptions: RELATIONSHIP_RULE_PROVIDER_OPTIONS,
	prepareCall: ({ options, ...base }) => ({
		...base,
		tools: options?.tools,
	}),
})

export const relationshipRulesProviderSchemaValidator = check<
	RelationshipRulesBlockInput,
	RelationshipRulesLlmOutput
>("provider-schema", {
	validate: async ({ input, output }) => {
		const provider = await getRelationshipRulesProvider(input)
		const issues = await validateRelationshipRulesProviderSchema({
			provider,
			kind: input.kind,
			type: input.type,
			schema: input.schema,
			output,
		})
		return issues.length === 0
			? { success: true }
			: { success: false, feedback: { issues } }
	},
})

export const relationshipRulesIdentityUniquenessValidator = check<
	RelationshipRulesBlockInput,
	RelationshipRulesLlmOutput
>("identity-uniqueness", {
	validate: ({ output }) => {
		const issues = validateRelationshipRuleIdentityUniqueness({ output })
		return issues.length === 0
			? { success: true }
			: { success: false, feedback: { issues } }
	},
})

export function getRelationshipRulesArtifactOutput(input: {
	output: RelationshipRulesLlmOutput
}): RelationshipRulesArtifactOutput {
	return {
		rules: input.output.rules.map((rule) => ({
			key: createHash("sha256")
				.update(
					[
						rule.source.kind,
						rule.source.type,
						rule.source.path,
						rule.target.kind,
						rule.target.type,
						rule.target.path,
						rule.relationship,
					].join("\0"),
				)
				.digest("hex"),
			...rule,
		})),
	}
}

export const relationshipRulesArtifact = {
	async read({ artifact }) {
		if (artifact.output === null || artifact.output === undefined) {
			return null
		}
		const parsed = relationshipRulesArtifactSchema.safeParse(artifact.output)
		return parsed.success ? parsed.data : null
	},
	async commit({ output }) {
		return getRelationshipRulesArtifactOutput({ output })
	},
	async cleanup() {},
} satisfies ArtifactAdapter<
	RelationshipRulesLlmOutput,
	RelationshipRulesBlockInput,
	RelationshipRulesArtifactOutput
>

export const relationshipRulesBlock = new ThinkingBlock<
	RelationshipRulesBlockInput,
	RelationshipRulesLlmOutput,
	RelationshipRulesArtifactOutput
>({
	agent: relationshipRulesGenerationAgent,
	name: RELATIONSHIP_RULES_BLOCK_NAME,
	version: RELATIONSHIP_RULES_BLOCK_VERSION,
	instructions: RELATIONSHIP_RULES_INSTRUCTIONS,
	store: thinkingBlockStore,
	parallelism: 10,
	artifact: relationshipRulesArtifact,
	identity: (input) =>
		relationshipRulesIdentityKey({
			provider: input.ref.name,
			kind: input.kind,
			type: input.type,
			schemaHash: input.schemaHash,
		}),
	attempts: { max: 3 },
	prepareCall: async ({ input, feedback }) => {
		const provider = await getRelationshipRulesProvider(input)
		const currentRelationships = await getReadyRelationshipRulesInvolving({
			ref: input.ref,
			provider,
			kind: input.kind,
			type: input.type,
			schema: input.schema,
			schemaHash: input.schemaHash,
			limit: 40,
		})
		const promptParts = relationshipRulesGenerationPrompt(
			{ ...input, provider },
			feedback,
			{ currentRelationships },
		)
		return {
			prompt: promptParts.prompt,
			options: { tools: promptParts.tools },
		}
	},
	validators: [
		relationshipRulesProviderSchemaValidator,
		relationshipRulesIdentityUniquenessValidator,
	],
})

export async function startRelationshipRulesGeneration(input: {
	ref: ProviderRef
	kind: "resource" | "data"
	type: string
	schema: ResourceTypeSchema
	schemaHash: string
	trigger?: string
}): Promise<GenerationStatus> {
	const ready = await getReadyRelationshipRules({
		ref: input.ref,
		kind: input.kind,
		type: input.type,
		schemaHash: input.schemaHash,
	})
	if (ready) return "ready"
	const lookup = await relationshipRulesBlock.get(
		{
			ref: input.ref,
			kind: input.kind,
			type: input.type,
			schema: input.schema,
			schemaHash: input.schemaHash,
		},
		{
			mode: "background",
			trigger: input.trigger ?? "relationship_rules",
		},
	)
	return generationStatusFromArtifact(lookup.status)
}

async function getRelationshipRulesProvider(
	input: RelationshipRulesBlockInput,
): Promise<OpsyProvider> {
	if (input.provider) return input.provider
	return providerRuntime.require(input.ref)
}
