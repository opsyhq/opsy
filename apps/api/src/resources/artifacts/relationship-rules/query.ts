import type { OpsyProvider, ResourceTypeSchema } from "@opsy/provider"
import { and, desc, eq, sql } from "drizzle-orm"
import { getIntegrationsByIds } from "@/integrations"
import { db } from "@/lib/db/client"
import {
	type CapabilitySourceKind,
	type Resource,
	thinkingBlockArtifacts,
} from "@/lib/db/schema"
import {
	type ProviderRef,
	providerRefFromIntegration,
	providerRuntime,
} from "@/provider-runtime"
import { thinkingBlockInputHash } from "@opsy/thinking-blocks"
import { thinkingBlockStore } from "@/thinking-blocks"
import { relationshipRulesBlock } from "./block"
import {
	type ArtifactRelationshipRule,
	RELATIONSHIP_RULES_BLOCK_NAME,
	RELATIONSHIP_RULES_BLOCK_VERSION,
	type RelationshipRulesArtifactOutput,
	relationshipRulesArtifactSchema,
	relationshipRulesIdentityKey,
	relationshipRulesIdentityPrefix,
} from "./schema"
import { validateRelationshipRulesProviderSchema } from "./validators"

export async function getReadyRelationshipRules(input: {
	ref: ProviderRef
	kind: CapabilitySourceKind
	type: string
	schemaHash: string
	blockVersion?: string
}): Promise<{
	artifactId: string
	schemaHash: string
	rules: RelationshipRulesArtifactOutput["rules"]
} | null> {
	const artifact = await thinkingBlockStore.findActiveArtifact({
		blockName: RELATIONSHIP_RULES_BLOCK_NAME,
		blockVersion: input.blockVersion ?? RELATIONSHIP_RULES_BLOCK_VERSION,
		identity: relationshipRulesIdentityKey({
			provider: input.ref.name,
			kind: input.kind,
			type: input.type,
			schemaHash: input.schemaHash,
		}),
	})
	if (!artifact) return null
	const output = relationshipRulesArtifactSchema.safeParse(artifact.output)
	if (!output.success) return null
	return {
		artifactId: artifact.id,
		schemaHash: input.schemaHash,
		rules: output.data.rules,
	}
}

export async function getReadyRelationshipRulesInvolving(input: {
	ref: ProviderRef
	provider: OpsyProvider
	kind: CapabilitySourceKind
	type: string
	schema: ResourceTypeSchema
	schemaHash: string
	blockVersion?: string
	limit?: number
}): Promise<ArtifactRelationshipRule[]> {
	const rules: ArtifactRelationshipRule[] = []
	const seenRules = new Set<string>()
	const ready = await getReadyRelationshipRules({
		ref: input.ref,
		kind: input.kind,
		type: input.type,
		schemaHash: input.schemaHash,
		blockVersion: input.blockVersion,
	})
	if (ready) {
		for (const rule of ready.rules) {
			seenRules.add(rule.key)
			rules.push(rule)
		}
	}

	const identityPrefix = relationshipRulesIdentityPrefix({
		provider: input.ref.name,
		kind: input.kind,
		type: input.type,
	})

	const query = db
		.select({
			identityKey: thinkingBlockArtifacts.identityKey,
			output: thinkingBlockArtifacts.output,
			readyAt: thinkingBlockArtifacts.readyAt,
			createdAt: thinkingBlockArtifacts.createdAt,
		})
		.from(thinkingBlockArtifacts)
		.where(
			and(
				eq(thinkingBlockArtifacts.blockName, RELATIONSHIP_RULES_BLOCK_NAME),
				eq(
					thinkingBlockArtifacts.blockVersion,
					input.blockVersion ?? RELATIONSHIP_RULES_BLOCK_VERSION,
				),
				eq(thinkingBlockArtifacts.status, "ready"),
				sql`left(${thinkingBlockArtifacts.identityKey}, length(${identityPrefix})) = ${identityPrefix}`,
			),
		)
		.orderBy(
			desc(thinkingBlockArtifacts.readyAt),
			desc(thinkingBlockArtifacts.createdAt),
		)
	const rows = await query.limit(
		Math.min(Math.max((input.limit ?? 40) * 4, 40), 200),
	)
	const seenArtifacts = new Set<string>()
	for (const row of rows) {
		if (seenArtifacts.has(row.identityKey)) continue
		const parsed = relationshipRulesArtifactSchema.safeParse(row.output)
		if (!parsed.success) continue
		seenArtifacts.add(row.identityKey)

		for (const rule of parsed.data.rules) {
			if (
				(rule.source.kind !== input.kind || rule.source.type !== input.type) &&
				(rule.target.kind !== input.kind || rule.target.type !== input.type)
			) {
				continue
			}
			const issues = await validateRelationshipRulesProviderSchema({
				provider: input.provider,
				kind: input.kind,
				type: input.type,
				schema: input.schema,
				output: { rules: [rule] },
				sourceMustBeGeneratedType: false,
			})
			if (issues.length > 0) continue

			if (seenRules.has(rule.key)) continue
			seenRules.add(rule.key)
			rules.push(rule)
			if (input.limit && rules.length >= input.limit) return rules
		}
	}
	return rules
}

