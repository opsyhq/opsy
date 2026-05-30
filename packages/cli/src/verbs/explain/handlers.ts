import { apiError, CliError } from "@core/errors"
import { isJsonOutput } from "@core/output/output-format"
import type { HandlerDeps } from "@core/types/deps"
import {
	fetchImportIdentity,
	type ImportIdentity,
	inferProvider,
} from "@shell/providers"
// `import type` only: erased by the bundler, so nothing from @opsy/provider
// reaches the CLI runtime. The schema envelope (`ResourceTypeSchema`) and its
// normalized attribute/block node (`Field`) are owned there — re-declaring
// them here, or re-deriving the wire shape through the Hono client, would
// either drift from the contract or blow TS recursion on the cty type.
import type { Field, ResourceTypeSchema } from "@opsy/provider"

type TypeSchemaResponse = {
	provider: string
	type: string
	version: string | null
	kinds: Array<"resource" | "data">
	resource?: ResourceTypeSchema
	data?: ResourceTypeSchema
}
type ProviderDetailResponse = {
	name: string
	source: string
	version: string | null
	resourceCount: number
	dataSourceCount: number
	schema: ResourceTypeSchema | null
}
type SchemaField = Field
type AttributeField = Extract<Field, { kind: "attribute" }>
type BlockField = Extract<Field, { kind: "block" }>

export interface ExplainOpts {
	provider?: string
	kind?: string
	tree?: boolean
	path?: string
	format?: string
}

const isAttribute = (f: SchemaField): f is AttributeField =>
	f.kind === "attribute"
const isBlock = (f: SchemaField): f is BlockField => f.kind === "block"

function renderTypeToken(token: unknown): string {
	if (typeof token === "string") return token
	if (Array.isArray(token) && token.length > 0) {
		const [kind, inner] = token as [unknown, unknown]
		if (typeof kind !== "string") return "?"
		if (inner === undefined) return kind
		if (typeof inner === "string" || Array.isArray(inner)) {
			return `${kind}<${renderTypeToken(inner)}>`
		}
		return `${kind}<…>`
	}
	return "?"
}

function attributeBucket(
	field: AttributeField,
): "required" | "optional" | "computed" {
	if (field.required) return "required"
	if (field.computed && !field.optional) return "computed"
	return "optional"
}

const DESC_MAX = 100
function formatDescription(desc: string | undefined): string {
	if (!desc) return ""
	const collapsed = desc.replace(/\s+/g, " ").trim()
	return collapsed.length > DESC_MAX
		? `${collapsed.slice(0, DESC_MAX - 1)}…`
		: collapsed
}

function attributeRow(field: AttributeField): Record<string, unknown> {
	const flags: string[] = []
	if (field.sensitive) flags.push("sensitive")
	if (field.deprecationMessage) flags.push("deprecated")
	return {
		name: field.name.terraformName,
		type: renderTypeToken(field.type),
		flags: flags.join(", "),
		description: formatDescription(field.description),
	}
}

function renderAttrTable(deps: HandlerDeps, rows: AttributeField[]): void {
	const hasDesc = rows.some((f) => Boolean(f.description))
	const cols = hasDesc
		? ["name", "type", "flags", "description"]
		: ["name", "type", "flags"]
	deps.output.table(rows.map(attributeRow), cols)
}

// Walk into nested-block children by Terraform name. Returns the resolved
// block's children (the field set at that path).
function resolveFieldPath(
	root: SchemaField[] | undefined,
	segments: string[],
): SchemaField[] | undefined {
	let current = root
	const crumbs: string[] = []
	for (const seg of segments) {
		const next = current?.find(
			(f): f is BlockField => isBlock(f) && f.name.terraformName === seg,
		)
		if (!next) {
			const available = (current ?? [])
				.filter(isBlock)
				.map((f) => f.name.terraformName)
			const where = crumbs.length ? crumbs.join(".") : "<root>"
			throw new CliError(
				`no nested block "${seg}" at ${where}`,
				"SCHEMA_PATH_NOT_FOUND",
				available.length
					? `available: ${available.join(", ")}`
					: `${where} has no nested blocks`,
			)
		}
		current = next.children
		crumbs.push(seg)
	}
	return current
}

