import { describe, expect, test } from "bun:test"
import { buildFieldTree, type ResourceSchema } from "@opsy/provider"
import {
	type ResourceFieldLayoutLlmOutput,
	resourceFieldLayoutInput,
} from "./block"
import {
	fieldLayoutCoverage,
	validateResourceFieldLayoutCoverage,
	validateResourceFieldLayoutPartition,
} from "./validators"

function schema(block: NonNullable<ResourceSchema["block"]>) {
	return buildFieldTree({ version: 0, block })
}

// Synthetic subnet-shaped schema; the writable field set is derived through the
// real prompt-field builder so the oracle is exercised against true tree order
// and prefix nesting (timeouts.*, ingress.*).
const subnetInput = resourceFieldLayoutInput({
	provider: "aws",
	kind: "resource",
	type: "aws_subnet",
	schema: schema({
		attributes: {
			cidr_block: { type: "string", required: true },
			vpc_id: {
				type: "string",
				required: true,
				description: "ID of the owning VPC.",
			},
			availability_zone: { type: "string", optional: true },
			map_public_ip_on_launch: { type: "bool", optional: true },
			enable_dns64: { type: "bool", optional: true },
			tags: { type: ["map", "string"], optional: true },
			id: { type: "string", computed: true },
		},
		block_types: {
			timeouts: {
				nesting_mode: "list",
				max_items: 1,
				block: {
					attributes: {
						create: { type: "string", optional: true },
						delete: { type: "string", optional: true },
					},
				},
			},
			ingress: {
				nesting_mode: "set",
				block: {
					attributes: {
						from_port: { type: "number", required: true },
						to_port: { type: "number", optional: true },
					},
				},
			},
		},
	}),
	schemaHash: "hash",
})

const fields = subnetInput.fields

const goodLayout: ResourceFieldLayoutLlmOutput = {
	create: { title: "Create subnet", rows: ["vpc_id", "cidr_block"] },
	sections: [
		{
			title: "Details",
			rows: [
				"vpc_id",
				"cidr_block",
				"availability_zone",
				"map_public_ip_on_launch",
				"tags",
				"id",
				"timeouts",
				"ingress",
				{ title: "DNS", rows: ["enable_dns64"] },
			],
		},
	],
}

describe("field-layout prompt fields", () => {
	test("derives all field paths in tree order, computed-only included", () => {
		expect(fields.map((field) => field.path)).toEqual([
			"cidr_block",
			"vpc_id",
			"availability_zone",
			"map_public_ip_on_launch",
			"enable_dns64",
			"tags",
			"id",
			"timeouts",
			"timeouts.create",
			"timeouts.delete",
			"ingress",
			"ingress.from_port",
			"ingress.to_port",
		])
		expect(fields.find((f) => f.path === "ingress")?.repeatedObject).toBe(true)
		expect(fields.find((f) => f.path === "timeouts")?.repeatedObject).toBe(
			false,
		)
		expect(fields.find((f) => f.path === "id")).toMatchObject({
			path: "id",
			required: false,
			optional: false,
			computed: true,
		})
	})
})

