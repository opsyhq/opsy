import { describe, expect, it } from "vitest"
import { defaultsFromSchema } from "./IntegrationForm"

describe("integration form catalog handling", () => {
	it("extracts config defaults from integration schema metadata", () => {
		expect(
			defaultsFromSchema({
				properties: {
					region: { type: "string", default: "us-east-1" },
					profile: { type: "string" },
				},
			}),
		).toEqual({ region: "us-east-1" })
	})
})
