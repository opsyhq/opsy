import { describe, expect, it } from "vitest"
import type { ResolvedField } from "@/components/resource-detail/resolvedTypeView"
import {
	buildResolverSchema,
	pruneBlanks,
} from "@/components/resource-fields/resolverSchema"

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

// The regression (#stage-button): facts-only resources seed the edit form with
// blank desired inputs for fields the artifact marks `required`. The client
// resolver must NOT hard-block submit on that — the server plan owns required
// validation. A blocked submit here is silent (no visible error) and the Stage
// button looks dead. Contract: a required-but-blank field still parses.
describe("buildResolverSchema", () => {
	it("does not block submit on a blank required scalar field", () => {
		const schema = buildResolverSchema([
			field({ path: "bucket", required: true, optional: false }),
		])
		expect(schema.safeParse({}).success).toBe(true)
		expect(schema.safeParse({ bucket: "" }).success).toBe(true)
	})

	it("does not block submit on a blank required block field", () => {
		const schema = buildResolverSchema([
			field({
				path: "logging",
				terraformName: "logging",
				kind: "block",
				nestingMode: "list",
				minItems: 0,
				maxItems: 1,
				required: true,
				optional: false,
				children: [field({ path: "logging.target_bucket" })],
			}),
		])
		expect(schema.safeParse({}).success).toBe(true)
		expect(schema.safeParse({ logging: [] }).success).toBe(true)
	})

	// State is TF-native end to end: a `list`/`set` block (`logging`,
	// `versioning`, `website`) is an array of blocks at every layer — the
	// normal representation, not an import-only artifact. A client `z.object()`
	// would reject that array and silently block submit; the resolver must stay
	// permissive (the server plan owns validation).
	it("does not block submit on a TF-native block array value", () => {
		const schema = buildResolverSchema([
			field({
				path: "logging",
				terraformName: "logging",
				kind: "block",
				nestingMode: "list",
				minItems: 0,
				maxItems: 1,
				required: true,
				optional: false,
				children: [field({ path: "logging.target_bucket" })],
			}),
		])
		expect(
			schema.safeParse({ logging: [{ target_bucket: "logs" }] }).success,
		).toBe(true)
		expect(schema.safeParse({ logging: [] }).success).toBe(true)
	})

	it("passes unknown keys through untouched", () => {
		const schema = buildResolverSchema([field({ path: "bucket" })])
		const parsed = schema.parse({ bucket: "b", region: "us-east-1" })
		expect(parsed).toEqual({ bucket: "b", region: "us-east-1" })
	})
})

describe("pruneBlanks", () => {
	it("drops blank values and keeps entered ones", () => {
		expect(
			pruneBlanks({ a: "x", b: "", c: null, d: [], e: { f: "" }, g: { h: 1 } }),
		).toEqual({ a: "x", g: { h: 1 } })
	})

	// A present-empty singleton block is TF-native `[{}]` (the user clicked
	// "Add Versioning" but set no children). Its presence is the signal —
	// pruneBlanks must NOT drop it. The array short-circuit guarantees this:
	// a 1-element array is not blank, so it survives untouched. An absent
	// block (never added) stays dropped.
	it("keeps a present-empty singleton block array; drops an absent one", () => {
		expect(pruneBlanks({ versioning: [{}], website: undefined })).toEqual({
			versioning: [{}],
		})
		expect(pruneBlanks({ versioning: [{ enabled: true }] })).toEqual({
			versioning: [{ enabled: true }],
		})
	})
})
