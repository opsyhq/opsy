import * as clack from "@clack/prompts"
import { DEFAULT_API_URL } from "@core/constants"
import { apiError, CliError } from "@core/errors"
import { isJsonOutput } from "@core/output/output-format"
import type { HandlerDeps } from "@core/types/deps"
import {
	PROFILE_API_URL,
	PROFILE_ORG_ID,
	PROFILE_PROJECT,
} from "@shell/config"
import { findLinkFile, removeLinkFile, writeLinkFile } from "@shell/link"

export interface LinkOpts {
	format?: string
}

export async function linkProject(
	deps: HandlerDeps,
	slug: string | undefined,
	opts: LinkOpts,
): Promise<void> {
	let project = slug
	if (!project) {
		const res = await deps.client.projects.$get()
		if (!res.ok) throw apiError(res.status, await res.text())
		const { projects } = await res.json()
		if (projects.length === 0) {
			throw new CliError(
				"no projects to link",
				"NO_PROJECTS",
				"create one first with `opsy project create <slug>`",
			)
		}
		const selected = await clack.select({
			message: "Select a project to link to this directory",
			options: projects.map((p) => ({ value: p.slug, label: p.slug })),
		})
		if (clack.isCancel(selected)) {
			deps.output.note("cancelled")
			return
		}
		project = selected as string
	}
	const path = writeLinkFile(deps, { project })
	if (isJsonOutput(opts)) {
		deps.output.printJson({ project, path })
		return
	}
	deps.output.success(`linked ${project}`)
	deps.output.note(path)
}

export function unlinkProject(deps: HandlerDeps, opts: LinkOpts): void {
	const removed = removeLinkFile(deps)
	if (isJsonOutput(opts)) {
		deps.output.printJson({ removed: removed ?? null })
		return
	}
	if (!removed) {
		deps.output.note("no .opsy/project.json found in this directory tree")
		return
	}
	deps.output.success(`unlinked (removed ${removed})`)
}

type Source = "env" | "link" | "profile" | "default"

export function statusProject(deps: HandlerDeps, opts: LinkOpts): void {
	const found = findLinkFile(deps)
	const linkProjectVal = found?.link?.project ?? null

	const envProject = process.env.OPSY_PROJECT
	let project: string | null
	let projectSource: Source
	if (envProject && envProject.length > 0) {
		project = envProject
		projectSource = "env"
	} else if (linkProjectVal) {
		project = linkProjectVal
		projectSource = "link"
	} else if (PROFILE_PROJECT) {
		project = PROFILE_PROJECT
		projectSource = "profile"
	} else {
		project = null
		projectSource = "default"
	}

	const linkApiUrl = found?.link?.apiUrl ?? null
	let apiUrl: string
	let apiUrlSource: Source
	if (process.env.OPSY_API_URL) {
		apiUrl = process.env.OPSY_API_URL
		apiUrlSource = "env"
	} else if (linkApiUrl) {
		apiUrl = linkApiUrl
		apiUrlSource = "link"
	} else if (PROFILE_API_URL) {
		apiUrl = PROFILE_API_URL
		apiUrlSource = "profile"
	} else {
		apiUrl = DEFAULT_API_URL
		apiUrlSource = "default"
	}

	const linkOrgId = found?.link?.orgId ?? null
	let orgId: string | null
	let orgIdSource: Source
	if (linkOrgId) {
		orgId = linkOrgId
		orgIdSource = "link"
	} else if (PROFILE_ORG_ID) {
		orgId = PROFILE_ORG_ID
		orgIdSource = "profile"
	} else {
		orgId = null
		orgIdSource = "default"
	}

	const linkShadowsProfile =
		linkProjectVal !== null &&
		PROFILE_PROJECT !== undefined &&
		linkProjectVal !== PROFILE_PROJECT

	if (isJsonOutput(opts)) {
		deps.output.printJson({
			project: { value: project, source: projectSource },
			apiUrl: { value: apiUrl, source: apiUrlSource },
			orgId: { value: orgId, source: orgIdSource },
			linkPath: found?.path ?? null,
			profileProject: PROFILE_PROJECT ?? null,
		})
		return
	}

	deps.output.keyValue([
		["project", `${project ?? "(not set)"} (${projectSource})`],
		["api url", `${apiUrl} (${apiUrlSource})`],
		["org id", `${orgId ?? "(not set)"} (${orgIdSource})`],
		["link", found?.path ?? "(none)"],
		["profile project", PROFILE_PROJECT ?? "(not set)"],
	])
	if (linkShadowsProfile) {
		deps.output.warn(
			`link project "${linkProjectVal}" shadows profile project "${PROFILE_PROJECT}"`,
		)
	}
}
