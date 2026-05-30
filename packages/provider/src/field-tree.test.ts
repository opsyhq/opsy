import type { ResourceSchema } from "@opsy/bridge-client"
import { describe, expect, test } from "bun:test"
import { buildFieldTree, buildResourceReferenceFields } from "./field-tree"

function schema(block: NonNullable<ResourceSchema["block"]>): ResourceSchema {
	return { version: 0, block }
}

describe("buildFieldTree", () => {
	test("includes every attribute, marking computed-only ones non-editable", () => {
		const input = schema({
			attributes: {
				name: { type: "string", required: true },
				cidr_block: { type: "string", optional: true, computed: true },
				arn: { type: "string", computed: true },
			},
		})

		const { fields } = buildFieldTree(input).identity
		expect(fields.map((field) => field.name.path)).toEqual([
			"name",
			"cidr_block",
			"arn",
		])
		expect(fields[1]).toMatchObject({
			kind: "attribute",
			name: { terraformName: "cidr_block", path: "cidr_block" },
			optional: true,
			computed: true,
		})
		expect(fields[2]).toMatchObject({
			kind: "attribute",
			name: { terraformName: "arn", path: "arn" },
			required: false,
			optional: false,
			computed: true,
		})
	})

	test("reference fields include schema outputs without exposing sensitive fields", () => {
		const input = schema({
			attributes: {
				name: { type: "string", required: true },
				arn: { type: "string", computed: true },
				password: { type: "string", computed: true, sensitive: true },
				endpoint: {
					type: [
						"object",
						{
							address: "string",
							port: "number",
						},
					],
					computed: true,
				},
				tags: { type: ["map", "string"], optional: true },
			},
			block_types: {
				service_connect_defaults: {
					nesting_mode: "list",
					max_items: 1,
					block: {
						attributes: {
							namespace: { type: "string", computed: true },
						},
					},
				},
				setting: {
					nesting_mode: "set",
					block: {
						attributes: {
							name: { type: "string", optional: true },
							value: { type: "string", optional: true },
						},
					},
				},
			},
		})

		expect(
			buildResourceReferenceFields(buildFieldTree(input).identity.fields),
		).toEqual([
			"name",
			"arn",
			"endpoint.address",
			"endpoint.port",
			"tags",
			"service_connect_defaults.namespace",
			"setting",
		])
	})
})
