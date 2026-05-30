import type {
	ResourceSchema,
	SchemaAttribute,
	SchemaBlock,
	SchemaNestedBlock,
} from "@opsy/bridge-client"

// Terraform's literal cty type tuple — typed, not reshaped. Primitives are
// strings; collections/structurals are `[kind, …]` tuples exactly as the
// provider wire encodes them. The `object`/`tuple` element types are carried
// verbatim; nothing is flattened or collapsed.
export type CtyType =
	| "string"
	| "number"
	| "bool"
	| "dynamic"
	| ["list", CtyType]
	| ["set", CtyType]
	| ["map", CtyType]
	| ["object", Record<string, CtyType>]
	| ["tuple", CtyType[]]

// The only derived addition over verbatim Terraform: `path`, the dot-only
// identity walk from the resource root (no `[0]`). `terraformName` is the raw
// attribute/block key.
export interface FieldName {
	terraformName: string
	path: string
}

// One SchemaAttribute. `required/optional/computed/sensitive` are the verbatim
// TF booleans (no enum — "settable input" is a predicate over them, not stored
// state). SchemaAttribute carries NO `deprecated` boolean on the wire, so this
// kind has none: consumers derive it as `Boolean(deprecationMessage)`.
// `children` expand an object-typed cty shape (`["object", {…}]`) into named
// subfields — uniform with BlockField, never undefined.
export interface AttributeField {
	kind: "attribute"
	name: FieldName
	type: CtyType
	required: boolean
	optional: boolean
	computed: boolean
	sensitive: boolean
	description?: string
	deprecationMessage?: string
	children: Field[]
}

// One SchemaNestedBlock. Cardinality is `nestingMode`+`minItems`/`maxItems`,
// read here once by every consumer (never re-derived from a value shape).
// `deprecated` is a verbatim mirror of SchemaBlock.deprecated — the wire HAS
// this boolean on blocks (unlike attributes), so a `deprecated:true` block
// with no message is not lost.
export interface BlockField {
	kind: "block"
	name: FieldName
	nestingMode: SchemaNestedBlock["nesting_mode"]
	minItems: number
	maxItems: number | null
	deprecated: boolean
	description?: string
	deprecationMessage?: string
	children: Field[]
}

export type Field = AttributeField | BlockField

// The version-free structural identity of a type's schema: the addressable
// `Field[]` tree plus the schema-root metadata the tree itself can't carry
// (`description`/`deprecationMessage`/`deprecated` are *type* metadata, not a
// field). This is the unit of "two releases ship the same schema" — hash it
// directly (`thinkingBlockInputHash(schema.identity)`) as the artifact-
// regeneration cache key; the provider-assigned state `version` is deliberately
// not part of it, so a version bump with an identical field set reuses caches.
export interface ResourceSchemaIdentity {
	description?: string
	deprecationMessage?: string
	deprecated: boolean
	fields: Field[]
}

// The normalized form of a resource/data/provider-config schema — the single
// thing `getSchema` returns. Raw cty `ResourceSchema` never leaves this module:
// `buildFieldTree` is the one boundary that turns the wire shape into the
// addressable model every consumer reasons over. `version` rides alongside the
// structural `identity` so the two are separable without re-deriving either.
export interface ResourceTypeSchema {
	version: number
	identity: ResourceSchemaIdentity
}

function appendPath(prefix: string, name: string): string {
	return prefix ? `${prefix}.${name}` : name
}

function nonEmpty(value: string | undefined): string | undefined {
	const trimmed = value?.trim()
	return trimmed && trimmed.length > 0 ? trimmed : undefined
}

// Wire boundary: the provider sends `unknown | null` for an attribute type.
// A well-formed cty type is a string or a `[kind, …]` tuple; anything else is
// malformed input and gets the `"unknown"` sentinel (renders as text). The
// cast is the single boundary coercion onto the typed model.
function normalizedTfType(type: unknown): CtyType {
	return (
		typeof type === "string" || Array.isArray(type) ? type : "unknown"
	) as CtyType
}

