import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import { DEFAULT_API_URL } from "@core/constants"

interface OpsyConfig {
	activeProfile: string
	profiles: Record<
		string,
		{
			apiUrl?: string
			project?: string
			orgId?: string
		}
	>
}

export const CONFIG_DIR = join(homedir(), ".opsy")
const CONFIG_PATH = join(CONFIG_DIR, "config.json")

const DEFAULT_CONFIG: OpsyConfig = {
	activeProfile: "default",
	profiles: { default: {} },
}

function readConfigFile(): OpsyConfig {
	if (!existsSync(CONFIG_PATH)) return structuredClone(DEFAULT_CONFIG)
	try {
		return JSON.parse(readFileSync(CONFIG_PATH, "utf8")) as OpsyConfig
	} catch {
		return structuredClone(DEFAULT_CONFIG)
	}
}

// Snapshot loaded once at module init. CLI invocations are short-lived and
// each fresh invocation re-reads the file, so a per-process snapshot is the
// right granularity. The `context` commands that mutate the file go through
// `loadConfig`/`saveConfig` and don't see the snapshot.
const _initial = readConfigFile()
const _profile = _initial.profiles[_initial.activeProfile] ?? {}

export const ACTIVE_PROFILE = _initial.activeProfile
export const API_URL =
	process.env.OPSY_API_URL ?? _profile.apiUrl ?? DEFAULT_API_URL
export const PROJECT = process.env.OPSY_PROJECT ?? _profile.project

// Raw profile values (env/link not folded in) — `resolveProject` needs the
// profile project as a distinct precedence level below the link file, and
// `opsy status` annotates each value with the source it came from.
export const PROFILE_PROJECT = _profile.project
export const PROFILE_API_URL = _profile.apiUrl
export const PROFILE_ORG_ID = _profile.orgId

export function loadConfig(): OpsyConfig {
	return readConfigFile()
}

export function saveConfig(config: OpsyConfig): void {
	if (!existsSync(CONFIG_DIR))
		mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 })
	writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2))
}
