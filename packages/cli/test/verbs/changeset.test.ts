import { describe, expect, mock, test } from "bun:test"
import { type FakeOutput, fakeDeps } from "@shell/deps.fake"
import {
	changesetApply,
	changesetStatus,
} from "../../src/verbs/changeset/handlers"
import { createResource } from "../../src/verbs/create/handlers"
import { deleteResource } from "../../src/verbs/delete/handlers"
import { respond } from "./helpers"

const draft = (items: unknown[] = [], status = "draft") => ({
	id: "cs-1",
	status,
	title: null,
	items,
	createdAt: "2026-05-15T00:00:00Z",
	updatedAt: "2026-05-15T00:00:00Z",
})

describe("verbs/changeset/status", () => {
	test("renders the active changeset", async () => {
		const deps = fakeDeps({
			client: {
				projects: {
					":project": {
						changesets: {
							active: {
								$get: () =>
									Promise.resolve(
										respond({
											draft: draft([
												{
													id: "it-1",
													kind: "create_resource",
													targetResourceSlug: "web",
													resourceType: "aws_s3_bucket",
													validationStatus: "unknown",
													validationResult: null,
													source: "user",
													createdAt: "2026-05-15T00:00:00Z",
												},
											]),
											applying: [],
										}),
									),
							},
						},
					},
				},
			} as never,
		})

		await changesetStatus(deps, undefined, { project: "demo" })

		const out = (deps.output as FakeOutput).stdoutMem.value
		expect(out).toContain("cs-1")
		expect(out).toContain("it-1")
		expect(out).toContain("create_resource")
	})

	test("notes when there is no active changeset", async () => {
		const deps = fakeDeps({
			client: {
				projects: {
					":project": {
						changesets: {
							active: {
								$get: () =>
									Promise.resolve(
										respond({ draft: null, applying: [] }),
									),
							},
						},
					},
				},
			} as never,
		})

		await changesetStatus(deps, undefined, { project: "demo" })

		expect((deps.output as FakeOutput).stdoutMem.value).toContain(
			"(no active changeset)",
		)
	})
})

describe("verbs/changeset/apply", () => {
	test("--no-wait submits and returns immediately", async () => {
		const applyPost = mock(() =>
			Promise.resolve(respond({ changeSet: draft([{}], "applying") })),
		)
		const deps = fakeDeps({
			client: {
				projects: {
					":project": {
						changesets: {
							active: {
								$get: () =>
									Promise.resolve(
										respond({ draft: draft([{}]), applying: [] }),
									),
							},
							":id": { apply: { $post: applyPost } },
						},
					},
				},
			} as never,
		})

		await changesetApply(deps, { project: "demo", wait: false })

		expect(applyPost).toHaveBeenCalledWith({
			param: { project: "demo", id: "cs-1" },
		})
		expect((deps.output as FakeOutput).stdoutMem.value).toContain(
			"run `opsy changeset status`",
		)
	})

	test("polls until a terminal status", async () => {
		let polls = 0
		const get = mock(() => {
			polls += 1
			return Promise.resolve(
				respond(polls < 2 ? draft([{}], "applying") : draft([{}], "applied")),
			)
		})
		const deps = fakeDeps({
			client: {
				projects: {
					":project": {
						changesets: {
							active: {
								$get: () =>
									Promise.resolve(
										respond({ draft: draft([{}]), applying: [] }),
									),
							},
							":id": {
								apply: {
									$post: () =>
										Promise.resolve(
											respond({ changeSet: draft([{}], "applying") }),
										),
								},
								$get: get,
							},
						},
					},
				},
			} as never,
		})

		await changesetApply(deps, { project: "demo" })

		expect(polls).toBeGreaterThanOrEqual(1)
		expect((deps.output as FakeOutput).stdoutMem.value).toContain(
			"status: applied",
		)
	})

	test("rolls back to draft and surfaces the failed item (resumable retry)", async () => {
		let polls = 0
		const get = mock(() => {
			polls += 1
			return Promise.resolve(
				respond(
					polls < 2
						? draft([{}], "applying")
						: draft(
								[
									{
										id: "it-1",
										kind: "create_resource",
										targetResourceSlug: "web",
										resourceType: "aws_s3_bucket",
										validationStatus: "valid",
										validationResult: null,
										applyStatus: "failed",
										applyError: { message: "bucket exists" },
										source: "user",
										createdAt: "2026-05-15T00:00:00Z",
									},
								],
								"draft",
							),
				),
			)
		})
		const deps = fakeDeps({
			client: {
				projects: {
					":project": {
						changesets: {
							active: {
								$get: () =>
									Promise.resolve(
										respond({ draft: draft([{}]), applying: [] }),
									),
							},
							":id": {
								apply: {
									$post: () =>
										Promise.resolve(
											respond({ changeSet: draft([{}], "applying") }),
										),
								},
								$get: get,
							},
						},
					},
				},
			} as never,
		})

		await expect(changesetApply(deps, { project: "demo" })).rejects.toThrow(
			/not applied \(status=draft\)/,
		)
		expect((deps.output as FakeOutput).stderrMem.value).toContain(
			"apply failed — bucket exists",
		)
	})

	test("throws when the changeset fails", async () => {
		const deps = fakeDeps({
			client: {
				projects: {
					":project": {
						changesets: {
							active: {
								$get: () =>
									Promise.resolve(
										respond({ draft: draft([{}]), applying: [] }),
									),
							},
							":id": {
								apply: {
									$post: () =>
										Promise.resolve(
											respond({ changeSet: draft([{}], "failed") }),
										),
								},
							},
						},
					},
				},
			} as never,
		})

		expect(changesetApply(deps, { project: "demo" })).rejects.toThrow(
			/status=failed/,
		)
	})
})

describe("verbs/*/--stage", () => {
	test("create resource --stage stages a create_resource item", async () => {
		const itemsPost = mock(() => Promise.resolve(respond(draft())))
		const deps = fakeDeps({
			client: {
				providers: {
					":provider": {
						types: {
							":type": {
								identity: { $get: () => Promise.resolve(respond({})) },
							},
						},
					},
				},
				projects: {
					":project": {
						changesets: {
							active: { $post: () => Promise.resolve(respond(draft())) },
							":id": { items: { $post: itemsPost } },
						},
					},
				},
			} as never,
		})

		await createResource(deps, "web", {
			project: "demo",
			type: "aws_s3_bucket",
			set: ["bucket=my-bucket"],
			setJson: [],
			setRef: [],
			unset: [],
			stage: true,
		} as never)

		expect(itemsPost).toHaveBeenCalled()
		const body = itemsPost.mock.calls[0][0].json
		expect(body.kind).toBe("create_resource")
		expect(body.changes.slug).toBe("web")
		expect((deps.output as FakeOutput).stdoutMem.value).toContain(
			"staged create web",
		)
	})

	test("delete resource --stage stages a delete_resource item", async () => {
		const itemsPost = mock(() => Promise.resolve(respond(draft())))
		const deps = fakeDeps({
			client: {
				projects: {
					":project": {
						changesets: {
							active: { $post: () => Promise.resolve(respond(draft())) },
							":id": { items: { $post: itemsPost } },
						},
					},
				},
			} as never,
		})

		await deleteResource(deps, "old-db", {
			project: "demo",
			forget: true,
			stage: true,
		} as never)

		const body = itemsPost.mock.calls[0][0].json
		expect(body.kind).toBe("delete_resource")
		expect(body.targetResourceSlug).toBe("old-db")
		expect(body.changes.mode).toBe("forget")
	})
})
