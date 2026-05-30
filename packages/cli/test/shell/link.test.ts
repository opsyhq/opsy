import { join } from "node:path"
import { afterAll, beforeEach, describe, expect, mock, test } from "bun:test"
import { CliError } from "@core/errors"
import type { HandlerDeps } from "@core/types/deps"
// Real config namespace — captured before the mock is installed so the mock
// can default to the real values (a leaked mock then behaves identically).
import * as realCfg from "@shell/config"
import { fakeDeps } from "@shell/deps.fake"
import { findLinkFile, resolveLinkProject } from "@shell/link"

// Bunsnapshots the namespace at mock-registration time, so re-mock per scenario
// with a plain value rather than a getter.
function mockProfile(project: string | undefined): void {
	mock.module("@shell/config", () => ({ ...realCfg, PROFILE_PROJECT: project }))
}
mockProfile(undefined)
// project.ts binds PROFILE_PROJECT from ./config — import it *after* the mock.
const { resolveProject } = await import("@shell/project")

function vfsDeps(
	cwd: string,
	files: Record<string, string>,
): HandlerDeps {
	return fakeDeps({
		cwd: () => cwd,
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

const linkPath = (dir: string) => join(dir, ".opsy", "project.json")

beforeEach(() => {
	mockProfile(undefined)
	delete process.env.OPSY_PROJECT
})
// Restore the real config module so a leaked mock can't perturb other files.
afterAll(() => mockProfile(realCfg.PROFILE_PROJECT))

describe("shell/link/findLinkFile (upward walk)", () => {
	test("finds the nearest ancestor link, git-style", () => {
		const root = "/work/repo"
		const deps = vfsDeps(join(root, "a", "b"), {
			[linkPath(root)]: JSON.stringify({ project: "from-root" }),
		})
		const found = findLinkFile(deps)
		expect(found?.path).toBe(linkPath(root))
		expect(found?.link?.project).toBe("from-root")
	})

	test("returns null when no link exists up to fs root", () => {
		const deps = vfsDeps("/work/repo/a", {})
		expect(findLinkFile(deps)).toBeNull()
		expect(resolveLinkProject(deps)).toBeNull()
	})

	test("malformed link yields path but a null link (resolution skips it)", () => {
		const dir = "/work/repo"
		const deps = vfsDeps(dir, { [linkPath(dir)]: "{ not json" })
		const found = findLinkFile(deps)
		expect(found?.path).toBe(linkPath(dir))
		expect(found?.link).toBeNull()
		expect(resolveLinkProject(deps)).toBeNull()
	})
})

describe("shell/project/resolveProject (4-level precedence)", () => {
	test("--project flag wins over env and link", () => {
		process.env.OPSY_PROJECT = "from-env"
		const deps = vfsDeps("/w", {
			[linkPath("/w")]: JSON.stringify({ project: "from-link" }),
		})
		expect(resolveProject("from-flag", deps)).toBe("from-flag")
	})

	test("OPSY_PROJECT used when set and non-empty", () => {
		process.env.OPSY_PROJECT = "from-env"
		expect(resolveProject(undefined, vfsDeps("/w", {}))).toBe("from-env")
	})

	test('OPSY_PROJECT="" is treated as unset and falls to the link', () => {
		process.env.OPSY_PROJECT = ""
		const deps = vfsDeps("/w", {
			[linkPath("/w")]: JSON.stringify({ project: "from-link" }),
		})
		expect(resolveProject(undefined, deps)).toBe("from-link")
	})

	test("link file used when no flag/env", () => {
		const deps = vfsDeps("/w/sub", {
			[linkPath("/w")]: JSON.stringify({ project: "from-link" }),
		})
		expect(resolveProject(undefined, deps)).toBe("from-link")
	})

	test("profile project is the back-compat fallback", () => {
		mockProfile("from-profile")
		expect(resolveProject(undefined, vfsDeps("/w", {}))).toBe("from-profile")
	})

	test("malformed link with nothing else → NO_PROJECT", () => {
		const deps = vfsDeps("/w", { [linkPath("/w")]: "{ not json" })
		expect(() => resolveProject(undefined, deps)).toThrow(CliError)
		try {
			resolveProject(undefined, deps)
		} catch (e) {
			expect((e as CliError).code).toBe("NO_PROJECT")
		}
	})

	test("all sources absent → NO_PROJECT", () => {
		try {
			resolveProject(undefined, vfsDeps("/w", {}))
			throw new Error("expected throw")
		} catch (e) {
			expect(e).toBeInstanceOf(CliError)
			expect((e as CliError).code).toBe("NO_PROJECT")
		}
	})
})
