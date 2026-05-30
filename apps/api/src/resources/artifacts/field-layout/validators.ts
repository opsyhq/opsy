import { check } from "@opsy/thinking-blocks"
import {
	type LayoutRowSpec,
	type ResourceFieldLayoutInput,
	type ResourceFieldLayoutLlmOutput,
	type ResourceFieldLayoutPromptField,
	resourceFieldLayoutLlmSchema,
	type SectionSpec,
} from "./block"

export type ResourceFieldLayoutCoverageField = Pick<
	ResourceFieldLayoutPromptField,
	"path" | "required" | "repeatedObject"
>

export type ResourceFieldLayoutCoverage = {
	writablePaths: string[]
	placedPaths: string[]
	unplacedPaths: string[]
	unplacedRequiredPaths: string[]
	missingSpecPaths: string[]
	repeatedObjectPaths: string[]
	createOnlyPaths: string[]
}

type ResourceFieldLayoutValidationIssue = {
	path: string
	message: string
	value: unknown
	expected?: string
}

function collectRowPaths(sections: readonly SectionSpec[]): string[] {
	const paths: string[] = []
	const visitRow = (row: LayoutRowSpec) => {
		if (typeof row === "string") {
			paths.push(row)
			return
		}
		for (const child of row.rows) visitRow(child)
	}
	for (const section of sections) {
		for (const row of section.rows) visitRow(row)
	}
	return paths
}

// Ported from the field-layout prototype: mark every spec path plus its
// prefix-expanded ancestors and descendants (a.b <-> a), then derive coverage
// gaps against the supplied writable fields.
export function fieldLayoutCoverage(input: {
	fields: ResourceFieldLayoutCoverageField[]
	layout: ResourceFieldLayoutLlmOutput
}): ResourceFieldLayoutCoverage {
	const fieldsByPath = new Map(input.fields.map((field) => [field.path, field]))
	const placed = new Set<string>()
	const missingSpecPaths = new Set<string>()
	const repeatedObjectPaths = new Set<string>()

	const markField = (field: ResourceFieldLayoutCoverageField) => {
		placed.add(field.path)
		if (field.repeatedObject) repeatedObjectPaths.add(field.path)
	}
	const markPath = (path: string) => {
		const field = fieldsByPath.get(path)
		if (!field) {
			missingSpecPaths.add(path)
			return
		}
		markField(field)
		for (const [candidatePath, candidateField] of fieldsByPath) {
			if (
				candidatePath.startsWith(`${path}.`) ||
				path.startsWith(`${candidatePath}.`)
			) {
				markField(candidateField)
			}
		}
	}
	// Coverage is enforced on the edit sections alone — they are the complete
	// surface. `create` is a curated subset reference, so it never counts
	// toward coverage; instead every create path must resolve into a field the
	// edit sections already placed (create ⊆ sections).
	for (const path of collectRowPaths(input.layout.sections)) markPath(path)

	const createOnly = new Set<string>()
	for (const path of collectRowPaths([input.layout.create])) {
		const field = fieldsByPath.get(path)
		if (!field) {
			missingSpecPaths.add(path)
			continue
		}
		if (!placed.has(field.path)) createOnly.add(field.path)
	}

	const writablePaths = input.fields.map((field) => field.path).sort()
	const placedPaths = [...placed].sort()
	const unplacedPaths = writablePaths.filter((path) => !placed.has(path))
	const unplacedRequiredPaths = unplacedPaths.filter(
		(path) => fieldsByPath.get(path)?.required,
	)
	return {
		writablePaths,
		placedPaths,
		unplacedPaths,
		unplacedRequiredPaths,
		missingSpecPaths: [...missingSpecPaths].sort(),
		repeatedObjectPaths: [...repeatedObjectPaths].sort(),
		createOnlyPaths: [...createOnly].sort(),
	}
}

