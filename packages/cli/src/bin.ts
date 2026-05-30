#!/usr/bin/env bun
import { realDeps } from "@shell/deps.real"
import { cliError } from "@shell/exit"
import { Output } from "@shell/output"
import { Command } from "commander"
import pkg from "../package.json" with { type: "json" }
import { applyCommand, deployCommand } from "./domains/deploy"
import { integrationCommand } from "./domains/integration"
import { operationCommand } from "./domains/operation"
import { projectCommand } from "./domains/project"
import { registryCommand } from "./domains/registry"
import { resourceCommand } from "./domains/resource"
import { authCommand } from "./verbs/auth"
import { changesetCommand } from "./verbs/changeset"
import { configCommand } from "./verbs/config"
import { contextCommand } from "./verbs/context"
import { linkCommand, statusCommand, unlinkCommand } from "./verbs/link"

process.on("uncaughtException", (err) => {
	console.error(err)
	process.exit(1)
})
process.on("unhandledRejection", (reason) => {
	console.error(reason)
	process.exit(1)
})
// Sentinel: claim SIGINT at startup so the runtime's default handler does not
// terminate the process with signal-derived exit code (130) before shell-level
// handlers (e.g. approval polling) can run and commit EXIT_AWAITING_APPROVAL.
process.on("SIGINT", () => {})

const program = new Command()
program
	.name("opsy")
	.description("Opsy CLI — provider-agnostic command-line interface for cloud")
	.version(pkg.version)
	.option("--debug", "enable debug output")
	.option("--quiet", "suppress informational output")

program.hook("preAction", () => {
	const { debug, quiet } = program.opts<{ debug?: boolean; quiet?: boolean }>()
	program.setOptionValue("_deps", realDeps({ debug, quiet }))
})

program.addCommand(deployCommand())
program.addCommand(applyCommand(), { hidden: true })
program.addCommand(resourceCommand())
program.addCommand(projectCommand())
program.addCommand(integrationCommand())
program.addCommand(operationCommand())
program.addCommand(registryCommand())
program.addCommand(changesetCommand())
program.addCommand(authCommand())
program.addCommand(configCommand())
program.addCommand(contextCommand())
program.addCommand(linkCommand())
program.addCommand(unlinkCommand())
program.addCommand(statusCommand())

try {
	await program.parseAsync()
} catch (err) {
	cliError(new Output(process.stdout), err)
}
