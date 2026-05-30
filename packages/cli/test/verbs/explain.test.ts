import { buildFieldTree } from "@opsy/provider"
import { describe, expect, mock, test } from "bun:test"
import { type FakeOutput, fakeDeps } from "@shell/deps.fake"
import { explainTarget } from "../../src/verbs/explain/handlers"
import { respond } from "./helpers"

// Schema where the "resource" kind has a nested `versioning` block but the
// "data" kind does not — the real-world asymmetry that used to abort the
// whole command when the user passed `--path versioning`. Built through the
// real `buildFieldTree` so the fixture is exactly the envelope the API ships.
const asymmetricSchema = {
	provider: "aws",
	type: "aws_s3_bucket",
	version: "6.44.0",
	kinds: ["resource", "data"],
	resource: buildFieldTree({
		version: 0,
		block: {
			attributes: { bucket: { type: "string", required: true } },
			block_types: {
				versioning: {
					nesting_mode: "list",
					block: {
						attributes: { enabled: { type: "bool", optional: true } },
					},
				},
			},
		},
	}),
	data: buildFieldTree({
		version: 0,
		block: {
			attributes: { bucket: { type: "string", required: true } },
		},
	}),
}

describe("verbs/explain --path with kind=both", () => {
	test("renders the kind that has the block, notes the one that doesn't", async () => {
		const get = mock(() => Promise.resolve(respond(asymmetricSchema)))
		const deps = fakeDeps({
			client: {
				providers: {
					":provider": {
						types: {
							":type": {
								$get: get,
								identity: {
									$get: () =>
										Promise.resolve(
											respond({
												provider: "aws",
												type: "aws_s3_bucket",
												mode: "import-id",
											}),
										),
								},
							},
						},
					},
				},
			} as never,
		})

		await explainTarget(deps, "aws_s3_bucket", undefined, {
			provider: "aws",
			path: "versioning",
		})

		const out = (deps.output as FakeOutput).stdoutMem.value
		// Resource side renders the nested block's attribute.
		expect(out).toContain("RESOURCE SCHEMA")
		expect(out).toContain("enabled")
		// Data side notes the miss instead of aborting.
		expect(out).toContain("DATA SOURCE SCHEMA")
		expect(out).toContain("path not found in data source schema")
	})

	test("propagates non-path errors", async () => {
		const deps = fakeDeps({
			client: {
				providers: {
					":provider": {
						types: {
							":type": {
								$get: () => Promise.resolve(respond("boom", false, 500)),
							},
						},
					},
				},
			} as never,
		})

		await expect(
			explainTarget(deps, "aws_s3_bucket", undefined, {
				provider: "aws",
				path: "versioning",
			}),
		).rejects.toThrow(/500/)
	})
})
