import { describe, expect, mock, test } from "bun:test"
import { type FakeOutput, fakeDeps } from "@shell/deps.fake"
import { scanProject } from "../../src/verbs/scan/handlers"
import { respond } from "./helpers"

describe("verbs/scan/scanProject", () => {
	test("posts to the project scan endpoint", async () => {
		const post = mock(() =>
			Promise.resolve(
				respond({
					operation: {
						id: "operation-1",
						kind: "scan",
						status: "pending",
					},
				}),
			),
		)
		const deps = fakeDeps({
			client: {
				projects: {
					":project": { scan: { $post: post } },
				},
			} as never,
		})

		await scanProject(deps, "demo", {})

		expect(post).toHaveBeenCalledWith({ param: { project: "demo" } })
		const out = (deps.output as FakeOutput).stdoutMem.value
		expect(out).toContain("scan started")
		expect(out).not.toContain("operation-1")
	})

	test("json mode prints the raw payload", async () => {
		const payload = {
			operation: {
				id: "operation-json",
				kind: "scan",
				status: "pending",
			},
		}
		const deps = fakeDeps({
			client: {
				projects: {
					":project": {
						scan: { $post: () => Promise.resolve(respond(payload)) },
					},
				},
			} as never,
		})

		await scanProject(deps, "demo", { format: "json" })

		expect(JSON.parse((deps.output as FakeOutput).stdoutMem.value)).toEqual(
			payload,
		)
	})
})
