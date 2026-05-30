import {
	buildResourceReferenceFields,
	type Field,
	fieldFacts,
	flattenResourceFieldTree,
} from "@opsy/provider"
import type { ThinkingBlockLookup } from "@opsy/thinking-blocks"
import { getIntegrationsByIds } from "../integrations"
import type { CapabilitySourceKind } from "../lib/db/schema"
import { baseLogger } from "../lib/logger"
import { pickKindSchema } from "../schema/provider-catalog"
import { thinkingBlockInputHash } from "@opsy/thinking-blocks"
import {
	resourceFieldLayoutBlock,
	type ResourceFieldLayoutLlmOutput,
	resourceFieldLayoutInput,
} from "./artifacts/field-layout/block"
import {
	type GeneratedFieldMetadataData,
	type GeneratedFieldMetadataEntry,
	resourceFieldMetadataBlock,
	resourceFieldMetadataInput,
} from "./artifacts/field-metadata/block"
import {
	type GeneratedTypeIconData,
	resourceTypeIconBlock,
	resourceTypeIconWireData,
} from "./artifacts/icon/block"
import {
	type GeneratedResourceTypeDisplayMetadata,
	resourceTypeDisplayMetadataBlock,
} from "./artifacts/metadata/block"
import { relationshipRulesBlock } from "./artifacts/relationship-rules/block"
import { getReadyRelationshipRulesInvolving } from "./artifacts/relationship-rules/query"
import type { ArtifactRelationshipRule } from "./artifacts/relationship-rules/schema"

const artifactsLog = baseLogger.child({ component: "resources.artifacts" })

const RESOURCE_ARTIFACTS_TRIGGER = "resource_artifacts"

// Per-artifact lookup discipline: every field carries the same
// `{ status, data, error, artifactId }` shape that ThinkingBlock returns,
// with `data` reshaped to the wire type each consumer renders.
export type ResourceTypeArtifacts = {
	kind: CapabilitySourceKind
	type: string
	provider: string
	icon: ThinkingBlockLookup<GeneratedTypeIconData>
	metadata: ThinkingBlockLookup<GeneratedResourceTypeDisplayMetadata>
	fieldMetadata: ThinkingBlockLookup<GeneratedFieldMetadataData>
	relationshipRules: ThinkingBlockLookup<
		Record<string, ArtifactRelationshipRule[]>
	>
	fieldLayout: ThinkingBlockLookup<ResourceFieldLayoutLlmOutput>
}

export type ResourceDisplayArtifacts = ResourceTypeArtifacts

function settableInputPaths(fields: Field[]): Set<string> {
	const paths = new Set<string>()
	for (const field of flattenResourceFieldTree(fields)) {
		// Blocks are always settable inputs; attributes only when required or
		// optional (computed-only identity outputs are never reference holders).
		const { required, optional } = fieldFacts(field)
		if (field.kind === "block" || required || optional) {
			paths.add(field.name.path)
		}
	}
	return paths
}

function topLevelRequiredPaths(fields: Field[]): Set<string> {
	const paths = new Set<string>()
	for (const field of fields) {
		if (fieldFacts(field).required) paths.add(field.name.path)
	}
	return paths
}

function mergeFieldMetadata(
	llm: Record<string, GeneratedFieldMetadataEntry>,
	corePaths: Set<string>,
	referencePaths: Set<string>,
): GeneratedFieldMetadataData {
	// Fold schema-derived per-path flags (core, reference) into the LLM-derived
	// label/help/icon entries so consumers do one lookup by input path.
	const merged: Record<string, GeneratedFieldMetadataEntry> = {}
	const paths = new Set<string>([
		...Object.keys(llm),
		...corePaths,
		...referencePaths,
	])
	for (const path of paths) {
		const entry = llm[path] ?? { label: path }
		merged[path] = {
			...entry,
			...(corePaths.has(path) ? { core: true } : {}),
			...(referencePaths.has(path) ? { reference: true } : {}),
		}
	}
	return merged
}

function rulesByHolderPath(
	rules: ArtifactRelationshipRule[],
	settable: Set<string>,
	viewedKind: CapabilitySourceKind,
	viewedType: string,
): Record<string, ArtifactRelationshipRule[]> {
	const byPath: Record<string, ArtifactRelationshipRule[]> = {}
	for (const rule of rules) {
		// Rule orientation: source = holder, target = referent. Drop rules whose
		// source isn't a settable input on the holder schema — that's the visible
		// signal back to the prompt instead of silent auto-correction.
		if (rule.source.kind !== viewedKind || rule.source.type !== viewedType) {
			continue
		}
		if (!settable.has(rule.source.path)) continue
		const list = byPath[rule.source.path] ?? []
		list.push(rule)
		byPath[rule.source.path] = list
	}
	return byPath
}

