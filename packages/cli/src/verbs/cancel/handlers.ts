import { apiError } from "@core/errors"
import { isJsonOutput } from "@core/output/output-format"
import type { HandlerDeps } from "@core/types/deps"
import { renderOperation } from "@shell/render"

export interface CancelOpts {
	format?: string
}

export async function cancelOperation(
	deps: HandlerDeps,
	id: string,
	opts: CancelOpts,
): Promise<void> {
	const res = await deps.client.operations[":id"].cancel.$post({
		param: { id },
	})
	if (!res.ok) throw apiError(res.status, await res.text())
	const data = await res.json()
	if (isJsonOutput(opts)) {
		deps.output.printJson(data)
		return
	}
	renderOperation(deps, data.operation)
}
