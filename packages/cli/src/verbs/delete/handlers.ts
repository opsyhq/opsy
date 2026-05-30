import { apiError } from "@core/errors"
import { isJsonOutput } from "@core/output/output-format"
import type { HandlerDeps } from "@core/types/deps"
import type { ApprovalFlagOpts } from "@shell/approval"
import { reportStaged } from "@shell/changeset"
import { resolveProject } from "@shell/project"
import {
	type DryRunOpts,
	renderDryRun,
	renderOperation,
	renderResource,
	runMutationOperation,
} from "@shell/render"

export interface DeleteOpts extends ApprovalFlagOpts, DryRunOpts {
	project?: string
	forget?: boolean
	force?: boolean
	cascade?: boolean
	kind?: string
	name?: string
	format?: string
	stage?: boolean
}

const forceQuery = (force?: boolean) =>
	force ? { force: "true" as const } : {}
export async function deleteResource(
	deps: HandlerDeps,
	slug: string,
	opts: DeleteOpts,
): Promise<void> {
	const project = resolveProject(opts.project, deps)
	if (opts.stage) {
		if (opts.cascade) {
			deps.output.note(
				"--cascade is ignored when staging; the changeset apply graph orders dependent deletes",
			)
		}
		await reportStaged(
			deps,
			project,
			{
				kind: "delete_resource",
				source: "user",
				targetResourceSlug: slug,
				changes: { mode: opts.forget ? "forget" : "delete" },
			},
			opts,
			`staged delete ${slug}`,
		)
		return
	}
	if (opts.forget) {
		const res = await deps.client.projects[":project"].resources[
			":slug"
		].forget.$post({
			param: { project, slug },
		})
		if (!res.ok) throw apiError(res.status, await res.text())
		await runMutationOperation(deps, await res.json(), opts, (data) => {
			deps.output.section("result")
			renderOperation(deps, data.operation)
			if (data.resource) renderResource(deps, data.resource)
		})
		return
	}
	if (opts.dryRun) {
		const planRes = await deps.client.projects[":project"].resources[
			":slug"
		]["dry-run"].delete.$post({
			param: { project, slug },
		})
		if (!planRes.ok) throw apiError(planRes.status, await planRes.text())
		const { dryRun } = await planRes.json()
		renderDryRun(deps, dryRun, opts)
		return
	}
	const res = await deps.client.projects[":project"].resources[":slug"].$delete(
		{
			param: { project, slug },
		},
	)
	if (!res.ok) throw apiError(res.status, await res.text())
	const raw = await res.json()
	await runMutationOperation(deps, raw, opts, (data) => {
		deps.output.section("result")
		renderOperation(deps, data.operation)
		if (data.resource) renderResource(deps, data.resource)
	})
}

export async function deleteProject(
	deps: HandlerDeps,
	slug: string,
	opts: DeleteOpts = {},
): Promise<void> {
	const res = await deps.client.projects[":project"].$delete({
		param: { project: slug },
		query: forceQuery(opts.force),
	})
	if (!res.ok) throw apiError(res.status, await res.text())
	deps.output.success(`deleted ${slug}`)
}

export async function deleteIntegration(
	deps: HandlerDeps,
	slug: string,
	opts: DeleteOpts,
): Promise<void> {
	const project = resolveProject(opts.project, deps)
	const res = await deps.client.projects[":project"].integrations[
		":slug"
	].$delete({
		param: { project, slug },
		query: forceQuery(opts.force),
	})
	if (!res.ok) throw apiError(res.status, await res.text())
	const data = await res.json()
	if (isJsonOutput(opts)) {
		deps.output.printJson(data)
		return
	}
	if (data.deleted) {
		deps.output.success(`deleted integration ${slug}`)
	} else {
		deps.output.note(`integration ${slug} was already deleted`)
	}
}
