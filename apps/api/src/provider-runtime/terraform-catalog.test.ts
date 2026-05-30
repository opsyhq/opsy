import { describe, expect, test } from "bun:test"
import { parseTerraformProviderCatalog } from "./terraform-catalog"

describe("parseTerraformProviderCatalog", () => {
	test("parses pipe-delimited provider versions", () => {
		expect(
			parseTerraformProviderCatalog(
				"aws=hashicorp/aws@6.44.0|6.45.0,null=hashicorp/null@3.2.3",
			),
		).toEqual([
			{
				name: "aws",
				source: "hashicorp/aws",
				versions: ["6.44.0", "6.45.0"],
			},
			{
				name: "null",
				source: "hashicorp/null",
				versions: ["3.2.3"],
			},
		])
	})

	test("merges repeated sources without dropping versions", () => {
		expect(
			parseTerraformProviderCatalog(
				"hashicorp/aws@6.45.0,aws=hashicorp/aws@6.44.0|6.45.0",
			),
		).toEqual([
			{
				name: "aws",
				source: "hashicorp/aws",
				versions: ["6.44.0", "6.45.0"],
			},
		])
	})
})