export function validateResourceFieldLayoutCoverage(input: {
	fields: ResourceFieldLayoutCoverageField[]
	layout: ResourceFieldLayoutLlmOutput
}): ResourceFieldLayoutValidationIssue[] {
	const coverage = fieldLayoutCoverage(input)
	const issues: ResourceFieldLayoutValidationIssue[] = []
	if (coverage.unplacedPaths.length > 0) {
		issues.push({
			path: "sections",
			message:
				"Every supplied writable field path must be placed in an edit section.",
			value: coverage.unplacedPaths,
			expected: "Place each unplaced path in a section or group row.",
		})
	}
	if (coverage.createOnlyPaths.length > 0) {
		issues.push({
			path: "create",
			message:
				"Every create path must also appear in an edit section; the edit sections are the complete surface.",
			value: coverage.createOnlyPaths,
			expected:
				"Add each create-only path to an edit section. Create is a curated subset of the edit sections, never an extra field source.",
		})
	}
	if (coverage.unplacedRequiredPaths.length > 0) {
		issues.push({
			path: "sections",
			message: "Required fields must appear in a visible scan-line row.",
			value: coverage.unplacedRequiredPaths,
			expected: "Place each required path as a direct row in a section.",
		})
	}
	if (coverage.missingSpecPaths.length > 0) {
		issues.push({
			path: "sections",
			message:
				"Layout references paths that are not in the supplied field list.",
			value: coverage.missingSpecPaths,
			expected: "Use only paths from the supplied field records.",
		})
	}
	return issues
}

// The web renderer and the prototype both depend on rows being partitioned:
// every direct field row precedes any group row within a rows list, and groups
// are never empty. A top-level section must also carry at least one scan-line
// field — a section that is only collapsed groups (e.g. a lone "Operations"
// that is just a Timeouts panel) does not read like a real console form.
export function validateResourceFieldLayoutPartition(input: {
	layout: ResourceFieldLayoutLlmOutput
}): ResourceFieldLayoutValidationIssue[] {
	const issues: ResourceFieldLayoutValidationIssue[] = []
	const addSectionScanLineIssue = (section: SectionSpec, location: string) => {
		if (
			section.rows.length > 0 &&
			section.rows.every((row) => typeof row !== "string")
		) {
			issues.push({
				path: `${location}.rows`,
				message:
					"A section must contain at least one direct scan-line field row, not only groups.",
				value: section.rows,
				expected:
					"Promote the section's primary field to a direct row, or fold these groups into another section.",
			})
		}
	}
	const visitRows = (rows: LayoutRowSpec[], location: string) => {
		let sawGroup = false
		rows.forEach((row, index) => {
			const rowPath = `${location}.rows.${index}`
			if (typeof row === "string") {
				if (sawGroup) {
					issues.push({
						path: rowPath,
						message:
							"A direct field row may not appear after a group row in the same list.",
						value: row,
						expected: "Move all direct field rows before any group rows.",
					})
				}
				return
			}
			sawGroup = true
			if (row.rows.length === 0) {
				issues.push({
					path: rowPath,
					message: "A group must contain at least one row.",
					value: row,
					expected: "Remove the empty group or give it rows.",
				})
			}
			visitRows(row.rows, rowPath)
		})
	}
	visitRows(input.layout.create.rows, "create")
	addSectionScanLineIssue(input.layout.create, "create")
	input.layout.sections.forEach((section, index) => {
		visitRows(section.rows, `sections.${index}`)
		addSectionScanLineIssue(section, `sections.${index}`)
	})
	return issues
}

// Single validator: parse once, accumulate coverage + partition issues, fail
// retry on the combined feedback. The framework hands each validator the raw
// output independently, so two checks meant two redundant safeParse calls per
// run; the underlying invariants (every writable path placed, scan-lines
// before groups) ride one retry anyway.
export const resourceFieldLayoutValidator = check<
	ResourceFieldLayoutInput,
	ResourceFieldLayoutLlmOutput
>("resource-field-layout", {
	validate: ({ input, output }) => {
		const parsed = resourceFieldLayoutLlmSchema.safeParse(output)
		if (!parsed.success) {
			return { success: false, feedback: { issues: parsed.error.issues } }
		}
		const issues = [
			...validateResourceFieldLayoutCoverage({
				fields: input.fields,
				layout: parsed.data,
			}),
			...validateResourceFieldLayoutPartition({ layout: parsed.data }),
		]
		return issues.length === 0
			? { success: true }
			: { success: false, feedback: { issues } }
	},
})
