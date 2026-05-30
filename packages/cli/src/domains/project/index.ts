import { withFormat } from "@shell/commander-opts"
import { runAction } from "@shell/run-action"
import { Command, Option } from "commander"
import { type CreateOpts, createProject } from "../../verbs/create/handlers"
import { type DeleteOpts, deleteProject } from "../../verbs/delete/handlers"
import { describeProject } from "../../verbs/describe/handlers"
import { type GetOpts, getProject, listProjects } from "../../verbs/get/handlers"
import { type UpdateOpts, updateProject } from "../../verbs/update/handlers"
import { detailDispatch } from "../detail-dispatch"

const dispatchGet = detailDispatch(getProject, describeProject)

function listCmd(): Command {
	const cmd = new Command("list")
		.aliases(["ls"])
		.description("List all projects")
	withFormat(cmd)
	return cmd.action(runAction(async (d, opts: GetOpts) => listProjects(d, opts)))
}

function getCmd(): Command {
	const cmd = new Command("get")
		.description("Show a project (summary; --detail for the rich view)")
		.argument("<slug>", "project slug")
		.option("--detail", "rich detail view")
	withFormat(cmd)
	return cmd.action(dispatchGet(false))
}

function describeCmd(): Command {
	const cmd = new Command("describe")
		.description("Rich detail for a project (alias for `get --detail`)")
		.argument("<slug>", "project slug")
	withFormat(cmd)
	return cmd.action(dispatchGet(true))
}

function createCmd(): Command {
	const cmd = new Command("create")
		.description("Create a new project")
		.argument("<slug>", "project slug")
	withFormat(cmd)
	return cmd.action(
		runAction(async (d, slug: string, opts: CreateOpts) => {
			await createProject(d, slug, opts)
		}),
	)
}

function updateCmd(): Command {
	const cmd = new Command("update")
		.description("Update project settings")
		.argument("<slug>", "project slug")
		.addOption(
			new Option(
				"--approval-policy <policy>",
				"operation approval policy",
			).choices(["none", "on_destroy", "always"]),
		)
	withFormat(cmd)
	return cmd.action(
		runAction(async (d, slug: string, opts: UpdateOpts) => {
			await updateProject(d, slug, opts)
		}),
	)
}

function deleteCmd(): Command {
	const cmd = new Command("delete")
		.description("Delete a project")
		.argument("<slug>", "project slug")
		.option(
			"--force",
			"delete even if active resources still exist; missing project is a no-op",
		)
	withFormat(cmd)
	return cmd.action(
		runAction(async (d, slug: string, opts: DeleteOpts) => {
			await deleteProject(d, slug, opts)
		}),
	)
}

export function projectCommand(): Command {
	const cmd = new Command("project")
		.aliases(["proj", "projects"])
		.description("Projects: list, inspect, create, change")
	cmd.addCommand(listCmd())
	cmd.addCommand(getCmd())
	cmd.addCommand(describeCmd(), { hidden: true })
	cmd.addCommand(createCmd())
	cmd.addCommand(updateCmd())
	cmd.addCommand(deleteCmd())
	return cmd
}
