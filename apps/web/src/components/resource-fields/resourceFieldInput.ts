import type { ResolvedField } from "@/components/resource-detail/resolvedTypeView"
import type { ResourceReferenceCandidate } from "@/lib/resourceRefs"
import { parseRefString } from "@/lib/resourceRefs"

export type ResourceFieldWidgetKind =
	| "text"
	| "password"
	| "kv"
	| "list"
	| "json"
	| "bool"
	| "number"

export type PickerRelationship = {
	relationships: ResolvedField["relationships"]
	cardinality: ResolvedField["relationships"][number]["cardinality"]
}

export type ResourceFieldInput =
	| {
			kind: "field-group"
	  }
	| {
			kind: "relationship"
			relationship: PickerRelationship
			manualWidgetKind: ResourceFieldWidgetKind
	  }
	| {
			kind: ResourceFieldWidgetKind
	  }

// A block rendered as one always-present inline group: `single` or `group`.
// Terraform always materializes these and their value is a plain object, so
// there is no Add/Remove affordance. A `list`/`set` block — including a
// `max_items==1` singleton — is a collection (TF-native array) and routes to
// ObjectArrayInput, where `maxItems` caps it at one "Add X" row; a `map`
// block routes to ObjectMapInput. Read from the discriminant, never guessed
// from a value shape.
export function isInlineBlock(
	field: Pick<ResolvedField, "kind" | "nestingMode">,
): boolean {
	return (
		field.kind === "block" &&
		(field.nestingMode === "single" || field.nestingMode === "group")
	)
}

// Value-addresses are rhf form-slot paths (`a[0].b`, `a.key.b`) — distinct
// from identity paths (`field.path`, always dot-only, never indexed). This is
// the single place an array index `[i]`, a map `.key`, or a nested child
// segment is appended; every other site only threads the resulting string on
// as `sourcePath`.
export type ValueAddressSegment =
	| { index: number }
	| { key: string }
	| { child: Pick<ResolvedField, "terraformName" | "path"> }

export function valueAddress(
	parent: string | undefined,
	segment: ValueAddressSegment,
): string {
	if ("index" in segment) return `${parent}[${segment.index}]`
	if ("key" in segment) return `${parent}.${segment.key}`
	return parent
		? `${parent}.${segment.child.terraformName}`
		: segment.child.path
}

export function resolveResourceFieldInput(
	field: ResolvedField,
): ResourceFieldInput {
	if ((field.children?.length ?? 0) > 0) {
		// Inline group: an inline block, or an object-typed attribute (its cty
		// object shape expands into children). Repeatable list/set blocks and
		// map blocks fall through to the collection widgets below.
		if (
			isInlineBlock(field) ||
			(field.kind === "attribute" &&
				Array.isArray(field.tfType) &&
				field.tfType[0] === "object")
		) {
			return { kind: "field-group" }
		}
	}

	// Blocks carry no tfType; their manual fallback (used only behind a
	// relationship picker) is structured JSON.
	const manualWidgetKind =
		field.kind === "block"
			? "json"
			: resolveResourceFieldWidgetKind(field.tfType, field.sensitive)
	const relationship = resolvePickerRelationship(field)
	return relationship
		? { kind: "relationship", relationship, manualWidgetKind }
		: { kind: manualWidgetKind }
}

export function resourceFieldValueWidgetKind(
	input: Exclude<ResourceFieldInput, { kind: "field-group" }>,
): ResourceFieldWidgetKind
export function resourceFieldValueWidgetKind(
	input: ResourceFieldInput,
): ResourceFieldWidgetKind | null
export function resourceFieldValueWidgetKind(
	input: ResourceFieldInput,
): ResourceFieldWidgetKind | null {
	if (input.kind === "field-group") return null
	if (input.kind === "relationship") return input.manualWidgetKind
	return input.kind
}

export function resourceFieldCollectionKind(
	field: Pick<ResolvedField, "kind" | "nestingMode" | "tfType">,
): "array" | "map" | null {
	if (field.kind === "block") {
		if (field.nestingMode === "list" || field.nestingMode === "set") {
			return "array"
		}
		if (field.nestingMode === "map") return "map"
		return null
	}
	if (!Array.isArray(field.tfType)) return null
	const head = field.tfType[0]
	if (head === "list" || head === "set") return "array"
	if (head === "map") return "map"
	return null
}

export function resourceFieldCollectionElementType(
	field: Pick<ResolvedField, "kind" | "tfType">,
): unknown {
	// Each block row is an object keyed by the block's child fields.
	if (field.kind === "block") return ["object", {}]
	if (!Array.isArray(field.tfType)) return "string"
	const head = field.tfType[0]
	return head === "list" || head === "set" || head === "map"
		? field.tfType[1]
		: "string"
}

export function resolveResourceFieldWidgetKind(
	tfType: unknown,
	sensitive: boolean,
): ResourceFieldWidgetKind {
	if (typeof tfType === "string") {
		if (tfType === "bool") return "bool"
		if (tfType === "number") return "number"
		return sensitive ? "password" : "text"
	}
	if (Array.isArray(tfType)) {
		const head = tfType[0]
		const elem = tfType[1]
		if (head === "list" || head === "set") {
			// TF block-list shapes (e.g. `versioning`, `grant`, `cors_rule`) come
			// through as list-of-objects, so they need structured JSON editing.
			if (
				Array.isArray(elem) &&
				(elem[0] === "object" ||
					elem[0] === "tuple" ||
					elem[0] === "list" ||
					elem[0] === "set" ||
					elem[0] === "map")
			) {
				return "json"
			}
			if (elem && typeof elem === "object") return "json"
			return "list"
		}
		if (head === "map") {
			if (
				Array.isArray(elem) &&
				(elem[0] === "object" ||
					elem[0] === "tuple" ||
					elem[0] === "list" ||
					elem[0] === "set" ||
					elem[0] === "map")
			) {
				return "json"
			}
			if (elem && typeof elem === "object") return "json"
			return "kv"
		}
		if (head === "object" || head === "tuple") return "json"
	}
	return sensitive ? "password" : "text"
}

export function relationshipSelectableLabel(
	relationship: PickerRelationship,
): string {
	const typeCounts = new Map<string, number>()
	for (const item of relationship.relationships) {
		typeCounts.set(
			item.selectable.type,
			(typeCounts.get(item.selectable.type) ?? 0) + 1,
		)
	}
	const labels = [
		...new Set(
			relationship.relationships.map((item) =>
				(typeCounts.get(item.selectable.type) ?? 0) > 1
					? `${item.selectable.type} (${item.selectable.path})`
					: item.selectable.type,
			),
		),
	]
	return labels.length === 1 ? (labels[0] ?? "resource") : labels.join(" / ")
}

export function relationshipTargetRefLabel(
	target: Pick<ResourceReferenceCandidate, "slug" | "type" | "ref">,
	relationship: PickerRelationship,
): string {
	const parsed = parseRefString(target.ref.$ref)
	if (parsed) return `${target.slug}.${parsed.path}`
	const matched =
		relationship.relationships.find(
			(item) => item.selectable.type === target.type,
		) ?? relationship.relationships[0]
	return `${target.slug}.${matched?.selectable.path ?? "id"}`
}

function resolvePickerRelationship(
	field: ResolvedField,
): PickerRelationship | null {
	const [first] = field.relationships
	if (!first) return null
	if (
		field.relationships.some((item) => item.cardinality !== first.cardinality)
	) {
		return null
	}
	return {
		relationships: field.relationships,
		cardinality: first.cardinality,
	}
}
