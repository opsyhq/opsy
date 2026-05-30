import { describe, expect, test } from "bun:test"
import { formatResource, resourceStatus } from "@core/render/resource"

const base = { slug: "x", type: "t", status: "live" as const, deletedAt: null }

describe("formatResource", () => {
	test("emits section + keyValue with status from backend", () => {
		expect(
			formatResource({
				slug: "my-bucket",
				type: "aws_s3_bucket",
				status: "live",
				deletedAt: null,
			}),
		).toEqual([
			{ op: "section", title: "resource" },
			{
				op: "keyValue",
				rows: [
					["slug", "my-bucket"],
					["type", "aws_s3_bucket"],
					["status", "live"],
				],
			},
		])
	})
})

describe("resourceStatus", () => {
	test("passes backend status through", () => {
		expect(resourceStatus({ ...base, status: "live" })).toBe("live")
		expect(resourceStatus({ ...base, status: "creating" })).toBe("creating")
		expect(resourceStatus({ ...base, status: "updating" })).toBe("updating")
		expect(resourceStatus({ ...base, status: "deleting" })).toBe("deleting")
		expect(resourceStatus({ ...base, status: "importing" })).toBe("importing")
		expect(resourceStatus({ ...base, status: "missing" })).toBe("missing")
	})
	test("soft-deleted outranks lifecycle status", () => {
		expect(
			resourceStatus({
				...base,
				status: "live",
				deletedAt: "2026-05-16T00:00:00.000Z",
			}),
		).toBe("deleted")
	})
})
