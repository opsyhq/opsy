import { describe, expect, test } from "bun:test"
import { buildFieldTree, type ResourceSchema, type State } from "@opsy/provider"
import type { Resource } from "@/lib/db/schema"
import {
	getReadStateForInputShape,
	getResourceStatePatchAfterRead,
} from "../state"

type ResourceFacts = Pick<Resource, "inputs" | "outputs" | "status">

function resource(
	inputs: Record<string, unknown> | null,
	outputs: Record<string, unknown> | null = null,
	status: Resource["status"] = "live",
): ResourceFacts {
	return { inputs, outputs, status }
}

function cloud(state: Record<string, unknown>): State {
	return state
}

// The fallback shape projection must read array values from provider state,
// then narrow each element through the declared template. Walking the declared
// array positionally corrupts unordered set blocks when providers reorder them.
describe("getReadStateForInputShape — set/list block arrays refresh from cloud", () => {
	test("a reordered set block is faithful per element, not reattributed", () => {
		const declared = [
			{ from_port: 80, protocol: "tcp" },
			{ from_port: 443, protocol: "tcp" },
		]
		// Cloud returns the set reordered, with an extra computed child.
		const observed = [
			{ from_port: 443, protocol: "tcp", security_group_id: "sg-x" },
			{ from_port: 80, protocol: "tcp", security_group_id: "sg-x" },
		]
		const result = getReadStateForInputShape(declared, observed)

		// Each element carries its own provider-read value.
		expect(result).toEqual([
			{ from_port: 443, protocol: "tcp" },
			{ from_port: 80, protocol: "tcp" },
		])
		// Never widens: the computed `security_group_id` is dropped.
		if (!Array.isArray(result)) throw new Error("expected array result")
		expect(result[0]).not.toHaveProperty("security_group_id")
	})

	test("tracks cloud-added and cloud-removed elements (cardinality)", () => {
		const declared = [{ from_port: 80 }]
		expect(
			getReadStateForInputShape(declared, [
				{ from_port: 80 },
				{ from_port: 443 },
			]),
		).toEqual([{ from_port: 80 }, { from_port: 443 }])
		expect(
			getReadStateForInputShape([{ from_port: 80 }, { from_port: 443 }], []),
		).toEqual([])
	})

	test("scalar list refreshes wholesale from cloud (no stale tail)", () => {
		expect(
			getReadStateForInputShape(["10.0.0.0/16"], ["1.1.1.1/32", "2.2.2.2/32"]),
		).toEqual(["1.1.1.1/32", "2.2.2.2/32"])
		expect(getReadStateForInputShape(["a", "b"], ["x"])).toEqual(["x"])
	})

	test("an empty declared array stays empty (never-widen contract)", () => {
		// No template element to narrow cloud rows into — a user-declared-empty
		// block is not silently repopulated from cloud here.
		expect(getReadStateForInputShape([], [{ from_port: 80 }])).toEqual([])
	})

	test("non-array cloud for an array shape keeps the declared shape", () => {
		expect(getReadStateForInputShape([{ a: 1 }], null)).toEqual([{ a: 1 }])
	})
})

describe("getResourceStatePatchAfterRead — set-block reorder no longer churns", () => {
	const declaredInputs = {
		name: "my-sg",
		ingress: [
			{ from_port: 80, protocol: "tcp" },
			{ from_port: 443, protocol: "tcp" },
		],
	}
	const reorderedCloud = {
		name: "my-sg",
		id: "sg-abc123",
		ingress: [
			{ from_port: 443, protocol: "tcp", security_group_id: "sg-x" },
			{ from_port: 80, protocol: "tcp", security_group_id: "sg-x" },
		],
	}

	test("first absorb adopts the cloud ordering, then converges to a no-op", () => {
		const first = getResourceStatePatchAfterRead(
			resource(declaredInputs, null),
			cloud(reorderedCloud),
			null,
		)
		if (!first || !("inputs" in first)) throw new Error("expected a write")
		// Mirror = cloud order, narrowed to declared keys, faithful per element.
		expect(first.inputs.ingress).toEqual([
			{ from_port: 443, protocol: "tcp" },
			{ from_port: 80, protocol: "tcp" },
		])
		expect(first.outputs).toEqual(reorderedCloud)

		// Feed it back: a stable provider returning the same shape is now a
		// no-op (the old positional projection mislabeled but also "converged"
		// to a corrupt mirror; this converges to a faithful one).
		const second = getResourceStatePatchAfterRead(
			resource(first.inputs, first.outputs),
			cloud(reorderedCloud),
			null,
		)
		expect(second).toBeNull()
	})
})

