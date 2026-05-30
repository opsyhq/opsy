import { runAction } from "@shell/run-action"
import { Command } from "commander"
import { authLogin, authLogout, authStatus, authToken } from "./handlers"

export function authCommand(): Command {
	const cmd = new Command("auth").description("Manage authentication")

	cmd
		.command("login")
		.description("Log in to Opsy")
		.action(
			runAction(async (d) => {
				await authLogin(d)
			}),
		)

	cmd
		.command("logout")
		.description("Log out of Opsy")
		.action(
			runAction(async (d) => {
				await authLogout(d)
			}),
		)

	cmd
		.command("status", { isDefault: true })
		.description("Show authentication status (default)")
		.option("-F, --format <format>", "output format (json)")
		.action(
			runAction(async (d, opts: { format?: string }) => {
				await authStatus(d, opts)
			}),
		)

	cmd
		.command("token")
		.description("Print the current access token")
		.action(
			runAction(async (d) => {
				await authToken(d)
			}),
		)

	return cmd
}
