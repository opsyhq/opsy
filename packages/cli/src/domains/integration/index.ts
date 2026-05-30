import { withFormat, withProject } from "@shell/commander-opts"
import { runAction } from "@shell/run-action"
import { Command } from "commander"
import { type CreateOpts, createIntegration } from "../../verbs/create/handlers"
import { type DeleteOpts, deleteIntegration } from "../../verbs/delete/handlers"
import {
	type GetOpts,
	getIntegration,
	listIntegrations,
} from "../../verbs/get/handlers"
import { type UpdateOpts, updateIntegration } from "../../verbs/update/handlers"

function listCmd(): Command {
	const cmd = new Command("list")
		.aliases(["ls"])
		.description("List integrations")
	withFormat(cmd)
	return cmd.action(
		runAction(async (d, opts: GetOpts) => listIntegrations(d, opts)),
	)
}

function getCmd(): Command {
	const cmd = new Command("get")
		.description("Show an integration")
		.argument("<slug>", "integration slug")
	withProject(cmd)
	withFormat(cmd)
	return cmd.action(
		runAction(async (d, slug: string, opts: GetOpts) =>
			getIntegration(d, slug, opts),
		),
	)
}

function createCmd(): Command {
	const cmd = new Command("create")
		.description("Create an integration in a project")
		.argument(
			"<slug>",
			"integration slug — project-unique identity (e.g. aws-prod, aws-west)",
		)
		.requiredOption("--provider <name>", "provider name, e.g. aws")
		.option(
			"--provider-version <version>",
			"Terraform provider version (defaults to the server's installed version)",
		)
		.option(
			"--default",
			"make this the default integration for its provider (the first integration for a provider is the default automatically)",
		)
		.option("--name <label>", "optional cosmetic label (defaults to the slug)")
		.option("--credentials <json|@file>", "provider credentials")
		.option("--config <json|@file>", "provider-level config")
	withProject(cmd)
	withFormat(cmd)
	return cmd.action(
		runAction(
			async (
				d,
				slug: string,
				opts: CreateOpts & { provider: string; providerVersion?: string },
			) => {
				await createIntegration(d, slug, opts)
			},
		),
	)
}

function updateCmd(): Command {
	const cmd = new Command("update")
		.description("Update an integration")
		.argument("<slug>", "integration slug")
		.option(
			"--default",
			"make this the default integration for its provider (promotes it; you switch defaults by promoting another, never by demoting)",
		)
		.option("--name <label>", "cosmetic label")
		.option("--credentials <json|@file>", "replace provider credentials")
		.option("--config <json|@file>", "replace provider-level config")
	withProject(cmd)
	withFormat(cmd)
	return cmd.action(
		runAction(async (d, slug: string, opts: UpdateOpts) => {
			await updateIntegration(d, slug, opts)
		}),
	)
}

function deleteCmd(): Command {
	const cmd = new Command("delete")
		.description("Delete an integration")
		.argument("<slug>", "integration slug")
		.option(
			"--force",
			"delete even if active resources still reference it; missing integration is a no-op",
		)
	withProject(cmd)
	withFormat(cmd)
	return cmd.action(
		runAction(async (d, slug: string, opts: DeleteOpts) => {
			await deleteIntegration(d, slug, opts)
		}),
	)
}

export function integrationCommand(): Command {
	const cmd = new Command("integration")
		.aliases(["int", "integrations"])
		.description(
			"Project-scoped credentials for providers (list, get, create, update, delete). For provider catalog + schemas, see `opsy registry`.",
		)
	cmd.addCommand(listCmd())
	cmd.addCommand(getCmd())
	cmd.addCommand(createCmd())
	cmd.addCommand(updateCmd())
	cmd.addCommand(deleteCmd())
	return cmd
}
