// Unit tests for the pure ref AST — substitution against a hand-built target
// map, no DB, no providers. The DB-backed getReferenceTargetsBySlug() is exercised in
// the integration tests for create-with-refs.

import { describe, expect, test } from "bun:test"
import {
	extractRefs,
	getAt,
	isRefNode,
	REF_PATH_REGEX,
	type RefTarget,
	substituteRefs,
} from "../ast"

function liveRow(slug: string, outputs: Record<string, unknown>): RefTarget {
	return { slug, ok: true, state: outputs }
}

function targets(...rows: RefTarget[]): Map<string, RefTarget> {
	return new Map(rows.map((r) => [r.slug, r]))
}

describe("REF_PATH_REGEX", () => {
	test("accepts simple slug.path forms", () => {
		expect(REF_PATH_REGEX.test("vpc.id")).toBe(true)
		expect(REF_PATH_REGEX.test("frontend-cert.domain_name")).toBe(true)
		expect(REF_PATH_REGEX.test("a.b.c.d")).toBe(true)
		expect(REF_PATH_REGEX.test("vpc.subnets[0].id")).toBe(true)
		expect(REF_PATH_REGEX.test("vpc.subnets[0][1]")).toBe(true)
		expect(
			REF_PATH_REGEX.test("cert.domainValidationOptions[0].resourceRecordName"),
		).toBe(true)
	})

	test("rejects malformed forms", () => {
		expect(REF_PATH_REGEX.test("vpc")).toBe(false)
		expect(REF_PATH_REGEX.test(".id")).toBe(false)
		expect(REF_PATH_REGEX.test("vpc.")).toBe(false)
		expect(REF_PATH_REGEX.test("VPC.id")).toBe(false)
		expect(REF_PATH_REGEX.test("vpc.${id}")).toBe(false)
	})
})

describe("isRefNode", () => {
	test("recognizes valid ref nodes only", () => {
		expect(isRefNode({ $ref: "a.b" })).toBe(true)
		expect(isRefNode({ $ref: "a.b", extra: 1 })).toBe(true)
		expect(isRefNode({ ref: "a.b" })).toBe(false)
		expect(isRefNode("$ref:a.b")).toBe(false)
		expect(isRefNode(["$ref"])).toBe(false)
		expect(isRefNode(null)).toBe(false)
		expect(isRefNode({ $ref: 42 })).toBe(false)
	})
})

describe("getAt", () => {
	test("walks objects and arrays via dot + [N] notation", () => {
		const tree = { a: { b: [{ c: 7 }, { c: 8 }] } }
		expect(getAt(tree, "a.b[0].c")).toBe(7)
		expect(getAt(tree, "a.b[1].c")).toBe(8)
		expect(getAt(tree, "a.missing")).toBeUndefined()
	})
})

describe("extractRefs", () => {
	test("collects unique slugs from nested values", () => {
		const inputs = {
			ami: { $ref: "al2023.id" },
			tags: [{ $ref: "tags.app" }, { $ref: "al2023.kernel_id" }],
			subnetId: { $ref: "primary-subnet.id" },
		}
		expect(extractRefs(inputs).sort()).toEqual([
			"al2023",
			"primary-subnet",
			"tags",
		])
	})

	test("ignores ref-shaped strings", () => {
		const inputs = { policy: "${aws:username}", note: "$foo" }
		expect(extractRefs(inputs)).toEqual([])
	})

	test("rejects malformed $ref values up front", () => {
		expect(() => extractRefs({ x: { $ref: "no_dot" } })).toThrow(
			/invalid \$ref/,
		)
		expect(() => extractRefs({ x: { $ref: "UPPER.id" } })).toThrow(
			/invalid \$ref/,
		)
	})
})

describe("substituteRefs", () => {
	test("resolves nested refs to scalar values", () => {
		const inputs = {
			ami: { $ref: "al2023.id" },
			tags: { Owner: { $ref: "owner.email" } },
		}
		const out = substituteRefs(
			inputs,
			targets(
				liveRow("al2023", { id: "ami-0abc" }),
				liveRow("owner", { email: "ops@example.com" }),
			),
		)
		expect(out).toEqual({
			ami: "ami-0abc",
			tags: { Owner: "ops@example.com" },
		})
	})

	test("resolves inside arrays", () => {
		const inputs = { ids: [{ $ref: "a.id" }, { $ref: "b.id" }] }
		const out = substituteRefs(
			inputs,
			targets(liveRow("a", { id: 1 }), liveRow("b", { id: 2 })),
		)
		expect(out).toEqual({ ids: [1, 2] })
	})

	test("resolves array-indexed paths", () => {
		const inputs = {
			name: { $ref: "cert.domainValidationOptions[0].resourceRecordName" },
		}
		const out = substituteRefs(
			inputs,
			targets(
				liveRow("cert", {
					domainValidationOptions: [{ resourceRecordName: "_abc.example.com" }],
				}),
			),
		)
		expect(out).toEqual({ name: "_abc.example.com" })
	})

	test("leaves provider-native syntax untouched", () => {
		const inputs = {
			policy: '{"Statement":[{"Resource":"${aws:username}"}]}',
			user_data: "#!/bin/bash\necho ${HOME}",
		}
		const out = substituteRefs(inputs, targets())
		expect(out).toEqual(inputs)
	})

	test("ref_not_found when target slug is absent", () => {
		expect(() =>
			substituteRefs({ ami: { $ref: "missing.id" } }, targets()),
		).toThrow(/ref_not_found/)
	})

	test("ref_not_ready when target is not live", () => {
		const target: RefTarget = { slug: "vpc", ok: false, reason: "not_ready" }
		expect(() =>
			substituteRefs({ vpcId: { $ref: "vpc.id" } }, targets(target)),
		).toThrow(/ref_not_ready/)
	})

	test("ref_target_missing when cloud reports the resource gone", () => {
		const target: RefTarget = { slug: "vpc", ok: false, reason: "missing" }
		expect(() =>
			substituteRefs({ vpcId: { $ref: "vpc.id" } }, targets(target)),
		).toThrow(/ref_target_missing/)
	})

	test("ref_path_missing when target lacks the field", () => {
		expect(() =>
			substituteRefs(
				{ ami: { $ref: "al2023.no_such_field" } },
				targets(liveRow("al2023", { id: "ami-0abc" })),
			),
		).toThrow(/ref_path_missing/)
	})

	test("returns scalars unchanged when no refs present", () => {
		const out = substituteRefs({ a: 1, b: "x", c: [true, null, 2] }, targets())
		expect(out).toEqual({ a: 1, b: "x", c: [true, null, 2] })
	})
})
