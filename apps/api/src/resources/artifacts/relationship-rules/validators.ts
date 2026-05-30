import type {
	Field,
	OpsyProvider,
	ProviderType,
	ResourceTypeSchema,
} from "@opsy/provider"
import type { CapabilitySourceKind } from "@/lib/db/schema"
import type { RelationshipEndpoint, RelationshipRulesLlmOutput } from "./schema"

export type RelationshipRuleValidationIssue = {
	path: string
	message: string
	value: unknown
	expected?: unknown
}

type EndpointSchemaInfo = {
	schema: ResourceTypeSchema | undefined
	field: Field | null
}

function getFieldTrail(fields: Field[], path: string): Field[] | null {
	const segments = path.split(".").filter(Boolean)
	if (segments.length === 0) return null
	const trail: Field[] = []
	let nodes = fields
	for (const segment of segments) {
		const found = nodes.find((field) => field.name.terraformName === segment)
		if (!found) return null
		trail.push(found)
		nodes = found.children
	}
	return trail
}

function findField(fields: Field[], path: string): Field | undefined {
	const trail = getFieldTrail(fields, path)
	return trail ? trail[trail.length - 1] : undefined
}

export async function validateRelationshipRulesProviderSchema(input: {
	provider: OpsyProvider
	kind: CapabilitySourceKind
	type: string
	schema: ResourceTypeSchema
	output: RelationshipRulesLlmOutput
	sourceMustBeGeneratedType?: boolean
}): Promise<RelationshipRuleValidationIssue[]> {
	const sourceMustBeGeneratedType = input.sourceMustBeGeneratedType ?? true
	const typeCache = new Map<string, ProviderType | null>()
	const getType = async (type: string) => {
		if (typeCache.has(type)) return typeCache.get(type) ?? undefined
		const providerType = await input.provider.getType(type)
		typeCache.set(type, providerType ?? null)
		return providerType
	}
	const schemaCache = new Map<string, ResourceTypeSchema | null>()
	const getSchema = async (type: string, kind: CapabilitySourceKind) => {
		const key = `${kind}\0${type}`
		if (schemaCache.has(key)) return schemaCache.get(key) ?? undefined
		const schema = await input.provider.getSchema(type, kind)
		schemaCache.set(key, schema ?? null)
		return schema
	}
	const allIssues: RelationshipRuleValidationIssue[] = []
	for (const [index, rule] of input.output.rules.entries()) {
		const ruleIssues: RelationshipRuleValidationIssue[] = []
		const endpointInfo = new Map<"source" | "target", EndpointSchemaInfo>()
		const endpointNames: Array<"source" | "target"> = ["source", "target"]
		for (const name of endpointNames) {
			const endpoint = rule[name]
			const info = await schemaPathInfoForEndpoint({
				getSchema,
				generatedKind: input.kind,
				generatedType: input.type,
				generatedSchema: input.schema,
				endpoint,
			})
			endpointInfo.set(name, info)
			const endpointIsGenerated =
				endpoint.kind === input.kind && endpoint.type === input.type
			const providerType = endpointIsGenerated
				? null
				: await getType(endpoint.type)
			if (!endpointIsGenerated && !providerType?.capabilities[endpoint.kind]) {
				ruleIssues.push({
					path: `rules.${index}.${name}.type`,
					message: "Endpoint type is not present in the provider type set.",
					value: endpoint.type,
					expected: `A ${endpoint.kind} type returned by provider type discovery.`,
				})
			}
			if (info.schema && !info.field) {
				ruleIssues.push({
					path: `rules.${index}.${name}.path`,
					message: "Endpoint path is not present in the endpoint schema.",
					value: endpoint.path,
					expected: "A dotted path from the endpoint schema.",
				})
			}
		}
		const identityPairIssue = ownIdentityPairIssue(
			rule.source,
			endpointInfo.get("source"),
			rule.target,
			endpointInfo.get("target"),
		)
		if (identityPairIssue) {
			ruleIssues.push({
				path: `rules.${index}`,
				message:
					"Endpoint paths compare two computed own-identity fields from different endpoint types. Use the field that stores the other endpoint's runtime identity instead.",
				value: rule,
				expected:
					"One endpoint should be a reference/host/association field whose runtime value can equal the other endpoint identity.",
			})
		}
		if (
			sourceMustBeGeneratedType &&
			(rule.source.kind !== input.kind || rule.source.type !== input.type)
		) {
			ruleIssues.push({
				path: `rules.${index}.source`,
				message: "The source endpoint must match the generated provider type.",
				value: rule.source,
				expected: {
					kind: input.kind,
					type: input.type,
				},
			})
		}
		allIssues.push(...ruleIssues)
	}
	return allIssues
}

async function schemaPathInfoForEndpoint(input: {
	getSchema: (
		type: string,
		kind: CapabilitySourceKind,
	) => Promise<ResourceTypeSchema | undefined>
	generatedKind: CapabilitySourceKind
	generatedType: string
	generatedSchema: ResourceTypeSchema
	endpoint: RelationshipEndpoint
}): Promise<EndpointSchemaInfo> {
	const endpointIsGenerated =
		input.endpoint.kind === input.generatedKind &&
		input.endpoint.type === input.generatedType
	const schema = endpointIsGenerated
		? input.generatedSchema
		: await input.getSchema(input.endpoint.type, input.endpoint.kind)
	return {
		schema,
		field: schema
			? (findField(schema.identity.fields, input.endpoint.path) ?? null)
			: null,
	}
}

function ownIdentityPairIssue(
	source: RelationshipEndpoint,
	sourceInfo: EndpointSchemaInfo | undefined,
	target: RelationshipEndpoint,
	targetInfo: EndpointSchemaInfo | undefined,
): boolean {
	if (source.kind === target.kind && source.type === target.type) return false
	if (source.path !== target.path) return false
	const sourceField = sourceInfo?.field
	const targetField = targetInfo?.field
	if (sourceField?.kind !== "attribute" || targetField?.kind !== "attribute") {
		return false
	}
	return Boolean(sourceField.computed && targetField.computed)
}

export function validateRelationshipRuleIdentityUniqueness(input: {
	output: RelationshipRulesLlmOutput
}): RelationshipRuleValidationIssue[] {
	const seen = new Map<string, number>()
	const issues: RelationshipRuleValidationIssue[] = []
	input.output.rules.forEach((rule, index) => {
		const key = [
			rule.source.kind,
			rule.source.type,
			rule.source.path,
			rule.target.kind,
			rule.target.type,
			rule.target.path,
			rule.relationship,
		].join("\0")
		const firstIndex = seen.get(key)
		if (firstIndex !== undefined) {
			issues.push({
				path: `rules.${index}`,
				message:
					"No two relationship rules may share source, target, and relationship.",
				value: rule,
				expected: `Duplicate of rules.${firstIndex}; keep one rule for this identity.`,
			})
			return
		}
		seen.set(key, index)
	})
	return issues
}
