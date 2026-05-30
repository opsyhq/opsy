// I/O for the per-directory project link. The upward walk stops at the first
// `.opsy/project.json` found (git-like), so a nearer link always wins and a
// malformed one shadows farther ones rather than being skipped.

import { dirname, join } from "node:path"
import { LINK_DIR, LINK_FILE, type LinkFile, parseLinkFile } from "@core/link"
import type { HandlerDeps } from "@core/types/deps"

export interface FoundLink {
	// null when the file exists but is malformed — callers still get `path`
	// (so `unlink` can remove it) while resolution treats it as absent.
	link: LinkFile | null
	path: string
}

export function findLinkFile(deps: HandlerDeps): FoundLink | null {
	let dir = deps.cwd()
	while (true) {
		const path = join(dir, LINK_DIR, LINK_FILE)
		if (deps.fs.existsSync(path)) {
			return { link: parseLinkFile(deps.fs.readFileSync(path, "utf8")), path }
		}
		const parent = dirname(dir)
		if (parent === dir) return null
		dir = parent
	}
}

export function resolveLinkProject(deps: HandlerDeps): string | null {
	return findLinkFile(deps)?.link?.project ?? null
}

export function writeLinkFile(deps: HandlerDeps, link: LinkFile): string {
	const dir = join(deps.cwd(), LINK_DIR)
	if (!deps.fs.existsSync(dir)) deps.fs.mkdirSync(dir, { recursive: true })
	const filePath = join(dir, LINK_FILE)
	deps.fs.writeFileSync(filePath, `${JSON.stringify(link, null, 2)}\n`)
	// Self-executing gitignore (Vercel's pattern): the link dir excludes itself
	// so a freshly-linked repo never accidentally commits local context.
	const gitignore = join(dir, ".gitignore")
	if (!deps.fs.existsSync(gitignore)) deps.fs.writeFileSync(gitignore, "*\n")
	return filePath
}

export function removeLinkFile(deps: HandlerDeps): string | null {
	const found = findLinkFile(deps)
	if (!found) return null
	deps.fs.unlinkSync(found.path)
	return found.path
}
