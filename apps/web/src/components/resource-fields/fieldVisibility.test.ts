import { describe, expect, it } from "vitest"
import { valueAtFieldPath } from "./fieldVisibility"

describe("field visibility", () => {
	it("prefers exact flat field paths over nested object lookup", () => {
		expect(
			valueAtFieldPath(
				{
					"network.subnet_id": "flat",
					network: { subnet_id: "nested" },
				},
				"network.subnet_id",
			),
		).toBe("flat")
	})

	it("reads child paths through arrays and maps", () => {
		expect(
			valueAtFieldPath(
				{
					ingress: [{ from_port: 80 }, { from_port: 443 }],
					rules: {
						web: { port: 80 },
						ssh: { port: 22 },
					},
				},
				"ingress.from_port",
			),
		).toEqual([80, 443])
		expect(
			valueAtFieldPath(
				{
					rules: {
						web: { port: 80 },
						ssh: { port: 22 },
					},
				},
				"rules.port",
			),
		).toEqual([80, 22])
	})
})
