import { apiError, CliError } from "@core/errors"
import { isJsonOutput } from "@core/output/output-format"
import type { HandlerDeps } from "@core/types/deps"
import type { ApprovalFlagOpts } from "@shell/approval"
import { reportStaged } from "@shell/changeset"
import { formatApprovalPolicy } from "@shell/policy"
import { resolveProject } from "@shell/project"
import {
	type DryRunOpts,
	readJsonFlag,
	renderDryRun,
	renderOperation,
	renderResource,
	resolveInputs,
	runMutationOperation,
} from "@shell/render"

type PolicyChoice = "none" | "on_destroy" | "always"

export interface UpdateOpts extends ApprovalFlagOpts, DryRunOpts {
	project?: string
	values?: string
	set: string[]
	setJson: string[]
	setRef: string[]
	unset: string[]
	approvalPolicy?: PolicyChoice
	kind?: string
	name?: string
	default?: boolean
	credentials?: string
	config?: string
	format?: string
	stage?: boolean
}

function hasInputFlags(opts: UpdateOpts): boolean {
	return (
		opts.set.length > 0 ||
		opts.setJson.length > 0 ||
		opts.setRef.length > 0 ||
		opts.unset.length > 0 ||
		opts.values !== undefined
	)
}

export async function updateResource(
	deps: HandlerDeps,
	slug: string,
	opts: UpdateOpts,
): Promise<void> {
	const project = resolveProject(opts.project, deps)
	const inputsTouched = hasInputFlags(opts)
	if (!inputsTouched) {
		throw new CliError(
			"update requires at least one of: --set/--set-json/--set-ref/--unset/--values",
			"NO_CHANGES",
		)
	}
	let base: Record<string, unknown> | undefined
	if (inputsTouched) {
		const getRes = await deps.client.projects[":project"].resources[
			":slug"
		].$get({
			param: { project, slug },
		})
		if (!getRes.ok) throw apiError(getRes.status, await getRes.text())
		const data = await getRes.json()
		base = structuredClone((data.inputs ?? {}) as Record<string, unknown>)
	}
	const body: { inputs: Record<string, unknown> } = {
		inputs: resolveInputs(deps.fs, opts, base),
	}
	if (opts.stage) {
		await reportStaged(
			deps,
			project,
			{
				kind: "update_resource",
				source: "user",
				targetResourceSlug: slug,
				changes: { inputs: body.inputs },
			},
			opts,
			`staged update ${slug}`,
		)
		return
	}
	if (opts.dryRun) {
		const planRes = await deps.client.projects[":project"].resources[
			":slug"
		]["dry-run"].update.$post({
			param: { project, slug },
			json: body,
		})
		if (!planRes.ok) throw apiError(planRes.status, await planRes.text())
		const { dryRun } = await planRes.json()
		renderDryRun(deps, dryRun, opts)
		return
	}
	const res = await deps.client.projects[":project"].resources[":slug"].$patch({
		param: { project, slug },
		json: body,
	})
	if (!res.ok) throw apiError(res.status, await res.text())
	const raw = await res.json()
	await runMutationOperation(deps, raw, opts, (data) => {
		deps.output.section("result")
		renderOperation(deps, data.operation)
		if (data.resource) renderResource(deps, data.resource)
	})
}

export async function updateProject(
	deps: HandlerDeps,
	slug: string,
	opts: UpdateOpts,
): Promise<void> {
	const body: { approvalPolicy?: string[] } = {}
	if (opts.approvalPolicy !== undefined) {
		body.approvalPolicy =
			opts.approvalPolicy === "none" ? [] : [opts.approvalPolicy]
	}
	if (body.approvalPolicy === undefined) {
		throw new CliError(
			"update project requires --approval-policy",
			"NO_CHANGES",
		)
	}
	const res = await deps.client.projects[":project"].$patch({
		param: { project: slug },
		json: body,
	})
	if (!res.ok) throw apiError(res.status, await res.text())
	const { project } = await res.json()
	if (isJsonOutput(opts)) {
		deps.output.printJson({ project })
		return
	}
	deps.output.keyValue([
		["slug", project.slug],
		["approval policy", formatApprovalPolicy(project.approvalPolicy)],
		["updated", project.updatedAt],
	])
}

export async function updateIntegration(
	deps: HandlerDeps,
	slug: string,
	opts: UpdateOpts,
): Promise<void> {
	const project = resolveProject(opts.project, deps)
	const json: {
		name?: string
		default?: boolean
		credentials?: Record<string, unknown>
		config?: Record<string, unknown>
	} = {}
	if (opts.name !== undefined) json.name = opts.name
	if (opts.default) json.default = true
	if (opts.credentials !== undefined)
		json.credentials = readJsonFlag(deps.fs, opts.credentials, "--credentials")
	if (opts.config !== undefined)
		json.config = readJsonFlag(deps.fs, opts.config, "--config")
	if (Object.keys(json).length === 0) {
		throw new CliError(
			"update integration requires at least one of: --default/--name/--credentials/--config",
			"NO_CHANGES",
		)
	}
	const res = await deps.client.projects[":project"].integrations[
		":slug"
	].$patch({
		param: { project, slug },
		json,
	})
	if (!res.ok) throw apiError(res.status, await res.text())
	const { integration } = await res.json()
	if (isJsonOutput(opts)) {
		deps.output.printJson({ integration })
		return
	}
	deps.output.keyValue([
		["id", integration.id],
		["provider", integration.provider],
		["slug", integration.slug],
		["name", integration.name ?? integration.slug],
		["default", integration.isDefault],
	])
}
