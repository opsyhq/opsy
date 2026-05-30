import { describe, expect, test } from "bun:test"
import { importResourceBody } from "../schemas"

// An import is import-id mode XOR identity mode — exactly one. The bridge
// owns identity-attribute typing, so identity values stay raw strings here.
describe("importResourceBody — providerId XOR identity", () => {
	const common = { slug: "my-bucket", type: "aws_s3_bucket" }

	test("accepts import-id mode", () => {
		const parsed = importResourceBody.safeParse({
			...common,
			providerId: "my-bucket",
		})
		expect(parsed.success).toBe(true)
	})

	test("accepts identity mode with structured attributes", () => {
		const parsed = importResourceBody.safeParse({
			...common,
			identity: { bucket: "my-bucket", region: "us-east-1" },
		})
		expect(parsed.success).toBe(true)
	})

	test("rejects supplying both", () => {
		const parsed = importResourceBody.safeParse({
			...common,
			providerId: "my-bucket",
			identity: { bucket: "my-bucket" },
		})
		expect(parsed.success).toBe(false)
	})

	test("rejects supplying neither", () => {
		expect(importResourceBody.safeParse(common).success).toBe(false)
	})

	test("rejects an empty identity object", () => {
		const parsed = importResourceBody.safeParse({ ...common, identity: {} })
		expect(parsed.success).toBe(false)
	})
})
