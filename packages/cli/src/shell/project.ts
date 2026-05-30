import { CliError } from "@core/errors"
import type { HandlerDeps } from "@core/types/deps"
import { PROFILE_PROJECT } from "./config"
import { resolveLinkProject } from "./link"

// Precedence (resolved lazily, at call time):
//   --project flag
//   → OPSY_PROJECT env (non-empty; "" is treated as unset)
//   → .opsy/project.json (upward walk from cwd, first hit wins, git-like)
//   → profile `project` in ~/.opsy/config.json (back-compat fallback)
//   → CliError NO_PROJECT
export function resolveProject(
	opt: string | undefined,
	deps: HandlerDeps,
): string {
	const env = process.env.OPSY_PROJECT
	const project =
		opt ??
		(env && env.length > 0 ? env : undefined) ??
		resolveLinkProject(deps) ??
		PROFILE_PROJECT
	if (!project) {
		throw new CliError(
			"no project specified",
			"NO_PROJECT",
			"pass --project <slug>, run `opsy link <slug>` in this directory, or `opsy config set-project <slug>`",
		)
	}
	return project
}
