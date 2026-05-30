import { describe, expect, test } from "bun:test"
import {
	buildInputsFromFlags,
	coerceValue,
	expandInlineRefs,
	parseAssignment,
} from "@core/inputs/set-path"

describe("coerceValue", () => {
	test("booleans", () => {
		expect(coerceValue("true")).toBe(true)
		expect(coerceValue("false")).toBe(false)
	})

	test("null", () => {
		expect(coerceValue("null")).toBe(null)
	})

	test("integers", () => {
		expect(coerceValue("0")).toBe(0)
		expect(coerceValue("42")).toBe(42)
		expect(coerceValue("-7")).toBe(-7)
	})

	test("floats", () => {
		expect(coerceValue("3.14")).toBe(3.14)
		expect(coerceValue("-0.5")).toBe(-0.5)
	})

	test("scientific notation", () => {
		expect(coerceValue("1e3")).toBe(1000)
		expect(coerceValue("2.5E-1")).toBe(0.25)
	})

	test("strings stay strings", () => {
		expect(coerceValue("hello")).toBe("hello")
		expect(coerceValue("")).toBe("")
		expect(coerceValue("truthy")).toBe("truthy")
		expect(coerceValue("123abc")).toBe("123abc")
		expect(coerceValue("00")).toBe("00")
	})
})

describe("parseAssignment", () => {
	test("normal key=value", () => {
		expect(parseAssignment("bucket=my-bucket")).toEqual(["bucket", "my-bucket"])
	})

	test("value containing equals", () => {
		expect(parseAssignment("tag=a=b")).toEqual(["tag", "a=b"])
	})

	test("empty value", () => {
		expect(parseAssignment("key=")).toEqual(["key", ""])
	})

	test("throws on missing =", () => {
		expect(() => parseAssignment("noequals")).toThrow("missing '='")
	})
})

describe("buildInputsFromFlags", () => {
	test("nested --set", () => {
		const result = buildInputsFromFlags({}, ["versioning.enabled=true"], [], [])
		expect(result).toEqual({ versioning: { enabled: true } })
	})

	test("--set-json for arrays", () => {
		const result = buildInputsFromFlags(
			{},
			[],
			['ingress=[{"from_port":443}]'],
			[],
		)
		expect(result).toEqual({ ingress: [{ from_port: 443 }] })
	})

	test("--unset removes a key", () => {
		const result = buildInputsFromFlags(
			{ tags: { env: "prod", team: "platform" } },
			[],
			[],
			["tags.env"],
		)
		expect(result).toEqual({ tags: { team: "platform" } })
	})

	test("combined set + unset", () => {
		const result = buildInputsFromFlags(
			{ tags: { env: "prod" }, bucket: "old" },
			["tags.team=platform", "bucket=new"],
			[],
			["tags.env"],
		)
		expect(result).toEqual({ tags: { team: "platform" }, bucket: "new" })
	})

	test("creates intermediate objects", () => {
		const result = buildInputsFromFlags({}, ["a.b.c=deep"], [], [])
		expect(result).toEqual({ a: { b: { c: "deep" } } })
	})

	test("creates intermediate arrays for numeric indices", () => {
		const result = buildInputsFromFlags({}, ["rules[0].name=first"], [], [])
		expect(result).toEqual({ rules: [{ name: "first" }] })
	})

	test("mutates and returns the base object", () => {
		const base = { key: "original" }
		const result = buildInputsFromFlags(base, ["key=changed"], [], [])
		expect(result).toEqual({ key: "changed" })
		expect(result).toBe(base)
	})

	test("--set-json throws on invalid JSON", () => {
		expect(() => buildInputsFromFlags({}, [], ["key={bad}"], [])).toThrow(
			"invalid --set-json",
		)
	})

	test("--set-json rewrites whole-string ${slug.path} to {$ref}", () => {
		const result = buildInputsFromFlags(
			{},
			[],
			['tags={"SG":"${sg-1.id}","env":"prod"}'],
			[],
		)
		expect(result).toEqual({ tags: { SG: { $ref: "sg-1.id" }, env: "prod" } })
	})

	test("--set-json leaves partial templates literal", () => {
		const result = buildInputsFromFlags(
			{},
			[],
			['user_data="hello ${name}"'],
			[],
		)
		expect(result).toEqual({ user_data: "hello ${name}" })
	})

	test("--set-json recurses into arrays", () => {
		const result = buildInputsFromFlags(
			{},
			[],
			['security_groups=["${sg-1.id}","${sg-2.id}"]'],
			[],
		)
		expect(result).toEqual({
			security_groups: [{ $ref: "sg-1.id" }, { $ref: "sg-2.id" }],
		})
	})
})

describe("expandInlineRefs", () => {
	test("rewrites whole-string ref", () => {
		expect(expandInlineRefs("${vpc.id}")).toEqual({ $ref: "vpc.id" })
	})
	test("leaves bare ${foo} alone (no path)", () => {
		expect(expandInlineRefs("${foo}")).toBe("${foo}")
	})
	test("leaves partial templates alone", () => {
		expect(expandInlineRefs("prefix-${vpc.id}")).toBe("prefix-${vpc.id}")
	})
	test("descends nested", () => {
		expect(expandInlineRefs({ a: { b: ["${x.id}"] } })).toEqual({
			a: { b: [{ $ref: "x.id" }] },
		})
	})
	test("leaves primitives alone", () => {
		expect(expandInlineRefs(42)).toBe(42)
		expect(expandInlineRefs(null)).toBe(null)
		expect(expandInlineRefs(true)).toBe(true)
	})
})
