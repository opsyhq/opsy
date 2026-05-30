import { describe, expect, test } from "bun:test"
import { getProperty } from "@core/inputs/dot-path"

const obj = {
	slug: "my-bucket",
	inputs: null,
	outputs: {
		arn: "arn:aws:s3:::my-bucket",
		count: 0,
		enabled: false,
		nested: { dns_name: "abc.example.com" },
		tags: ["a", "b"],
	},
}

describe("getProperty", () => {
	test("top-level + nested + array index resolve", () => {
		expect(getProperty(obj, "slug")).toEqual({
			found: true,
			value: "my-bucket",
		})
		expect(getProperty(obj, "outputs.nested.dns_name")).toEqual({
			found: true,
			value: "abc.example.com",
		})
		expect(getProperty(obj, "outputs.tags[1]")).toEqual({
			found: true,
			value: "b",
		})
	})

	test("falsy-but-present values are found, not missed", () => {
		expect(getProperty(obj, "outputs.count")).toEqual({ found: true, value: 0 })
		expect(getProperty(obj, "outputs.enabled")).toEqual({
			found: true,
			value: false,
		})
		// present and explicitly null — distinct from absent
		expect(getProperty(obj, "inputs")).toEqual({ found: true, value: null })
	})

	test("absent path, descent through a primitive, and empty path miss", () => {
		expect(getProperty(obj, "outputs.nope")).toEqual({ found: false })
		expect(getProperty(obj, "slug.deeper")).toEqual({ found: false })
		expect(getProperty(obj, "inputs.x")).toEqual({ found: false })
		expect(getProperty(obj, "")).toEqual({ found: false })
	})
})
