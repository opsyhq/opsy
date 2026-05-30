import type { ResourceFieldLayoutLlmOutput } from "@opsy/api"
import type {
	ResolvedField,
	ResolvedTypeView,
} from "@/components/resource-detail/resolvedTypeView"

// The server's resource-field-layout thinking block is the source of truth for
// form arrangement. This module only maps the block's string-path layout onto
// the resolved field tree — coverage and partition are enforced by the API
// oracle, never re-checked here.

type SpecSection = ResourceFieldLayoutLlmOutput["create"]
type SpecRow = SpecSection["rows"][number]

export type FieldLayoutRow =
	| ResolvedField
	| {
			title: string
			collapsed?: boolean
			rows: FieldLayoutRow[]
	  }

export type FieldLayoutSection = {
	title: string
	rows: FieldLayoutRow[]
}

export type FieldLayout = {
	create: FieldLayoutSection
	sections: FieldLayoutSection[]
}

export function fieldLayoutRowsToResolvedFields(
	rows: readonly FieldLayoutRow[],
): ResolvedField[] {
	const fields: ResolvedField[] = []
	const visit = (row: FieldLayoutRow) => {
		if (isFieldLayoutGroupRow(row)) {
			for (const child of row.rows) visit(child)
			return
		}
		fields.push(row)
	}
	for (const row of rows) visit(row)

	const seen = new Set<string>()
	return fields.filter((field) => {
		if (seen.has(field.path)) return false
		seen.add(field.path)
		return true
	})
}

export function isFieldLayoutGroupRow(
	row: FieldLayoutRow,
): row is Extract<FieldLayoutRow, { rows: FieldLayoutRow[] }> {
	return "rows" in row
}

function flattenResolvedFields(
	fields: readonly ResolvedField[],
): ResolvedField[] {
	const out: ResolvedField[] = []
	for (const field of fields) {
		out.push(field)
		if (field.children?.length)
			out.push(...flattenResolvedFields(field.children))
	}
	return out
}

export function resolveFieldLayout(
	view: ResolvedTypeView,
	spec: ResourceFieldLayoutLlmOutput | null,
): FieldLayout | null {
	if (!spec) return null

	const fieldsByPath = new Map(
		flattenResolvedFields(view.fields).map((field) => [field.path, field]),
	)

	const resolveRow = (row: SpecRow): FieldLayoutRow | null => {
		if (typeof row === "string") {
			return fieldsByPath.get(row) ?? null
		}
		const rows = row.rows.flatMap((child) => {
			const resolved = resolveRow(child)
			return resolved ? [resolved] : []
		})
		if (rows.length === 0) return null
		return {
			title: row.title,
			...(row.collapsed === false ? { collapsed: false } : {}),
			rows,
		}
	}

	const resolveSection = (section: SpecSection): FieldLayoutSection => ({
		title: section.title,
		rows: section.rows.flatMap((row) => {
			const resolved = resolveRow(row)
			return resolved ? [resolved] : []
		}),
	})

	return {
		create: resolveSection(spec.create),
		sections: spec.sections.map(resolveSection),
	}
}