type RelationshipRulesTypeContext = {
	typeKey: string
	ref: ProviderRef
	provider: OpsyProvider
	kind: CapabilitySourceKind
	type: string
	schema: ResourceTypeSchema
	schemaHash: string
}

// One context per distinct (provider, kind, type, schemaHash) across a
// project's provider-backed resources, plus the row→type map. Shared by the
// edge pass (rule resolution) and the graph view (generation status) so both
// see the exact same identities the block self-start kicks off.
export async function getRelationshipRuleInputsByResource(
	projectId: string,
	rows: Array<Pick<Resource, "id" | "provider" | "type" | "integrationId">>,
): Promise<{
	contexts: RelationshipRulesTypeContext[]
	rowTypeKey: Map<string, string>
}> {
	const providerBacked = rows.filter(
		(row) => !!row.provider && !!row.integrationId,
	)
	if (providerBacked.length === 0)
		return { contexts: [], rowTypeKey: new Map() }

	const integrationIds = Array.from(
		new Set(
			providerBacked.flatMap((row) =>
				row.integrationId ? [row.integrationId] : [],
			),
		),
	)
	const integrationsById = await getIntegrationsByIds(projectId, integrationIds)

	const contexts = new Map<string, RelationshipRulesTypeContext>()
	const rowTypeKey = new Map<string, string>()

	// `kind` is a provider concept, not a row attribute: every managed row is a
	// provider "resource" (data sources are a separate domain/table).
	const kind: CapabilitySourceKind = "resource"
	for (const row of providerBacked) {
		if (!row.integrationId) continue
		const integration = integrationsById.get(row.integrationId)
		if (!integration) continue
		try {
			const ref = providerRefFromIntegration(integration)
			const provider = await providerRuntime.require(ref)
			const schema = await provider.getSchema(row.type, kind)
			if (!schema) continue
			const hash = thinkingBlockInputHash(schema.identity)
			const typeKey = [
				ref.source,
				ref.name,
				ref.version,
				kind,
				row.type,
				hash,
			].join(":")
			rowTypeKey.set(row.id, typeKey)
			if (!contexts.has(typeKey)) {
				contexts.set(typeKey, {
					typeKey,
					ref,
					provider,
					kind,
					type: row.type,
					schema,
					schemaHash: hash,
				})
			}
		} catch {
			// Unresolved rows fall through to an empty rule set.
		}
	}

	return { contexts: [...contexts.values()], rowTypeKey }
}

export async function getReadyRelationshipRulesByResource(
	projectId: string,
	rows: Resource[],
): Promise<Map<string, ArtifactRelationshipRule[]>> {
	const { contexts, rowTypeKey } = await getRelationshipRuleInputsByResource(
		projectId,
		rows,
	)
	if (contexts.length === 0) return new Map()

	// Canvas is the only consumer of rule output (edges), so the generation
	// trigger lives here in the edge pass. getMany self-starts background
	// generation per distinct type and dedupes by identity.
	await relationshipRulesBlock
		.getMany(
			contexts.map((ctx) => ({
				ref: ctx.ref,
				kind: ctx.kind,
				type: ctx.type,
				schema: ctx.schema,
				schemaHash: ctx.schemaHash,
			})),
			{ mode: "background", trigger: "edge_pass" },
		)
		.catch(() => undefined)

	// Identity-prefix harvest per distinct type: exact-hash artifact contributes
	// all rules, same-type stale-hash artifacts are involvement/schema filtered.
	const rulesByType = await Promise.all(
		contexts.map((ctx) =>
			getReadyRelationshipRulesInvolving({
				ref: ctx.ref,
				provider: ctx.provider,
				kind: ctx.kind,
				type: ctx.type,
				schema: ctx.schema,
				schemaHash: ctx.schemaHash,
			}),
		),
	)
	const rulesByTypeKey = new Map(
		contexts.map((ctx, index) => [ctx.typeKey, rulesByType[index]]),
	)

	const rulesByResource = new Map<string, ArtifactRelationshipRule[]>()
	for (const [rowId, typeKey] of rowTypeKey) {
		rulesByResource.set(rowId, rulesByTypeKey.get(typeKey) ?? [])
	}
	return rulesByResource
}