describe("field-layout coverage oracle", () => {
	test("a complete partitioned layout has no coverage or partition gaps", () => {
		const coverage = fieldLayoutCoverage({ fields, layout: goodLayout })
		expect(coverage.unplacedPaths).toEqual([])
		expect(coverage.unplacedRequiredPaths).toEqual([])
		expect(coverage.missingSpecPaths).toEqual([])
		expect(coverage.repeatedObjectPaths).toEqual(["ingress"])
		expect(coverage.createOnlyPaths).toEqual([])
		expect(
			validateResourceFieldLayoutCoverage({ fields, layout: goodLayout }),
		).toEqual([])
		expect(
			validateResourceFieldLayoutPartition({ layout: goodLayout }),
		).toEqual([])
	})

	test("placing a parent path covers its nested descendants", () => {
		const coverage = fieldLayoutCoverage({
			fields,
			layout: {
				create: { title: "Create", rows: ["vpc_id", "cidr_block"] },
				sections: [
					{
						title: "Details",
						rows: [
							"vpc_id",
							"cidr_block",
							"availability_zone",
							"map_public_ip_on_launch",
							"enable_dns64",
							"tags",
							"id",
							"timeouts",
							"ingress",
						],
					},
				],
			},
		})
		expect(coverage.unplacedPaths).toEqual([])
		expect(coverage.placedPaths).toContain("timeouts.create")
		expect(coverage.placedPaths).toContain("ingress.from_port")
	})

	test("an unplaced optional path is reported", () => {
		const layout: ResourceFieldLayoutLlmOutput = {
			...goodLayout,
			sections: [
				{
					title: "Details",
					rows: [
						"vpc_id",
						"cidr_block",
						"map_public_ip_on_launch",
						"tags",
						"id",
						"timeouts",
						"ingress",
						{ title: "DNS", rows: ["enable_dns64"] },
					],
				},
			],
		}
		const coverage = fieldLayoutCoverage({ fields, layout })
		expect(coverage.unplacedPaths).toEqual(["availability_zone"])
		expect(coverage.unplacedRequiredPaths).toEqual([])
		const issues = validateResourceFieldLayoutCoverage({ fields, layout })
		expect(issues.map((issue) => issue.message)).toContain(
			"Every supplied writable field path must be placed in an edit section.",
		)
	})

	test("a path placed only in the create section is rejected", () => {
		// availability_zone is curated into create but never given an edit
		// section — the shape the create-only check now refuses at generation.
		const layout: ResourceFieldLayoutLlmOutput = {
			create: {
				title: "Create",
				rows: ["vpc_id", "cidr_block", "availability_zone"],
			},
			sections: [
				{
					title: "Details",
					rows: [
						"vpc_id",
						"cidr_block",
						"map_public_ip_on_launch",
						"enable_dns64",
						"tags",
						"id",
						"timeouts",
						"ingress",
					],
				},
			],
		}
		const coverage = fieldLayoutCoverage({ fields, layout })
		expect(coverage.createOnlyPaths).toEqual(["availability_zone"])
		expect(coverage.unplacedPaths).toEqual(["availability_zone"])
		expect(
			validateResourceFieldLayoutCoverage({ fields, layout }).map(
				(issue) => issue.message,
			),
		).toContain(
			"Every create path must also appear in an edit section; the edit sections are the complete surface.",
		)
	})

	test("an unplaced required path is reported as a required gap", () => {
		const layout: ResourceFieldLayoutLlmOutput = {
			create: { title: "Create", rows: ["vpc_id"] },
			sections: [
				{
					title: "Details",
					rows: [
						"vpc_id",
						"availability_zone",
						"map_public_ip_on_launch",
						"enable_dns64",
						"tags",
						"timeouts",
						"ingress",
					],
				},
			],
		}
		const coverage = fieldLayoutCoverage({ fields, layout })
		expect(coverage.unplacedPaths).toContain("cidr_block")
		expect(coverage.unplacedRequiredPaths).toEqual(["cidr_block"])
		expect(
			validateResourceFieldLayoutCoverage({ fields, layout }).map(
				(issue) => issue.message,
			),
		).toContain("Required fields must appear in a visible scan-line row.")
	})

	test("a path not in the supplied fields is reported as missing", () => {
		const layout: ResourceFieldLayoutLlmOutput = {
			...goodLayout,
			sections: [
				{
					title: "Details",
					rows: [...goodLayout.sections[0].rows, "not_a_real_field"],
				},
			],
		}
		const coverage = fieldLayoutCoverage({ fields, layout })
		expect(coverage.missingSpecPaths).toEqual(["not_a_real_field"])
		expect(
			validateResourceFieldLayoutCoverage({ fields, layout }).map(
				(issue) => issue.message,
			),
		).toContain(
			"Layout references paths that are not in the supplied field list.",
		)
	})
})

describe("field-layout partition oracle", () => {
	test("a direct field row after a group row is rejected", () => {
		const issues = validateResourceFieldLayoutPartition({
			layout: {
				create: { title: "Create", rows: ["vpc_id", "cidr_block"] },
				sections: [
					{
						title: "Details",
						rows: [
							"vpc_id",
							{ title: "DNS", rows: ["enable_dns64"] },
							"availability_zone",
						],
					},
				],
			},
		})
		expect(issues).toHaveLength(1)
		expect(issues[0]?.path).toBe("sections.0.rows.2")
		expect(issues[0]?.message).toBe(
			"A direct field row may not appear after a group row in the same list.",
		)
	})

	test("a section that is only groups is rejected", () => {
		const issues = validateResourceFieldLayoutPartition({
			layout: {
				create: { title: "Create", rows: ["vpc_id", "cidr_block"] },
				sections: [
					{
						title: "Details",
						rows: [
							"vpc_id",
							"cidr_block",
							"availability_zone",
							"map_public_ip_on_launch",
							"enable_dns64",
							"tags",
							"timeouts",
							"ingress",
						],
					},
					{
						title: "Operations",
						rows: [{ title: "Timeouts", rows: ["timeouts"] }],
					},
				],
			},
		})
		expect(issues).toHaveLength(1)
		expect(issues[0]?.path).toBe("sections.1.rows")
		expect(issues[0]?.message).toBe(
			"A section must contain at least one direct scan-line field row, not only groups.",
		)
	})

	test("an empty group is rejected", () => {
		const issues = validateResourceFieldLayoutPartition({
			layout: {
				create: { title: "Create", rows: ["vpc_id", "cidr_block"] },
				sections: [
					{
						title: "Details",
						rows: ["vpc_id", { title: "Empty", rows: [] }],
					},
				],
			},
		})
		expect(issues).toHaveLength(1)
		expect(issues[0]?.path).toBe("sections.0.rows.1")
		expect(issues[0]?.message).toBe("A group must contain at least one row.")
	})
})
