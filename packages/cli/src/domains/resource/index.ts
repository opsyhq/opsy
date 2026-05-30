import {
	withApproval,
	withDryRun,
	withFormat,
	withIntegration,
	withProject,
	withStage,
} from "@shell/commander-opts"
import { collect } from "@shell/render"
import { runAction } from "@shell/run-action"
import { Command } from "commander"
import { type CreateOpts, createResource } from "../../verbs/create/handlers"
import { type DeleteOpts, deleteResource } from "../../verbs/delete/handlers"
import { describeResource } from "../../verbs/describe/handlers"
import {
	type GetOpts,
	getResource,
	listResources,
} from "../../verbs/get/handlers"
import { type ImportOpts, importResource } from "../../verbs/import/handlers"
import { type QueryOpts, queryDataSource } from "../../verbs/query/handlers"
import { type ReadOpts, readResource } from "../../verbs/read/handlers"
import { scanProject } from "../../verbs/scan/handlers"
import { type UpdateOpts, updateResource } from "../../verbs/update/handlers"
import { detailDispatch } from "../detail-dispatch"

const dispatchGet = detailDispatch(getResource, describeResource)

function listCmd(): Command {
	const cmd = new Command("list")
		.aliases(["ls"])
		.description("List resources in the project")
	withProject(cmd)
	withFormat(cmd)
	return cmd.action(
		runAction(async (d, opts: GetOpts) => listResources(d, opts)),
	)
}

function getCmd(): Command {
	const cmd = new Command("get")
		.description("Show a resource (summary; --detail for the rich view)")
		.argument("<slug>", "resource slug")
		.option("--detail", "rich detail view")
		.option(
			"--outputs",
			"with --detail: print only the raw live-state snapshot",
		)
		.option(
			"--output <path>",
			"print only the value at this dot-path, raw (e.g. outputs.arn)",
		)
	withProject(cmd)
	withFormat(cmd)
	return cmd.action(dispatchGet(false))
}

function describeCmd(): Command {
	const cmd = new Command("describe")
		.description("Rich detail for a resource (alias for `get --detail`)")
		.argument("<slug>", "resource slug")
		.option("--outputs", "print only the raw live-state snapshot")
	withProject(cmd)
	withFormat(cmd)
	return cmd.action(dispatchGet(true))
}

function createCmd(): Command {
	const cmd = new Command("create")
		.description("Create a resource in the catalog")
		.argument("<slug>", "resource slug")
		.requiredOption("--type <type>", "TF type token, e.g. aws_s3_bucket")
		.option("--values <json|@file>", "values JSON")
		.option("--set <key=value>", "set an input (repeatable)", collect, [])
		.option(
			"--set-json <key=json>",
			"set an input to a JSON value (repeatable)",
			collect,
			[],
		)
		.option(
			"--set-ref <key=slug.path>",
			"reference another resource's output",
			collect,
			[],
		)
		.option("--unset <key>", "remove an input", collect, [])
	withProject(cmd)
	withIntegration(cmd)
	withApproval(cmd)
	withStage(cmd)
	withDryRun(cmd)
	withFormat(cmd)
	return cmd.action(
		runAction(async (d, slug: string, opts: CreateOpts & { type: string }) => {
			await createResource(d, slug, opts)
		}),
	)
}

function updateCmd(): Command {
	const cmd = new Command("update")
		.description("Update a resource's inputs")
		.argument("<slug>", "resource slug")
		.option("--values <json|@file>", "replace inputs JSON")
		.option("--set <key=value>", "set an input (repeatable)", collect, [])
		.option(
			"--set-json <key=json>",
			"set an input to a JSON value (repeatable)",
			collect,
			[],
		)
		.option(
			"--set-ref <key=slug.path>",
			"reference another resource's output",
			collect,
			[],
		)
		.option("--unset <key>", "remove an input (repeatable)", collect, [])
	withProject(cmd)
	withApproval(cmd)
	withStage(cmd)
	withDryRun(cmd)
	withFormat(cmd)
	return cmd.action(
		runAction(async (d, slug: string, opts: UpdateOpts) => {
			await updateResource(d, slug, opts)
		}),
	)
}

function deleteCmd(): Command {
	const cmd = new Command("delete")
		.description("Delete a resource")
		.argument("<slug>", "resource slug")
		.option("--forget", "drop from catalog without destroying the cloud object")
		.option(
			"--cascade",
			"delete child resources first (depth-first); without this flag, delete fails with 409 if children exist",
		)
	withProject(cmd)
	withApproval(cmd)
	withStage(cmd)
	withDryRun(cmd)
	withFormat(cmd)
	return cmd.action(
		runAction(async (d, slug: string, opts: DeleteOpts) => {
			await deleteResource(d, slug, opts)
		}),
	)
}

function importCmd(): Command {
	const cmd = new Command("import")
		.description(
			"Adopt an existing cloud object into the catalog by its provider id",
		)
		.argument("<slug>", "resource slug")
		.requiredOption("--type <type>", "TF type token, e.g. aws_vpc")
		.option("--provider-id <id>", "raw terraform import id, e.g. vpc-abc123")
		.option(
			"--identity <key=value>",
			"structured import identity attribute (repeatable)",
			collect,
			[],
		)
	withProject(cmd)
	withIntegration(cmd)
	withFormat(cmd)
	withApproval(cmd)
	withStage(cmd)
	return cmd.action(
		runAction(async (d, slug: string, opts: ImportOpts) => {
			await importResource(d, slug, opts)
		}),
	)
}

function readCmd(): Command {
	const cmd = new Command("read")
		.description("Refresh this resource from its live cloud state")
		.argument("<slug>", "resource slug")
	withProject(cmd)
	withFormat(cmd)
	return cmd.action(
		runAction(async (d, slug: string, opts: ReadOpts) => {
			await readResource(d, slug, opts)
		}),
	)
}

function scanCmd(): Command {
	const cmd = new Command("scan").description(
		"Start a scan across live resources in the project",
	)
	withProject(cmd)
	withFormat(cmd)
	return cmd.action(
		runAction(async (d, opts: { project?: string; format?: string }) => {
			await scanProject(d, opts.project, opts)
		}),
	)
}

function queryCmd(): Command {
	const cmd = new Command("query")
		.description("Perform a stateless data source read")
		.argument("<type>", "TF data source type token, e.g. aws_ami")
		.requiredOption(
			"--selector <json|@file>",
			"selector JSON or @path/to/file.json",
		)
	withProject(cmd)
	withIntegration(cmd)
	withFormat(cmd)
	withApproval(cmd)
	return cmd.action(
		runAction(async (d, type: string, opts: QueryOpts) => {
			await queryDataSource(d, type, opts)
		}),
	)
}

export function resourceCommand(): Command {
	const cmd = new Command("resource")
		.aliases(["res", "resources"])
		.description(
			"Resources: list, get, create, update, delete, import, read, scan, query",
		)
	cmd.addCommand(listCmd())
	cmd.addCommand(getCmd())
	cmd.addCommand(describeCmd(), { hidden: true })
	cmd.addCommand(createCmd())
	cmd.addCommand(updateCmd())
	cmd.addCommand(deleteCmd())
	cmd.addCommand(importCmd())
	cmd.addCommand(readCmd())
	cmd.addCommand(scanCmd())
	cmd.addCommand(queryCmd())
	return cmd
}