function renderNestedBlocks(
	deps: HandlerDeps,
	nested: BlockField[],
	tree: boolean,
): void {
	if (nested.length === 0) return
	deps.output.section("NESTED BLOCKS")
	deps.output.table(
		nested.map((nb) => ({
			name: nb.name.terraformName,
			nesting: nb.nestingMode,
			min: nb.minItems,
			max: nb.maxItems ?? "",
		})),
	)
	if (tree) {
		for (const nb of nested) {
			deps.output.section(`> ${nb.name.terraformName}`)
			renderFields(deps, nb.children, tree)
		}
	} else {
		deps.output.note("pass --tree to recurse, or --path <name> to focus on one")
	}
}

function renderFields(
	deps: HandlerDeps,
	fields: SchemaField[] | undefined,
	tree: boolean,
): void {
	if (!fields) {
		deps.output.note("(empty schema)")
		return
	}
	const required: AttributeField[] = []
	const optional: AttributeField[] = []
	const computed: AttributeField[] = []
	for (const attr of fields.filter(isAttribute)) {
		const bucket = attributeBucket(attr)
		if (bucket === "required") required.push(attr)
		else if (bucket === "optional") optional.push(attr)
		else computed.push(attr)
	}
	const renderGroup = (title: string, rows: AttributeField[]) => {
		if (rows.length === 0) return
		deps.output.section(title)
		renderAttrTable(deps, rows)
	}
	renderGroup("REQUIRED INPUTS", required)
	renderGroup("OPTIONAL INPUTS", optional)
	renderGroup("COMPUTED OUTPUTS", computed)
	renderNestedBlocks(deps, fields.filter(isBlock), tree)
}

function renderProviderDetail(
	deps: HandlerDeps,
	data: ProviderDetailResponse,
	opts: { tree: boolean; path: string[] },
): void {
	const header: Array<[string, unknown]> = [
		["name", data.name],
		["source", data.source],
		["version", data.version ?? "(uninitialized)"],
		["resources", data.resourceCount],
		["data sources", data.dataSourceCount],
	]
	if (opts.path.length) header.push(["path", opts.path.join(" > ")])
	deps.output.keyValue(header)

	if (!data.schema) {
		deps.output.note("(no provider config block)")
		return
	}

	if (opts.path.length) {
		renderFields(
			deps,
			resolveFieldPath(data.schema.identity.fields, opts.path),
			opts.tree,
		)
		return
	}

	const fields = data.schema.identity.fields
	const attrs = fields.filter(isAttribute)
	const credentials = attrs.filter((a) => a.sensitive)
	const config = attrs.filter((a) => !a.sensitive)

	if (credentials.length > 0) {
		deps.output.section("CREDENTIAL INPUTS")
		deps.output.dim("→ create integration --credentials")
		renderAttrTable(deps, credentials)
	}
	if (config.length > 0) {
		deps.output.section("CONFIG INPUTS")
		deps.output.dim("→ create integration --config")
		renderAttrTable(deps, config)
	}
	renderNestedBlocks(deps, fields.filter(isBlock), opts.tree)
}

function renderTypeSchema(
	deps: HandlerDeps,
	data: TypeSchemaResponse,
	opts: { tree: boolean; path: string[] },
): void {
	const header: Array<[string, unknown]> = [
		["provider", data.provider],
		["type", data.type],
		["version", data.version ?? "(uninitialized)"],
		["kinds", data.kinds.join(", ")],
	]
	if (opts.path.length) header.push(["path", opts.path.join(" > ")])
	deps.output.keyValue(header)

	const render = (
		label: string,
		schema: NonNullable<TypeSchemaResponse["resource"]>,
	) => {
		deps.output.section(label)
		try {
			renderFields(
				deps,
				opts.path.length
					? resolveFieldPath(schema.identity.fields, opts.path)
					: schema.identity.fields,
				opts.tree,
			)
		} catch (err) {
			// With kind="both" + --path, one kind's schema may lack the nested
			// block the other has. Note-and-continue so the half that *does*
			// match still renders instead of the whole command aborting.
			if (err instanceof CliError && err.code === "SCHEMA_PATH_NOT_FOUND") {
				deps.output.note(`(path not found in ${label.toLowerCase()})`)
				return
			}
			throw err
		}
	}
	if (data.resource) render("RESOURCE SCHEMA", data.resource)
	if (data.data) render("DATA SOURCE SCHEMA", data.data)
}

