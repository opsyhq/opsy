import { describe, expect, test } from "bun:test"
import { buildFieldTree, type ResourceSchema } from "@opsy/provider"
import {
	collectSchemaPromptFields,
	RESOURCE_TYPE_DISPLAY_METADATA_CANDIDATE_MODEL,
	RESOURCE_TYPE_DISPLAY_METADATA_FIELD_OPTIONS,
	RESOURCE_TYPE_DISPLAY_METADATA_MODEL,
} from "./block"

const schema: ResourceSchema = {
	version: 0,
	block: {
		description: "Manages an example route table attachment.",
		attributes: Object.fromEntries(
			Array.from({ length: 48 }, (_, index) => [
				`field_${index}`,
				{
					type: "string",
					optional: true,
					computed: index === 1,
					description: index === 0 ? "A".repeat(200) : `Field ${index}`,
				},
			]),
		),
		block_types: {
			nested: {
				nesting_mode: "list",
				block: {
					attributes: {
						deep_id: {
							type: "string",
							optional: true,
							description: "A nested field that should not bloat the prompt.",
						},
					},
				},
			},
		},
	},
}

describe("resource type display metadata block", () => {
	test("uses the mini display metadata model", () => {
		expect(RESOURCE_TYPE_DISPLAY_METADATA_MODEL).toBe("gpt-5.4-mini")
		expect(RESOURCE_TYPE_DISPLAY_METADATA_CANDIDATE_MODEL).toBe("gpt-5.4-mini")
	})

	test("keeps the production prompt field sample compact and shallow", () => {
		const fields = collectSchemaPromptFields(
			buildFieldTree(schema).identity.fields,
			RESOURCE_TYPE_DISPLAY_METADATA_FIELD_OPTIONS,
		)
		expect(fields).toHaveLength(16)
		expect(fields[0].description).toHaveLength(123)
		expect(fields[1].computed).toBe(true)
		expect(JSON.stringify(fields)).not.toContain("deep_id")
	})
})
