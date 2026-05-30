import { apiError } from "@core/errors"
import { isJsonOutput } from "@core/output/output-format"
import type { HandlerDeps } from "@core/types/deps"
import { renderOperation } from "@shell/render"

export interface RetryOpts {
	format?: string
}

export async function retryOperation(
	deps: HandlerDeps,
	id: string,
	opts: RetryOpts,
): Promise<void> {
	const res = await deps.client.operations[":id"].retry.$post({ param: { id } })
	if (!res.ok) throw apiError(res.status, await res.text())
	const data = await res.json()
	if (isJsonOutput(opts)) {
		deps.output.printJson(data)
		return
	}
	renderOperation(deps, data.operation)
}