// The provider owns whether a resource imports by structured identity or a
// raw ID. Surface it next to the schema so an operator (or an LLM driving the
// CLI) sees what `opsy import` needs without trial-and-error.
function renderImportIdentity(
	deps: HandlerDeps,
	type: string,
	identity: ImportIdentity,
): void {
	deps.output.section("IMPORT")
	if (identity.mode === "import-id") {
		deps.output.note("no structured identity — import by raw provider id")
		deps.output.dim(
			`→ opsy resource import <slug> --type ${type} --provider-id <id>`,
		)
		return
	}
	const attrs = identity.identity.attributes
	const hasDesc = attrs.some((a) => Boolean(a.description))
	deps.output.table(
		attrs.map((a) => ({
			name: a.name,
			type: renderTypeToken(a.type),
			required: a.required_for_import ? "yes" : "",
			description: formatDescription(a.description),
		})),
		hasDesc
			? ["name", "type", "required", "description"]
			: ["name", "type", "required"],
	)
	const flags = [
		...attrs
			.filter((a) => a.required_for_import)
			.map((a) => `--identity ${a.name}=<${a.name}>`),
		...attrs
			.filter((a) => !a.required_for_import)
			.map((a) => `[--identity ${a.name}=<…>]`),
	].join(" ")
	deps.output.dim(`→ opsy resource import <slug> --type ${type} ${flags}`)
}

function parsePath(raw: string | undefined): string[] {
	return raw ? raw.split(".").filter(Boolean) : []
}

async function showType(
	deps: HandlerDeps,
	target: string,
	kind: "resource" | "data" | undefined,
	opts: ExplainOpts,
): Promise<void> {
	const providerName = opts.provider ?? (await inferProvider(deps, target))
	const res = await deps.client.providers[":provider"].types[":type"].$get({
		param: { provider: providerName, type: target },
		query: { format: "detailed", ...(kind ? { kind } : {}) },
	})
	if (!res.ok) throw apiError(res.status, await res.text())
	const data = (await res.json()) as TypeSchemaResponse
	// Resources can be imported; surface how (structured identity vs. raw id)
	// from the same endpoint the web import form reads.
	const importable = data.kinds.includes("resource")
	const identity = importable
		? await fetchImportIdentity(deps, providerName, target)
		: null
	if (isJsonOutput(opts)) {
		deps.output.printJson(identity ? { ...data, import: identity } : data)
		return
	}
	renderTypeSchema(deps, data, {
		tree: opts.tree === true,
		path: parsePath(opts.path),
	})
	if (identity) renderImportIdentity(deps, target, identity)
}

export async function explainTarget(
	deps: HandlerDeps,
	target: string,
	sub: string | undefined,
	opts: ExplainOpts,
): Promise<void> {
	if (target === "providers") {
		if (sub === undefined) {
			const res = await deps.client.providers.$get()
			if (!res.ok) throw apiError(res.status, await res.text())
			const data = await res.json()
			if (isJsonOutput(opts)) {
				deps.output.printJson(data)
				return
			}
			if (data.providers.length === 0) {
				deps.output.note("no providers registered")
				return
			}
			deps.output.table(
				data.providers.map((p) => ({
					name: p.name,
					source: p.source,
					version: p.version ?? "(uninitialized)",
					resources: p.resourceCount,
					"data sources": p.dataSourceCount,
				})),
			)
			return
		}
		const res = await deps.client.providers[":provider"].$get({
			param: { provider: sub },
			query: { format: "detailed" },
		})
		if (!res.ok) throw apiError(res.status, await res.text())
		const data = (await res.json()) as ProviderDetailResponse
		if (isJsonOutput(opts)) {
			deps.output.printJson(data)
			return
		}
		renderProviderDetail(deps, data, {
			tree: opts.tree === true,
			path: parsePath(opts.path),
		})
		return
	}
	let kind: "resource" | "data" | undefined
	if (opts.kind !== undefined) {
		if (opts.kind !== "resource" && opts.kind !== "data") {
			throw new CliError(
				`invalid --kind: ${opts.kind}`,
				"INVALID_KIND",
				"use resource or data",
			)
		}
		kind = opts.kind
	}
	await showType(deps, target, kind, opts)
}
