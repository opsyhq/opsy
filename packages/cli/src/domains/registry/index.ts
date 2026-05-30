import { withFormat } from "@shell/commander-opts"
import { runAction } from "@shell/run-action"
import { Command } from "commander"
import { type ExplainOpts, explainTarget } from "../../verbs/explain/handlers"
import {
	type GetOpts,
	type RegistryConnectOpts,
	listProviders,
	listTypes,
	registryConnect,
} from "../../verbs/get/handlers"

function listCmd(): Command {
	const cmd = new Command("list")
		.aliases(["ls"])
		.description("List providers known to this server")
	withFormat(cmd)
	return cmd.action(
		runAction(async (d, opts: GetOpts) => listProviders(d, opts)),
	)
}

function typesCmd(): Command {
	const cmd = new Command("types")
		.alias("type")
		.description("List resource and data-source types for a provider")
		.argument("<provider>", "provider name, e.g. aws")
		.option("--search <query>", "filter types by query")
		.option(
			"--limit <n>",
			"results per page (server-capped; default 50, or 20 with --search)",
		)
		.option("--offset <n>", "skip the first <n> results (pagination)")
		.option("--all", "fetch every page until exhausted (ignores --offset)")
	withFormat(cmd)
	return cmd.action(
		runAction(async (d, provider: string, opts: GetOpts) => {
			await listTypes(d, { ...opts, provider })
		}),
	)
}

function schemaCmd(): Command {
	const cmd = new Command("schema")
		.description(
			"Show a resource or data-source type schema, with the import identity hint",
		)
		.argument("<provider>", "provider name, e.g. aws")
		.argument("<type>", "TF type token, e.g. aws_sqs_queue")
		.option("--kind <kind>", "resource | data (defaults to both)")
		.option("--tree", "recurse into nested blocks")
		.option("--path <path>", "focus on one nested block (dot-separated)")
	withFormat(cmd)
	return cmd.action(
		runAction(
			async (d, provider: string, type: string, opts: ExplainOpts) => {
				await explainTarget(d, type, undefined, { ...opts, provider })
			},
		),
	)
}

function connectCmd(): Command {
	const cmd = new Command("connect")
		.description(
			"Emit the credentials/config schema, generated artifacts, and a paste-ready skeleton for connecting a provider",
		)
		.argument("<provider>", "provider name, e.g. aws")
		.option(
			"--mode <mode>",
			"credential mode (defaults to the provider's preferred mode)",
		)
		.option(
			"--provider-version <version>",
			"Terraform provider version (defaults to the server's installed version)",
		)
	withFormat(cmd)
	return cmd.action(
		runAction(async (d, provider: string, opts: RegistryConnectOpts) => {
			await registryConnect(d, provider, opts)
		}),
	)
}

export function registryCommand(): Command {
	const cmd = new Command("registry")
		.aliases(["reg", "registries"])
		.description(
			"Server's provider catalog: list providers, browse types/schema, and emit everything needed to connect",
		)
	cmd.addCommand(listCmd())
	cmd.addCommand(typesCmd())
	cmd.addCommand(schemaCmd())
	cmd.addCommand(connectCmd())
	return cmd
}