describe("getResourceStatePatchAfterRead — contract", () => {
	test("never widens: a computed-only cloud key is not pulled into the mirror", () => {
		const patch = getResourceStatePatchAfterRead(
			resource({ bucket: "b" }, { bucket: "b" }),
			cloud({ bucket: "b", arn: "arn:aws:s3:::b" }),
			null,
		)
		// outputs changed (arn appeared) so a write is returned, but the
		// declared mirror stays narrowed to `bucket`.
		if (!patch || !("inputs" in patch)) throw new Error("expected a write")
		expect(patch.inputs).toEqual({ bucket: "b" })
		expect(patch.outputs).toEqual({ bucket: "b", arn: "arn:aws:s3:::b" })
	})

	test("no prior inputs: shape is derived from the schema (computed-only dropped)", () => {
		const schema: ResourceSchema = {
			version: 1,
			block: {
				attributes: {
					cidr_block: { required: true },
					arn: { computed: true },
				},
			},
		}
		const patch = getResourceStatePatchAfterRead(
			resource(null, null),
			cloud({ cidr_block: "10.0.0.0/16", arn: "arn:aws:ec2:::vpc/x" }),
			buildFieldTree(schema),
		)
		if (!patch || !("inputs" in patch)) throw new Error("expected a write")
		expect(patch.inputs).toEqual({ cidr_block: "10.0.0.0/16" })
	})

	test("deep-equal inputs and outputs is a no-op", () => {
		expect(
			getResourceStatePatchAfterRead(
				resource({ bucket: "b" }, { bucket: "b" }),
				cloud({ bucket: "b" }),
				null,
			),
		).toBeNull()
	})

	test("read state null flags missing once, then is a no-op", () => {
		expect(
			getResourceStatePatchAfterRead(
				resource({ bucket: "b" }, null, "live"),
				null,
				null,
			),
		).toEqual({ status: "missing" })
		expect(
			getResourceStatePatchAfterRead(
				resource({ bucket: "b" }, null, "missing"),
				null,
				null,
			),
		).toBeNull()
	})

	test("empty inputs still refresh changed outputs", () => {
		const patch = getResourceStatePatchAfterRead(
			resource({}, { id: "old" }),
			cloud({ id: "new" }),
			null,
		)
		if (!patch || !("inputs" in patch)) throw new Error("expected a write")
		expect(patch.inputs).toEqual({})
		expect(patch.outputs).toEqual({ id: "new" })
	})

	test("schema-aware reads refresh map attribute keys", () => {
		const schema: ResourceSchema = {
			version: 1,
			block: {
				attributes: {
					tags: { type: ["map", "string"], optional: true },
				},
			},
		}
		const patch = getResourceStatePatchAfterRead(
			resource({ tags: { Name: "old", stale: "yes" } }, null),
			cloud({ tags: { Name: "new", env: "prod" } }),
			buildFieldTree(schema),
		)
		if (!patch || !("inputs" in patch)) throw new Error("expected a write")
		expect(patch.inputs).toEqual({ tags: { Name: "new", env: "prod" } })
	})

	test("schema-aware reads do not widen an existing declared mirror", () => {
		const schema: ResourceSchema = {
			version: 1,
			block: {
				attributes: {
					name: { optional: true },
					id: { optional: true, computed: true },
				},
			},
		}
		const patch = getResourceStatePatchAfterRead(
			resource({ name: "app" }, { name: "app", id: "old" }),
			cloud({ name: "app", id: "new" }),
			buildFieldTree(schema),
		)
		if (!patch || !("inputs" in patch)) throw new Error("expected a write")
		expect(patch.inputs).toEqual({ name: "app" })
		expect(patch.outputs).toEqual({ name: "app", id: "new" })
	})

	test("schema-aware reads refresh map block keys and drop computed children", () => {
		const schema: ResourceSchema = {
			version: 1,
			block: {
				block_types: {
					setting: {
						nesting_mode: "map",
						block: {
							attributes: {
								value: { optional: true },
								id: { computed: true },
							},
						},
					},
				},
			},
		}
		const patch = getResourceStatePatchAfterRead(
			resource({ setting: { stale: { value: "old" } } }, null),
			cloud({
				setting: {
					current: { value: "new", id: "computed-current" },
					next: { value: "two", id: "computed-next" },
				},
			}),
			buildFieldTree(schema),
		)
		if (!patch || !("inputs" in patch)) throw new Error("expected a write")
		expect(patch.inputs).toEqual({
			setting: {
				current: { value: "new" },
				next: { value: "two" },
			},
		})
	})

	test("schema-aware reads refresh empty set blocks from provider state", () => {
		const schema: ResourceSchema = {
			version: 1,
			block: {
				block_types: {
					ingress: {
						nesting_mode: "set",
						block: {
							attributes: {
								from_port: { required: true },
								protocol: { required: true },
								security_group_id: { computed: true },
							},
						},
					},
				},
			},
		}
		const patch = getResourceStatePatchAfterRead(
			resource({ ingress: [] }, null),
			cloud({
				ingress: [
					{ from_port: 443, protocol: "tcp", security_group_id: "sg-x" },
				],
			}),
			buildFieldTree(schema),
		)
		if (!patch || !("inputs" in patch)) throw new Error("expected a write")
		expect(patch.inputs).toEqual({
			ingress: [{ from_port: 443, protocol: "tcp" }],
		})
	})
})
