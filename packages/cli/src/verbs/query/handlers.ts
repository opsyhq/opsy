import { apiError, CliError } from "@core/errors"
import { isJsonOutput } from "@core/output/output-format"
import type { HandlerDeps } from "@core/types/deps"
import type { ApprovalFlagOpts } from "@shell/approval"
import { resolveProject } from "@shell/project"
import {
	readSelector,
	renderOperation,
	runMutationOperation,
} from "@shell/render"
import type { InferRequestType } from "hono/client"
import type { client } from "../../client"

type QueryBody = InferRequestType<
	(typeof client.projects)[":project"]["data"]["query"]["$post"]
>["json"]

export interface QueryOpts extends ApprovalFlagOpts {
	project?: string
	selector: string
	format?: string
	integration?: string
}

export async function queryDataSource(
	deps: HandlerDeps,
	type: string,
	opts: QueryOpts,
): Promise<void> {
	const project = resolveProject(opts.project, deps)
	const body: QueryBody = {
		type,
		selector: readSelector(deps.fs, opts.selector),
		...(opts.integration ? { integrationSlug: opts.integration } : {}),
	}
	const res = await deps.client.projects[":project"].data.query.$post({
		param: { project },
		json: body,
	})
	if (!res.ok) throw apiError(res.status, await res.text())
	let finalStatus = "succeeded"
	await runMutationOperation(deps, await res.json(), opts, (data) => {
		finalStatus = data.operation.status
		if (isJsonOutput(opts)) return
		renderOperation(deps, data.operation)
	})
	if (finalStatus !== "succeeded") {
		throw new CliError(
			`query settled with status=${finalStatus}`,
			"QUERY_ERROR",
		)
	}
}
