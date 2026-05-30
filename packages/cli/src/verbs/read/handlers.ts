import { apiError } from "@core/errors"
import type { HandlerDeps } from "@core/types/deps"
import type { ApprovalFlagOpts } from "@shell/approval"
import { resolveProject } from "@shell/project"
import {
	renderOperation,
	renderResource,
	runMutationOperation,
} from "@shell/render"
export interface ReadOpts extends ApprovalFlagOpts {
	project?: string
	format?: string
}

export async function readResource(
	deps: HandlerDeps,
	slug: string,
	opts: ReadOpts,
): Promise<void> {
	const project = resolveProject(opts.project, deps)
	const res = await deps.client.projects[":project"].resources[
		":slug"
	].read.$post({
		param: { project, slug },
	})
	if (!res.ok) throw apiError(res.status, await res.text())
	await runMutationOperation(deps, await res.json(), opts, (data) => {
		deps.output.section("result")
		renderOperation(deps, data.operation)
		if (data.resource) renderResource(deps, data.resource)
	})
}
