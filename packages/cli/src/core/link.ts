// Per-directory project link, written to `.opsy/project.json`. Pure parsing
// only — the I/O (upward walk, write, remove) lives in `shell/link.ts`.
// Mirrors Vercel's `.vercel/project.json` convention.

export interface LinkFile {
	project: string
	orgId?: string
	apiUrl?: string
}

export const LINK_DIR = ".opsy"
export const LINK_FILE = "project.json"

// Never throws: a malformed or non-conforming link file is treated as absent
// so resolution falls through to the next precedence level rather than erroring.
export function parseLinkFile(raw: string): LinkFile | null {
	let data: unknown
	try {
		data = JSON.parse(raw)
	} catch {
		return null
	}
	if (!data || typeof data !== "object") return null
	const rec = data as Record<string, unknown>
	if (typeof rec.project !== "string" || rec.project.length === 0) return null
	return {
		project: rec.project,
		...(typeof rec.orgId === "string" ? { orgId: rec.orgId } : {}),
		...(typeof rec.apiUrl === "string" ? { apiUrl: rec.apiUrl } : {}),
	}
}