// TF-native: a block's cty shape *is* Terraform's shape — no max_items
// collapse. A list/set/map block is always list/set/map (cardinality lives on
// minItems/maxItems); single/group are objects (their true Terraform shape,
// not a flatten). The single owner of that mapping.
function nestingModeCty(mode: SchemaNestedBlock["nesting_mode"]): CtyType {
	const inner: CtyType = ["object", {}]
	if (mode === "list") return ["list", inner]
	if (mode === "set") return ["set", inner]
	if (mode === "map") return ["map", inner]
	return inner
}

// The cty representation of any field: an attribute's verbatim cty type, or a
// block's nesting-mode shape. The single accessor consumers use so they see
// one consistent type vocabulary (no invented `block:` strings).
export function fieldCtyType(field: Field): CtyType {
	return field.kind === "attribute"
		? field.type
		: nestingModeCty(field.nestingMode)
}

export interface FieldFacts {
	required: boolean
	optional: boolean
	computed: boolean
	sensitive: boolean
	deprecated: boolean
}

// The settable-input / visibility booleans of any field with the block-vs-
// attribute projection applied once: a block's required/optional is a
// predicate over min_items and a block is never computed/sensitive; an
// attribute's are the verbatim TF booleans. `deprecated` is a block's verbatim
// SchemaBlock boolean, or an attribute's derived from its message presence.
// The single owner of this mapping so every consumer reads one vocabulary.
export function fieldFacts(field: Field): FieldFacts {
	if (field.kind === "block") {
		return {
			required: field.minItems > 0,
			optional: field.minItems === 0,
			computed: false,
			sensitive: false,
			deprecated: field.deprecated,
		}
	}
	return {
		required: field.required,
		optional: field.optional,
		computed: field.computed,
		sensitive: field.sensitive,
		deprecated: Boolean(field.deprecationMessage),
	}
}

function objectShape(type: CtyType): Record<string, CtyType> | null {
	if (!Array.isArray(type)) return null
	const [kind, shape] = type
	if (kind === "object") {
		return shape && typeof shape === "object" && !Array.isArray(shape)
			? (shape as Record<string, CtyType>)
			: null
	}
	if (kind === "list" || kind === "set" || kind === "map") {
		return objectShape(shape as CtyType)
	}
	return null
}

function buildObjectTypeChildren(
	shape: Record<string, CtyType> | null,
	prefix: string,
	parentFacts: { computed: boolean; sensitive: boolean },
): Field[] {
	if (!shape) return []
	const children: Field[] = []
	for (const [name, type] of Object.entries(shape)) {
		const path = appendPath(prefix, name)
		children.push({
			kind: "attribute",
			name: { terraformName: name, path },
			type: normalizedTfType(type),
			required: false,
			optional: true,
			computed: parentFacts.computed,
			sensitive: parentFacts.sensitive,
			children: buildObjectTypeChildren(objectShape(type), path, parentFacts),
		})
	}
	return children
}

// Every attribute becomes a node, including computed-only ones (computed &&
// !optional && !required). They are not editable inputs, but they are real
// fields of the resource: the layout/metadata artifacts place and label them,
// and the renderer shows them disabled. Filtering them here would make the
// declared field set diverge from the resource the provider actually exposes.
function buildAttributeNode(
	name: string,
	attr: SchemaAttribute,
	prefix: string,
): AttributeField {
	const path = appendPath(prefix, name)
	const description = nonEmpty(attr.description)
	const deprecationMessage = nonEmpty(attr.deprecation_message)
	const computed = attr.computed === true
	const sensitive = attr.sensitive === true
	const type = normalizedTfType(attr.type)
	return {
		kind: "attribute",
		name: { terraformName: name, path },
		type,
		required: attr.required === true,
		optional: attr.optional === true,
		computed,
		sensitive,
		...(description ? { description } : {}),
		...(deprecationMessage ? { deprecationMessage } : {}),
		children: buildObjectTypeChildren(objectShape(type), path, {
			computed,
			sensitive,
		}),
	}
}

