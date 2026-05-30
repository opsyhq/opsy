import { describe, expect, it } from "vitest"
import {
	formatOperationFailure,
	type OperationDetailResponse,
} from "./operationReactQuery"

// Minimal structural builder — formatOperationFailure only reads
// operation.{closedAt,status,kind,error} and resource.slug.
function detail(input: {
	closedAt: string | null
	status: string
	kind: string
	error?: Record<string, unknown> | null
	resourceSlug?: string | null
}): OperationDetailResponse {
	return {
		operation: {
			closedAt: input.closedAt,
			status: input.status,
			kind: input.kind,
			error: input.error,
		},
		resource:
			input.resourceSlug === undefined
				? null
				: input.resourceSlug === null
					? null
					: { slug: input.resourceSlug },
	} as unknown as OperationDetailResponse
}

describe("formatOperationFailure", () => {
	it("returns null while the operation is still open (no closedAt)", () => {
		expect(
			formatOperationFailure(
				detail({ closedAt: null, status: "running", kind: "create" }),
			),
		).toBeNull()
	})

	it("returns null for a terminal operation that did not fail", () => {
		expect(
			formatOperationFailure(
				detail({
					closedAt: "2026-05-16T00:00:00Z",
					status: "succeeded",
					kind: "create",
				}),
			),
		).toBeNull()
	})

	it("formats kind + resource slug + reason for a failed operation", () => {
		expect(
			formatOperationFailure(
				detail({
					closedAt: "2026-05-16T00:00:00Z",
					status: "failed",
					kind: "create",
					error: { message: "bucket already exists" },
					resourceSlug: "demo-bucket",
				}),
			),
		).toBe("create demo-bucket failed: bucket already exists")
	})

	it("omits the reason when error.message is missing or non-string", () => {
		for (const error of [
			null,
			{},
			{ message: 42 },
			{ message: { nested: true } },
		]) {
			expect(
				formatOperationFailure(
					detail({
						closedAt: "2026-05-16T00:00:00Z",
						status: "failed",
						kind: "apply",
						error,
						resourceSlug: "vpc",
					}),
				),
			).toBe("apply vpc failed")
		}
	})

	it("falls back to 'resource' when no resource is attached", () => {
		expect(
			formatOperationFailure(
				detail({
					closedAt: "2026-05-16T00:00:00Z",
					status: "failed",
					kind: "import",
					error: { message: "unknown provider id" },
					resourceSlug: null,
				}),
			),
		).toBe("import resource failed: unknown provider id")
	})
})
