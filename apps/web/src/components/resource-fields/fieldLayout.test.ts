import type { ResourceFieldLayoutLlmOutput } from "@opsy/api"
import { describe, expect, it } from "vitest"
import type {
	ResolvedField,
	ResolvedTypeView,
} from "@/components/resource-detail/resolvedTypeView"
import {
	type FieldLayoutRow,
	fieldLayoutRowsToResolvedFields,
	isFieldLayoutGroupRow,
	resolveFieldLayout,
} from "@/components/resource-fields/fieldLayout"

function field(path: string, children?: ResolvedField[]): ResolvedField {
	return {
		path,
		terraformName: path.split(".").at(-1) ?? path,
		kind: "attribute",
		tfType: "string",
		required: false,
		optional: true,
		sensitive: false,
		computed: false,
		deprecated: false,
		label: path,
		relationships: [],
		...(children ? { children } : {}),
	}
}

function view(fields: ResolvedField[]): ResolvedTypeView {
	return {
		fields,
		artifacts: {
			kind: "resource",
			type: "aws_subnet",
			provider: "aws",
			icon: { data: null, error: null, artifactId: null, status: null },
			metadata: { data: null, error: null, artifactId: null, status: null },
			fieldMetadata: {
				data: null,
				error: null,
				artifactId: null,
				status: null,
			},
			relationshipRules: {
				data: null,
				error: null,
				artifactId: null,
				status: null,
			},
			fieldLayout: {
				data: null,
				error: null,
				artifactId: null,
				status: null,
			},
		},
	}
}

function rowNames(rows: readonly FieldLayoutRow[]): string[] {
	return rows.map((row) => (isFieldLayoutGroupRow(row) ? row.title : row.path))
}

describe("resolveFieldLayout", () => {
	it("returns null when the server spec is absent", () => {
		expect(resolveFieldLayout(view([field("vpc_id")]), null)).toBeNull()
	})

	it("maps a server spec onto resolved create and edit sections", () => {
		const spec: ResourceFieldLayoutLlmOutput = {
			create: { title: "Create subnet", rows: ["vpc_id", "cidr_block"] },
			sections: [
				{
					title: "Details",
					rows: [
						"vpc_id",
						"cidr_block",
						{ title: "IPv6", collapsed: true, rows: ["ipv6_cidr_block"] },
					],
				},
			],
		}
		const resolved = resolveFieldLayout(
			view([field("vpc_id"), field("cidr_block"), field("ipv6_cidr_block")]),
			spec,
		)
		if (!resolved) throw new Error("expected layout")

		expect(rowNames(resolved.create.rows)).toEqual(["vpc_id", "cidr_block"])
		expect(resolved.sections.map((section) => section.title)).toEqual([
			"Details",
		])
		expect(rowNames(resolved.sections[0].rows)).toEqual([
			"vpc_id",
			"cidr_block",
			"IPv6",
		])
	})

	it("skips spec rows whose path is absent from the view", () => {
		const spec: ResourceFieldLayoutLlmOutput = {
			create: { title: "Create", rows: ["vpc_id", "gone"] },
			sections: [{ title: "Details", rows: ["vpc_id", "gone"] }],
		}
		const resolved = resolveFieldLayout(view([field("vpc_id")]), spec)
		if (!resolved) throw new Error("expected layout")

		expect(rowNames(resolved.create.rows)).toEqual(["vpc_id"])
		expect(rowNames(resolved.sections[0].rows)).toEqual(["vpc_id"])
	})

	it("recurses into groups and drops groups with no resolvable rows", () => {
		const spec: ResourceFieldLayoutLlmOutput = {
			create: { title: "Create", rows: ["vpc_id"] },
			sections: [
				{
					title: "Details",
					rows: [
						"vpc_id",
						{ title: "Empty", rows: ["nope"] },
						{
							title: "Nested",
							rows: [{ title: "Inner", rows: ["cidr_block"] }],
						},
					],
				},
			],
		}
		const resolved = resolveFieldLayout(
			view([field("vpc_id"), field("cidr_block")]),
			spec,
		)
		if (!resolved) throw new Error("expected layout")

		const details = resolved.sections[0]
		expect(rowNames(details.rows)).toEqual(["vpc_id", "Nested"])
		const nested = details.rows.find(
			(row) => isFieldLayoutGroupRow(row) && row.title === "Nested",
		)
		if (!nested || !isFieldLayoutGroupRow(nested))
			throw new Error("expected Nested group")
		expect(rowNames(nested.rows)).toEqual(["Inner"])
	})

	it("resolves nested child paths via the flattened field tree", () => {
		const spec: ResourceFieldLayoutLlmOutput = {
			create: { title: "Create", rows: ["timeouts.create"] },
			sections: [{ title: "Details", rows: ["timeouts"] }],
		}
		const resolved = resolveFieldLayout(
			view([field("timeouts", [field("timeouts.create")])]),
			spec,
		)
		if (!resolved) throw new Error("expected layout")

		expect(rowNames(resolved.create.rows)).toEqual(["timeouts.create"])
		// A row pointing at the object field keeps its nested children intact.
		const [timeouts] = fieldLayoutRowsToResolvedFields(
			resolved.sections[0].rows,
		)
		expect(timeouts.children?.map((child) => child.path)).toEqual([
			"timeouts.create",
		])
	})

	it("flattens create rows to the deduped resolved fields form uses for edit", () => {
		const spec: ResourceFieldLayoutLlmOutput = {
			create: {
				title: "Create",
				rows: ["vpc_id", { title: "Advanced", rows: ["cidr_block", "vpc_id"] }],
			},
			sections: [{ title: "Details", rows: ["vpc_id", "cidr_block"] }],
		}
		const resolved = resolveFieldLayout(
			view([field("vpc_id"), field("cidr_block")]),
			spec,
		)
		if (!resolved) throw new Error("expected layout")

		expect(
			fieldLayoutRowsToResolvedFields(resolved.create.rows).map(
				(resolvedField) => resolvedField.path,
			),
		).toEqual(["vpc_id", "cidr_block"])
	})
})
