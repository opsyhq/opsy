import { runAction } from "@shell/run-action"
import { Command } from "commander"
import { configClear, configSetProject, configView } from "./handlers"

export function configCommand(): Command {
	const cmd = new Command("config").description("Manage CLI config")

	cmd
		.command("view", { isDefault: true })
		.description("Show current config (default)")
		.option("-F, --format <format>", "output format (json)")
		.action(
			runAction(async (d, opts: { format?: string }) => {
				await configView(d, opts)
			}),
		)

	cmd
		.command("set-project")
		.description("Set the active project")
		.argument("<slug>", "project slug")
		.action(
			runAction(async (d, slug: string) => {
				configSetProject(d, slug)
			}),
		)

	cmd
		.command("clear")
		.description(
			"Clear the active project for this profile (apiUrl is preserved)",
		)
		.action(
			runAction(async (d) => {
				configClear(d)
			}),
		)

	return cmd
}