function buildNestedBlockNode(
	name: string,
	nested: SchemaNestedBlock,
	prefix: string,
): BlockField {
	const path = appendPath(prefix, name)
	const description = nonEmpty(nested.block.description)
	const deprecationMessage = nonEmpty(nested.block.deprecation_message)
	return {
		kind: "block",
		name: { terraformName: name, path },
		nestingMode: nested.nesting_mode,
		minItems: nested.min_items ?? 0,
		maxItems: nested.max_items ?? null,
		deprecated:
			nested.block.deprecated === true || Boolean(deprecationMessage),
		...(description ? { description } : {}),
		...(deprecationMessage ? { deprecationMessage } : {}),
		children: buildBlockFields(nested.block, path),
	}
}

function buildBlockFields(
	block: SchemaBlock | undefined,
	prefix: string,
): Field[] {
	if (!block) return []
	const fields: Field[] = []
	for (const [name, attr] of Object.entries(block.attributes ?? {})) {
		fields.push(buildAttributeNode(name, attr, prefix))
	}
	for (const [name, nested] of Object.entries(block.block_types ?? {})) {
		fields.push(buildNestedBlockNode(name, nested, prefix))
	}
	return fields
}

// The one boundary that turns the raw cty wire schema into the normalized
// model. `ResourceSchema` is consumed only here; nothing downstream of
// `getSchema` ever sees `.block`/`.attributes`/`nesting_mode` again.
export function buildFieldTree(schema: ResourceSchema): ResourceTypeSchema {
	const description = nonEmpty(schema.block?.description)
	const deprecationMessage = nonEmpty(schema.block?.deprecation_message)
	return {
		version: schema.version,
		identity: {
			...(description ? { description } : {}),
			...(deprecationMessage ? { deprecationMessage } : {}),
			deprecated:
				schema.block?.deprecated === true || Boolean(deprecationMessage),
			fields: buildBlockFields(schema.block, ""),
		},
	}
}

// Referenceable handles, derived from the one field tree (dot-only identity
// paths — no `[0]`). A handle is a leaf an LLM-authored relationship rule may
// point at: a scalar attribute, a whole repeatable collection, or a leaf of an
// inlined singleton/single/group block:
//   - block `single`/`group`, or `list`/`set` with max_items==1 → recurse
//     children (inlined — dot-only, no `[0]`)
//   - block repeatable `list`/`set` (max>1/unset) or `map` → the block path
//     itself (whole-collection handle, no recursion)
//   - attribute, object-shaped (`["object", …]`) → its leaf children
//   - attribute, anything else (scalar/list/set/map) → the path itself
// Sensitive attribute subtrees are excluded (children inherit `sensitive`).
function referenceFieldPaths(node: Field): string[] {
	if (node.kind === "block") {
		const inlined =
			node.nestingMode === "single" ||
			node.nestingMode === "group" ||
			((node.nestingMode === "list" || node.nestingMode === "set") &&
				node.maxItems === 1)
		return inlined
			? node.children.flatMap(referenceFieldPaths)
			: [node.name.path]
	}
	if (node.sensitive) return []
	if (Array.isArray(node.type) && node.type[0] === "object") {
		return node.children.flatMap(referenceFieldPaths)
	}
	return [node.name.path]
}

// Takes the already-built tree (not the schema) so a consumer that has one
// doesn't rebuild it just for the handle set.
export function buildResourceReferenceFields(fields: Field[]): string[] {
	return [...new Set(fields.flatMap(referenceFieldPaths))]
}

export function flattenResourceFieldTree(fields: Field[]): Field[] {
	return fields.flatMap((field) => [
		field,
		...flattenResourceFieldTree(field.children),
	])
}
