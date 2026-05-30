import { describe, expect, it } from "vitest"
import type { ResolvedField } from "@/components/resource-detail/resolvedTypeView"
import {
	isInlineBlock,
	relationshipSelectableLabel,
	relationshipTargetRefLabel,
	resolveResourceFieldInput,
	resolveResourceFieldWidgetKind,
	resourceFieldValueWidgetKind,
} from "./resourceFieldInput"

function field(
	input: Partial<ResolvedField> & { path: string },
): ResolvedField {
	const { path, ...rest } = input
	return {
		path,
		terraformName: path,
		kind: "attribute",
		tfType: "string",
		required: false,
		optional: true,
		sensitive: false,
		computed: false,
		deprecated: false,
		label: path,
		relationships: [],
		...rest,
	}
}

function subnetRelationship(): ResolvedField["relationships"][number] {
	return {
		key: "subnet-rule",
		fieldPath: "subnet_id",
		selectable: {
			kind: "resource",
			type: "aws_subnet",
			path: "id",
		},
		cardinality: "one",
	}
}

describe("resolveResourceFieldWidgetKind", () => {
	it("uses Terraform schema type shapes for controls", () => {
		expect(resolveResourceFieldWidgetKind("bool", false)).toBe("bool")
		expect(resolveResourceFieldWidgetKind("number", false)).toBe("number")
		expect(resolveResourceFieldWidgetKind("string", false)).toBe("text")
		expect(resolveResourceFieldWidgetKind("string", true)).toBe("password")
		expect(resolveResourceFieldWidgetKind(["list", "string"], false)).toBe(
			"list",
		)
		expect(resolveResourceFieldWidgetKind(["set", "number"], false)).toBe(
			"list",
		)
		expect(resolveResourceFieldWidgetKind(["map", "string"], false)).toBe("kv")
		expect(resolveResourceFieldWidgetKind(["map", ["object", {}]], false)).toBe(
			"json",
		)
		expect(resolveResourceFieldWidgetKind(["object", {}], false)).toBe("json")
		expect(
			resolveResourceFieldWidgetKind(["list", ["object", {}]], false),
		).toBe("json")
	})
})

describe("isInlineBlock", () => {
	it("is true only for single/group blocks (always-present object groups)", () => {
		expect(isInlineBlock({ kind: "block", nestingMode: "single" })).toBe(true)
		expect(isInlineBlock({ kind: "block", nestingMode: "group" })).toBe(true)
		// A max_items==1 singleton list/set is a collection, not an inline
		// group — it routes to ObjectArrayInput (Add X capped at 1).
		expect(isInlineBlock({ kind: "block", nestingMode: "list" })).toBe(false)
		expect(isInlineBlock({ kind: "block", nestingMode: "set" })).toBe(false)
		expect(isInlineBlock({ kind: "block", nestingMode: "map" })).toBe(false)
		expect(isInlineBlock({ kind: "attribute", nestingMode: undefined })).toBe(
			false,
		)
	})
})

describe("resolveResourceFieldInput", () => {
	it("resolves an object-typed attribute as a nested field group", () => {
		expect(
			resolveResourceFieldInput(
				field({
					path: "root_block_device",
					kind: "attribute",
					tfType: ["object", { volume_size: "number" }],
					children: [
						field({
							path: "root_block_device.volume_size",
							tfType: "number",
						}),
					],
				}),
			),
		).toEqual({ kind: "field-group" })
	})

	it("resolves a single block as a nested field group", () => {
		expect(
			resolveResourceFieldInput(
				field({
					path: "root_block_device",
					kind: "block",
					nestingMode: "single",
					minItems: 0,
					maxItems: 1,
					children: [field({ path: "root_block_device.volume_size" })],
				}),
			),
		).toEqual({ kind: "field-group" })
	})

	it("resolves a max_items==1 singleton list block as a collection, not a field group", () => {
		expect(
			resolveResourceFieldInput(
				field({
					path: "versioning",
					kind: "block",
					nestingMode: "list",
					minItems: 0,
					maxItems: 1,
					children: [field({ path: "versioning.enabled", tfType: "bool" })],
				}),
			),
		).toEqual({ kind: "json" })
	})

	it("resolves relationship fields with their manual fallback control", () => {
		expect(
			resolveResourceFieldInput(
				field({
					path: "subnet_id",
					relationships: [subnetRelationship()],
				}),
			),
		).toMatchObject({
			kind: "relationship",
			manualWidgetKind: "text",
			relationship: { cardinality: "one" },
		})
	})
})

describe("resourceFieldValueWidgetKind", () => {
	it("keeps render/write controls out of component branching", () => {
		const relationshipInput = resolveResourceFieldInput(
			field({
				path: "subnet_id",
				relationships: [subnetRelationship()],
			}),
		)

		expect(resourceFieldValueWidgetKind({ kind: "field-group" })).toBeNull()
		expect(resourceFieldValueWidgetKind({ kind: "number" })).toBe("number")
		expect(resourceFieldValueWidgetKind(relationshipInput)).toBe("text")
	})
})

describe("relationship display helpers", () => {
	it("names the selectable target types and selected target refs", () => {
		const subnet = {
			...subnetRelationship(),
			selectable: {
				kind: "resource" as const,
				type: "aws_subnet",
				path: "arn",
			},
		}
		const securityGroup = {
			...subnetRelationship(),
			key: "security-group-rule",
			selectable: {
				kind: "resource" as const,
				type: "aws_security_group",
				path: "id",
			},
		}
		const relationship = {
			relationships: [subnet, securityGroup],
			cardinality: "one" as const,
		}

		expect(relationshipSelectableLabel(relationship)).toBe(
			"aws_subnet / aws_security_group",
		)
		expect(
			relationshipTargetRefLabel(
				{
					slug: "private-subnet",
					type: "aws_subnet",
					ref: { $ref: "private-subnet.arn" },
				},
				relationship,
			),
		).toBe("private-subnet.arn")
	})
})
