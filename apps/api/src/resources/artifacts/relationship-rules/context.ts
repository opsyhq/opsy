import { type Field, fieldFacts, type OpsyProvider } from "@opsy/provider"
import { tool } from "ai"
import { z } from "zod"
import {
	type CapabilitySourceKind,
	capabilitySourceKindValues,
} from "@/lib/db/schema"

type RelationshipPromptField = {
	path: string
	type: unknown
	required: boolean
	optional: boolean
	computed: boolean
	description?: string
}

export type RelationshipPromptTypeSchema = {
	type: string
	kind: CapabilitySourceKind
	fields: RelationshipPromptField[]
}

// Bounded, depth-limited field sample for a relationship prompt. Only
// attributes emit a row (verbatim cty type + facts); a block emits no row of
// its own and just recurses into its children, so block nesting is the only
// thing that costs a depth level. `limit` is a hard cap.
function collectRelationshipPromptFields(
	fields: Field[],
	limit: number,
	maxDepth: number,
): RelationshipPromptField[] {
	const out: RelationshipPromptField[] = []
	const visit = (nodes: Field[], depth: number) => {
		if (out.length >= limit || depth > maxDepth) return
		for (const field of nodes) {
			if (out.length >= limit) return
			if (field.kind === "attribute") {
				const facts = fieldFacts(field)
				out.push({
					path: field.name.path,
					type: field.type,
					required: facts.required,
					optional: facts.optional,
					computed: facts.computed,
					...(field.description ? { description: field.description } : {}),
				})
				continue
			}
			visit(field.children, depth + 1)
		}
	}
	visit(fields, 0)
	return out
}

export function collectSourceRelationshipPromptFields(
	fields: Field[],
): RelationshipPromptField[] {
	return collectRelationshipPromptFields(fields, 180, 4)
}

function collectTargetRelationshipPromptFields(
	fields: Field[],
): RelationshipPromptField[] {
	return collectRelationshipPromptFields(fields, 120, 2)
}

export async function searchProviderTypes(input: {
	provider: OpsyProvider
	query: string
	kind?: CapabilitySourceKind
	limit: number
}): Promise<Array<{ type: string; kind: CapabilitySourceKind }>> {
	const results = await input.provider.searchTypes({
		q: input.query,
		kind: input.kind ?? "both",
		limit: input.limit,
	})
	return results.results
		.flatMap((candidate) =>
			candidate.kinds.map((kind) => ({
				type: candidate.type,
				kind,
			})),
		)
		.slice(0, input.limit)
}

export async function getProviderTypeSchema(input: {
	provider: OpsyProvider
	type: string
	kind: CapabilitySourceKind
}): Promise<RelationshipPromptTypeSchema | null> {
	const schema = await input.provider.getSchema(input.type, input.kind)
	if (!schema) return null
	return {
		type: input.type,
		kind: input.kind,
		fields: collectTargetRelationshipPromptFields(schema.identity.fields),
	}
}

export function getProviderSearchTools(provider: OpsyProvider) {
	return {
		searchProviderTypes: tool({
			description:
				"Search same-provider Terraform resource and data source types by keyword before choosing a relationship target.",
			inputSchema: z.object({
				query: z.string().min(1),
				kind: z.enum(capabilitySourceKindValues).optional(),
				limit: z.number().int().min(1).max(25).default(10),
			}),
			execute: async ({ query, kind, limit }) => ({
				results: await searchProviderTypes({ provider, query, kind, limit }),
			}),
		}),
		getProviderTypeSchema: tool({
			description:
				"Inspect compact identity/output fields for one same-provider target type returned by searchProviderTypes.",
			inputSchema: z.object({
				type: z.string().min(1),
				kind: z.enum(capabilitySourceKindValues),
			}),
			execute: async ({ type, kind }) => ({
				schema: await getProviderTypeSchema({ provider, type, kind }),
			}),
		}),
	}
}
