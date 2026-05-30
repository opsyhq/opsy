import { type CtyType, type Field, fieldFacts } from "@opsy/provider/field-tree"
import type { ResourceTypeArtifacts } from "@/lib/providerReactQuery"

// The renderer's per-field view: schema facts (kind, path, tfType, requireds…)
// plus the per-path artifact lookups (label/help/icon + relationship rules) fused
// during a single walk over the schema tree. Consumers iterate this tree and
// never reach back into the bundle — same data, single shape.
type ArtifactRelationshipRule = NonNullable<
	ResourceTypeArtifacts["relationshipRules"]["data"]
>[string][number]

export type ResolvedFieldRelationship = {
	key: ArtifactRelationshipRule["key"]
	fieldPath: string
	selectable: ArtifactRelationshipRule["target"]
	cardinality: "one" | "many"
}

export type ResolvedField = {
	kind: "attribute" | "block"
	path: string
	terraformName: string
	tfType?: CtyType
	nestingMode?: "single" | "group" | "list" | "set" | "map"
	minItems?: number
	maxItems?: number
	required: boolean
	optional: boolean
	sensitive: boolean
	computed: boolean
	deprecated: boolean
	description?: string
	deprecationMessage?: string
	label: string
	help?: string
	icon?: string
	relationships: ResolvedFieldRelationship[]
	children?: ResolvedField[]
}

export type ResolvedTypeView = {
	fields: ResolvedField[]
	artifacts: ResourceTypeArtifacts | null
}

// The schema input is the wire-shape of `ResourceTypeSchema` — InferResponseType
// reproduces the deep recursive structure faithfully, but feeding it directly to
// a `ResourceTypeSchema`-typed parameter triggers TS's "instantiation excessively
// deep" guard on the comparison. Duck-type to the only field we actually walk
// (`identity.fields`) and cast once at the boundary; the wire and TS shapes are
// structurally identical here (no Dates or non-JSON values in Field).
export function resolveTypeView(input: {
	schema: { identity: { fields: readonly unknown[] } } | null | undefined
	artifacts: ResourceTypeArtifacts | null
}): ResolvedTypeView | null {
	if (!input.schema) return null
	const fieldMetadata = input.artifacts?.fieldMetadata.data ?? null
	const rulesByPath = input.artifacts?.relationshipRules.data ?? null
	const rootFields = input.schema.identity.fields as readonly Field[]
	const fields = sortFields(
		rootFields.map((field) =>
			resolveField(field, fieldMetadata, rulesByPath, rootFields),
		),
	)
	return { fields, artifacts: input.artifacts ?? null }
}

type FieldMetadataByPath = NonNullable<
	ResourceTypeArtifacts["fieldMetadata"]["data"]
>
type RulesByPath = NonNullable<
	ResourceTypeArtifacts["relationshipRules"]["data"]
>

function resolveField(
	field: Field,
	fieldMetadata: FieldMetadataByPath | null,
	rulesByPath: RulesByPath | null,
	rootFields: readonly Field[],
): ResolvedField {
	const path = field.name.path
	const meta = fieldMetadata?.[path]
	const facts = fieldFacts(field)
	const children = sortFields(
		field.children.map((child) =>
			resolveField(child, fieldMetadata, rulesByPath, rootFields),
		),
	)
	const cardinality = getFieldReferenceCardinality(rootFields, path)
	const relationships: ResolvedFieldRelationship[] = (
		rulesByPath?.[path] ?? []
	).map((rule) => ({
		key: rule.key,
		fieldPath: path,
		selectable: rule.target,
		cardinality,
	}))
	const common = {
		kind: field.kind,
		path,
		terraformName: field.name.terraformName,
		...(field.description ? { description: field.description } : {}),
		...(field.deprecationMessage
			? { deprecationMessage: field.deprecationMessage }
			: {}),
		label: meta?.label ?? path,
		...(meta?.help ? { help: meta.help } : {}),
		...(meta?.icon ? { icon: meta.icon } : {}),
		relationships,
		...(children.length > 0 ? { children } : {}),
		...facts,
	}
	if (field.kind === "attribute") {
		return { ...common, tfType: field.type }
	}
	return {
		...common,
		nestingMode: field.nestingMode,
		minItems: field.minItems,
		...(field.maxItems !== null ? { maxItems: field.maxItems } : {}),
	}
}

function getFieldReferenceCardinality(
	fields: readonly Field[],
	path: string,
): "one" | "many" {
	const trail = trailByPath(fields, path)
	if (!trail) return "one"
	return trail.some(isMany) ? "many" : "one"
}

function isMany(field: Field): boolean {
	if (field.kind === "block") {
		return (
			(field.nestingMode === "list" ||
				field.nestingMode === "set" ||
				field.nestingMode === "map") &&
			field.maxItems !== 1
		)
	}
	return (
		Array.isArray(field.type) &&
		(field.type[0] === "list" ||
			field.type[0] === "set" ||
			field.type[0] === "map")
	)
}

function trailByPath(fields: readonly Field[], path: string): Field[] | null {
	const segments = path.split(".").filter(Boolean)
	if (segments.length === 0) return null
	const trail: Field[] = []
	let nodes: readonly Field[] = fields
	for (const segment of segments) {
		const found = nodes.find((node) => node.name.terraformName === segment)
		if (!found) return null
		trail.push(found)
		nodes = found.children
	}
	return trail
}

function sortFields(fields: ResolvedField[]): ResolvedField[] {
	return [...fields].sort((a, b) => {
		if (a.required !== b.required) return a.required ? -1 : 1
		return a.path.localeCompare(b.path)
	})
}

// Renderer-internal helper. The per-path `reference` flag lives in
// `artifacts.fieldMetadata.data[path]`; the cross-type reference candidate
// picker (`selectResourceReferenceCandidates`) needs the array of paths flagged
// `reference` per type, so derive it from the same lookup the rest of the
// renderers walk. Direct membership, no separate top-level shape.
export function referencePathsFromArtifacts(
	artifacts: ResourceTypeArtifacts | null | undefined,
): string[] {
	const data = artifacts?.fieldMetadata.data
	if (!data) return []
	return Object.entries(data).flatMap(([path, entry]) =>
		entry?.reference === true ? [path] : [],
	)
}
