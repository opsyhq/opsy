import { withFormat, withProject } from "@shell/commander-opts"
import { runAction } from "@shell/run-action"
import { Command } from "commander"
import {
	type ChangesetOpts,
	changesetApply,
} from "../verbs/changeset/handlers"

function buildDeploy(name: string, description: string): Command {
	const cmd = new Command(name)
		.description(description)
		.option("--no-wait", "return immediately instead of waiting for completion")
		.option(
			"--poll-interval <seconds>",
			"poll interval while waiting for completion",
			"3",
		)
	withProject(cmd)
	withFormat(cmd)
	return cmd.action(
		runAction(async (d, opts: ChangesetOpts) => {
			await changesetApply(d, opts)
		}),
	)
}

export function deployCommand(): Command {
	return buildDeploy("deploy", "Apply the active changeset")
}

// Hidden back-compat-friendly alias of `deploy`; registered with { hidden: true }
// so it runs but does not clutter `--help`.
export function applyCommand(): Command {
	return buildDeploy("apply", "Apply the active changeset (alias for `deploy`)")
}
