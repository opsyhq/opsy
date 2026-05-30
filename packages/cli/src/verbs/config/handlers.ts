import { isJsonOutput } from "@core/output/output-format"
import type { HandlerDeps } from "@core/types/deps"
import {
	ACTIVE_PROFILE,
	API_URL,
	loadConfig,
	PROJECT,
	saveConfig,
} from "@shell/config"

export async function configView(
	deps: HandlerDeps,
	opts: { format?: string },
): Promise<void> {
	const data = {
		profile: ACTIVE_PROFILE,
		apiUrl: API_URL,
		project: PROJECT ?? null,
	}
	if (isJsonOutput(opts)) {
		deps.output.printJson(data)
		return
	}
	deps.output.keyValue([
		["profile", data.profile],
		["api url", data.apiUrl],
		["project", data.project ?? "(not set)"],
	])
}

export function configSetProject(deps: HandlerDeps, slug: string): void {
	const config = loadConfig()
	const profile = config.profiles[config.activeProfile] ?? {}
	profile.project = slug
	config.profiles[config.activeProfile] = profile
	saveConfig(config)
	deps.output.success(`active project set to ${slug}`)
}

export function configClear(deps: HandlerDeps): void {
	const config = loadConfig()
	const profile = config.profiles[config.activeProfile] ?? {}
	// API_URL captures OPSY_API_URL too, so env-only setups survive clear.
	config.profiles[config.activeProfile] = {
		apiUrl: API_URL,
		...(profile.orgId !== undefined ? { orgId: profile.orgId } : {}),
	}
	saveConfig(config)
	deps.output.success(`Config cleared (apiUrl=${API_URL} preserved)`)
}
