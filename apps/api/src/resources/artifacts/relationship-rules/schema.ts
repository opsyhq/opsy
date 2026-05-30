import { z } from "zod"
import {
	capabilitySourceKindValues,
	resourceRoleValues,
} from "@/lib/db/schema"

export const RELATIONSHIP_RULES_BLOCK_NAME = "resource-relationship-rules"
export const RELATIONSHIP_RULES_BLOCK_VERSION = "v1"

export type RelationshipRuleRole = (typeof resourceRoleValues)[number]
export type RelationshipRuleIdentityInput = {
	provider: string
	kind: (typeof capabilitySourceKindValues)[number]
	type: string
	schemaHash: string
}

export function relationshipRulesIdentityKey(
	input: RelationshipRuleIdentityInput,
): string {
	return [input.provider, input.kind, input.type, input.schemaHash].join(":")
}

export function relationshipRulesIdentityPrefix(
	input: Omit<RelationshipRuleIdentityInput, "schemaHash">,
): string {
	return [input.provider, input.kind, input.type, ""].join(":")
}

export const relationshipEndpointSchema = z.object({
	kind: z.enum(capabilitySourceKindValues),
	type: z.string().min(1),
	path: z.string().min(1),
})

export const relationshipRuleCandidateSchema = z
	.object({
		source: relationshipEndpointSchema,
		target: relationshipEndpointSchema,
		relationship: z.enum(resourceRoleValues),
	})
	.strip()

export const relationshipRulesLlmSchema = z.object({
	rules: z.array(relationshipRuleCandidateSchema).max(80),
})

const artifactRelationshipRuleSchema = relationshipRuleCandidateSchema.extend({
	key: z.string().min(1),
})

export const relationshipRulesArtifactSchema = z.object({
	rules: z.array(artifactRelationshipRuleSchema).max(80),
})

export type RelationshipRulesLlmOutput = z.infer<
	typeof relationshipRulesLlmSchema
>
export type ArtifactRelationshipRule = z.infer<
	typeof artifactRelationshipRuleSchema
>
export type RelationshipRulesArtifactOutput = z.infer<
	typeof relationshipRulesArtifactSchema
>
export type RelationshipEndpoint = z.infer<typeof relationshipEndpointSchema>
