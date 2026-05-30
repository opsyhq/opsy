import type { Command } from "commander"

export function withFormat(cmd: Command): Command {
	return cmd.option("-F, --format <format>", "output format (json)")
}

export function withProject(cmd: Command): Command {
	return cmd.option(
		"--project <slug>",
		"project slug (defaults to active context)",
	)
}

export function withStage(cmd: Command): Command {
	return cmd.option(
		"--stage",
		"add this change to the active changeset instead of applying it now",
	)
}

export function withIntegration(cmd: Command): Command {
	return cmd.option(
		"--integration <slug>",
		"override the project's default integration for the inferred provider",
	)
}

export function withApproval(cmd: Command): Command {
	return cmd
		.option(
			"--wait-for-approval",
			"block on awaiting_approval, polling until resolved",
		)
		.option(
			"--approval-poll-interval <seconds>",
			"poll interval when waiting for approval",
			"5",
		)
}

export function withDryRun(cmd: Command): Command {
	return cmd.option(
		"--dry-run",
		"plan the change and print the diff without mutating",
	)
}
