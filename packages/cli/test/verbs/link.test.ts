import { join } from "node:path"
import { afterAll, beforeEach, describe, expect, mock, test } from "bun:test"
import { CliError } from "@core/errors"
import type { HandlerDeps } from "@core/types/deps"
import * as realCfg from "@shell/config"
import { type FakeOutput, fakeDeps } from "@shell/deps.fake"
import { respond } from "./helpers"

// Interactive picker + profile sources are the seams under test — mock both.
let selectResult: unknown = "picked"
let cancelled = false
mock.module("@clack/prompts", () => ({
	select: async () => selectResult,
	isCancel: () => cancelled,
}))

function mockCfg(
	over: { project?: string; apiUrl?: string; orgId?: string } = {},
): void {
	mock.module("@shell/config", () => ({
		...realCfg,
		PROFILE_PROJECT: over.project,
		PROFILE_API_URL: over.apiUrl,
		PROFILE_ORG_ID: over.orgId,
	}))
}
mockCfg()
const { linkProject, unlinkProject, statusProject } = await import(
	"../../src/verbs/link/handlers"
)

const linkPath = (dir: string) => join(dir, ".opsy", "project.json")
const ignorePath = (dir: string) => join(dir, ".opsy", ".gitignore")

function vfsDeps(
	cwd: string,
	files: Record<string, string>,
	client?: unknown,
): HandlerDeps {
	return fakeDeps({
		cwd: () => cwd,
		...(client ? { client: client as never } : {}),
		fs: {
			existsSync: (p: string) =>
				Object.prototype.hasOwnProperty.call(files, p),
			readFileSync: (p: string) => {
				if (!(p in files)) throw new Error(`ENOENT ${p}`)
				return files[p] as string
			},
			mkdirSync: () => {},
			writeFileSync: (p: string, d: string) => {
				files[p] = d
			},
			unlinkSync: (p: string) => {
				delete files[p]
			},
		} as never,
	})
}

beforeEach(() => {
	selectResult = "picked"
	cancelled = false
	mockCfg()
	delete process.env.OPSY_PROJECT
	delete process.env.OPSY_API_URL
})
afterAll(() =>
	mockCfg({
		project: realCfg.PROFILE_PROJECT,
		apiUrl: realCfg.PROFILE_API_URL,
		orgId: realCfg.PROFILE_ORG_ID,
	}),
)

describe("verbs/link/linkProject", () => {
	test("explicit slug writes project.json + self-executing gitignore", async () => {
		const files: Record<string, string> = {}
		const deps = vfsDeps("/w", files)
		await linkProject(deps, "demo", {})
		expect(JSON.parse(files[linkPath("/w")] as string)).toEqual({
			project: "demo",
		})
		expect(files[ignorePath("/w")]).toBe("*\n")
		expect((deps.output as FakeOutput).stdoutMem.value).toContain(
			"linked demo",
		)
	})

	test("json mode prints the project + path", async () => {
		const files: Record<string, string> = {}
		const deps = vfsDeps("/w", files)
		await linkProject(deps, "demo", { format: "json" })
		expect(JSON.parse((deps.output as FakeOutput).stdoutMem.value)).toEqual({
			project: "demo",
			path: linkPath("/w"),
		})
	})

	test("no slug → interactive pick over the project list", async () => {
		selectResult = "chosen"
		const files: Record<string, string> = {}
		const deps = vfsDeps("/w", files, {
			projects: {
				$get: () =>
					Promise.resolve(
						respond({ projects: [{ slug: "a" }, { slug: "chosen" }] }),
					),
			},
		})
		await linkProject(deps, undefined, {})
		expect(JSON.parse(files[linkPath("/w")] as string)).toEqual({
			project: "chosen",
		})
	})

	test("no slug + cancelled picker → no write", async () => {
		cancelled = true
		const files: Record<string, string> = {}
		const deps = vfsDeps("/w", files, {
			projects: {
				$get: () =>
					Promise.resolve(respond({ projects: [{ slug: "a" }] })),
			},
		})
		await linkProject(deps, undefined, {})
		expect(files[linkPath("/w")]).toBeUndefined()
		expect((deps.output as FakeOutput).stdoutMem.value).toContain("cancelled")
	})

	test("no slug + empty project list → NO_PROJECTS", async () => {
		const deps = vfsDeps("/w", {}, {
			projects: {
				$get: () => Promise.resolve(respond({ projects: [] })),
			},
		})
		await expect(linkProject(deps, undefined, {})).rejects.toMatchObject({
			code: "NO_PROJECTS",
		})
	})
})

describe("verbs/link/unlinkProject", () => {
	test("removes the nearest link file", () => {
		const files: Record<string, string> = {
			[linkPath("/w")]: JSON.stringify({ project: "demo" }),
		}
		const deps = vfsDeps("/w/sub", files)
		unlinkProject(deps, {})
		expect(files[linkPath("/w")]).toBeUndefined()
		expect((deps.output as FakeOutput).stdoutMem.value).toContain("unlinked")
	})

	test("no link present → note, no throw", () => {
		const deps = vfsDeps("/w", {})
		unlinkProject(deps, {})
		expect((deps.output as FakeOutput).stdoutMem.value).toContain(
			"no .opsy/project.json",
		)
	})
})

describe("verbs/link/statusProject (source annotations)", () => {
	test("link is the source and shadows a differing profile", () => {
		mockCfg({ project: "profile-proj" })
		const files: Record<string, string> = {
			[linkPath("/w")]: JSON.stringify({ project: "link-proj" }),
		}
		const deps = vfsDeps("/w", files)
		statusProject(deps, {})
		expect((deps.output as FakeOutput).stdoutMem.value).toContain(
			"link-proj (link)",
		)
		expect((deps.output as FakeOutput).stderrMem.value).toContain(
			"shadows profile project",
		)
	})

	test("env beats link for the project source", () => {
		process.env.OPSY_PROJECT = "env-proj"
		const deps = vfsDeps("/w", {
			[linkPath("/w")]: JSON.stringify({ project: "link-proj" }),
		})
		statusProject(deps, {})
		expect((deps.output as FakeOutput).stdoutMem.value).toContain(
			"env-proj (env)",
		)
	})

	test("json mode reports value + source per field", () => {
		mockCfg({ project: "p" })
		const deps = vfsDeps("/w", {})
		statusProject(deps, { format: "json" })
		const j = JSON.parse((deps.output as FakeOutput).stdoutMem.value)
		expect(j.project).toEqual({ value: "p", source: "profile" })
		expect(j.apiUrl.source).toBe("default")
	})
})
