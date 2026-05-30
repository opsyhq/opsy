import { runAction } from "@shell/run-action"
import { Command } from "commander"
import { showContext } from "./handlers"

export function contextCommand(): Command {
	return new Command("context")
		.alias("whoami")
		.description("Show the active profile, project, and identity")
		.option("-F, --format <format>", "output format (json)")
		.action(
			runAction(async (d, opts: { format?: string }) => {
				await showContext(d, opts)
			}),
		)
}