export async function getResourceTypeArtifacts(input: {
	provider: string
	kind: CapabilitySourceKind
	type: string
}): Promise<ResourceTypeArtifacts | null> {
	try {
		const { ref, provider, schema } = await pickKindSchema(
			input.provider,
			input.type,
			input.kind,
		)
		const schemaHash = thinkingBlockInputHash(schema.identity)
		const metadataInput = {
			provider: input.provider,
			providerVersion: provider.info.version,
			kind: input.kind,
			type: input.type,
			schema,
			schemaHash,
		}
		const [
			iconLookup,
			metadataLookup,
			fieldMetadataLookup,
			fieldLayoutLookup,
			rulesLookup,
			rules,
		] = await Promise.all([
			resourceTypeIconBlock.get(
				{ provider: input.provider, type: input.type },
				{ mode: "background", trigger: RESOURCE_ARTIFACTS_TRIGGER },
			),
			resourceTypeDisplayMetadataBlock.get(metadataInput, {
				mode: "background",
				trigger: RESOURCE_ARTIFACTS_TRIGGER,
			}),
			resourceFieldMetadataBlock.get(resourceFieldMetadataInput(metadataInput), {
				mode: "background",
				trigger: RESOURCE_ARTIFACTS_TRIGGER,
			}),
			resourceFieldLayoutBlock.get(
				resourceFieldLayoutInput({
					provider: input.provider,
					kind: input.kind,
					type: input.type,
					schema,
					schemaHash,
				}),
				{ mode: "background", trigger: RESOURCE_ARTIFACTS_TRIGGER },
			),
			relationshipRulesBlock.get(
				{ ref, kind: input.kind, type: input.type, schema, schemaHash },
				{ mode: "background", trigger: RESOURCE_ARTIFACTS_TRIGGER },
			),
			getReadyRelationshipRulesInvolving({
				ref,
				provider,
				kind: input.kind,
				type: input.type,
				schema,
				schemaHash,
			}),
		])
		const settable = settableInputPaths(schema.identity.fields)
		const corePaths = topLevelRequiredPaths(schema.identity.fields)
		const referencePaths = new Set(
			buildResourceReferenceFields(schema.identity.fields),
		)
		return {
			provider: input.provider,
			kind: input.kind,
			type: input.type,
			icon: { ...iconLookup, data: resourceTypeIconWireData(iconLookup.data) },
			metadata: metadataLookup,
			fieldMetadata: {
				...fieldMetadataLookup,
				data: mergeFieldMetadata(
					fieldMetadataLookup.data?.fields ?? {},
					corePaths,
					referencePaths,
				),
			},
			relationshipRules: {
				...rulesLookup,
				data: rulesLookup.artifactId
					? rulesByHolderPath(rules, settable, input.kind, input.type)
					: null,
			},
			fieldLayout: fieldLayoutLookup,
		}
	} catch (err) {
		artifactsLog.warn(
			{ err, provider: input.provider, kind: input.kind, type: input.type },
			"resource type artifacts unavailable",
		)
		return null
	}
}

export async function getResourceDisplayArtifactsBySubjectId(
	projectId: string,
	subjects: Array<{
		id: string
		type?: string | null
		integrationId?: string | null
	}>,
): Promise<Map<string, ResourceTypeArtifacts | null>> {
	const integrationIds = Array.from(
		new Set(
			subjects.flatMap((subject) =>
				subject.integrationId ? [subject.integrationId] : [],
			),
		),
	)
	if (integrationIds.length === 0) return new Map()

	const integrationsById = await getIntegrationsByIds(projectId, integrationIds)

	const groups = new Map<
		string,
		{ provider: string; type: string; subjectIds: string[] }
	>()
	const kind: CapabilitySourceKind = "resource"
	for (const subject of subjects) {
		if (!subject.type || !subject.integrationId) continue
		const integration = integrationsById.get(subject.integrationId)
		if (!integration) continue
		const key = `${integration.provider}:${kind}:${subject.type}`
		const existing = groups.get(key)
		if (existing) {
			existing.subjectIds.push(subject.id)
			continue
		}
		groups.set(key, {
			provider: integration.provider,
			type: subject.type,
			subjectIds: [subject.id],
		})
	}

	const entries = Array.from(groups.values())
	const artifacts = await Promise.all(
		entries.map((group) =>
			getResourceTypeArtifacts({
				provider: group.provider,
				kind,
				type: group.type,
			}),
		),
	)
	const bySubjectId = new Map<string, ResourceTypeArtifacts | null>()
	entries.forEach((group, index) => {
		for (const subjectId of group.subjectIds) {
			bySubjectId.set(subjectId, artifacts[index])
		}
	})
	return bySubjectId
}
