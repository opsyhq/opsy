import { apiError } from "@core/errors"
import { isJsonOutput } from "@core/output/output-format"
import type { HandlerDeps } from "@core/types/deps"
import { resolveProject } from "@shell/project"

export interface ScanOpts {
	format?: string
}

export async function scanProject(
	deps: HandlerDeps,
	slug: string | undefined,
	opts: ScanOpts,
): Promise<void> {
	const project = resolveProject(slug, deps)
	const res = await deps.client.projects[":project"].scan.$post({
		param: { project },
	})
	if (!res.ok) throw apiError(res.status, await res.text())
	const result = await res.json()
	if (isJsonOutput(opts)) {
		deps.output.printJson(result)
		return
	}
	deps.output.note("scan started")
}
