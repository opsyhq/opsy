import { withFormat } from "@shell/commander-opts"
import { runAction } from "@shell/run-action"
import { Command } from "commander"
import { type LinkOpts, linkProject, statusProject, unlinkProject } from "./handlers"

export function linkCommand(): Command {
	const cmd = new Command("link")
		.description(
			"Link this directory to a project (writes .opsy/project.json); omit the slug to pick interactively",
		)
		.argument("[slug]", "project slug")
	withFormat(cmd)
	return cmd.action(
		runAction(async (d, slug: string | undefined, opts: LinkOpts) => {
			await linkProject(d, slug, opts)
		}),
	)
}

export function unlinkCommand(): Command {
	const cmd = new Command("unlink").description(
		"Remove the nearest .opsy/project.json link",
	)
	withFormat(cmd)
	return cmd.action(
		runAction(async (d, opts: LinkOpts) => {
			unlinkProject(d, opts)
		}),
	)
}

export function statusCommand(): Command {
	const cmd = new Command("status").description(
		"Show the resolved project/apiUrl/orgId and where each value comes from",
	)
	withFormat(cmd)
	return cmd.action(
		runAction(async (d, opts: LinkOpts) => {
			statusProject(d, opts)
		}),
	)
}
