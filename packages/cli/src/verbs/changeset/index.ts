import { withFormat, withProject } from "@shell/commander-opts"
import { runAction } from "@shell/run-action"
import { Command } from "commander"
import {
	type ChangesetOpts,
	changesetApply,
	changesetDiscard,
	changesetList,
	changesetRefreshDryRuns,
	changesetStatus,
	changesetUnstage,
	changesetWait,
} from "./handlers"

function statusCmd(): Command {
	const cmd = new Command("status")
		.aliases(["show"])
		.description("Show the active changeset (or a specific one by id)")
		.argument("[id]", "changeset id (defaults to the active draft)")
	withProject(cmd)
	withFormat(cmd)
	return cmd.action(
		runAction(async (d, id: string | undefined, opts: ChangesetOpts) => {
			await changesetStatus(d, id, opts)
		}),
	)
}

function listCmd(): Command {
	const cmd = new Command("list")
		.aliases(["ls"])
		.description("List all changesets for the project")
	withProject(cmd)
	withFormat(cmd)
	return cmd.action(
		runAction(async (d, opts: ChangesetOpts) => {
			await changesetList(d, opts)
		}),
	)
}

function discardCmd(): Command {
	const cmd = new Command("discard")
		.aliases(["abandon"])
		.description("Discard the active changeset")
	withProject(cmd)
	withFormat(cmd)
	return cmd.action(
		runAction(async (d, opts: ChangesetOpts) => {
			await changesetDiscard(d, opts)
		}),
	)
}

function unstageCmd(): Command {
	const cmd = new Command("unstage")
		.aliases(["rm"])
		.description("Remove a staged item from the active changeset")
		.argument("<itemId>", "changeset item id")
	withProject(cmd)
	withFormat(cmd)
	return cmd.action(
		runAction(async (d, itemId: string, opts: ChangesetOpts) => {
			await changesetUnstage(d, itemId, opts)
		}),
	)
}

function applyCmd(): Command {
	const cmd = new Command("apply").description("Apply the active changeset")
	withProject(cmd)
	withFormat(cmd)
	cmd.option("--no-wait", "submit and exit without waiting for terminal state")
	cmd.option("--poll-interval <seconds>", "status poll interval", "3")
	return cmd.action(
		runAction(async (d, opts: ChangesetOpts) => {
			await changesetApply(d, opts)
		}),
	)
}

function refreshDryRunsCmd(): Command {
	const cmd = new Command("refresh-dry-runs").description(
		"Force-refresh the cached dry-run rows for the active changeset",
	)
	withProject(cmd)
	withFormat(cmd)
	return cmd.action(
		runAction(async (d, opts: ChangesetOpts) => {
			await changesetRefreshDryRuns(d, opts)
		}),
	)
}

function waitCmd(): Command {
	const cmd = new Command("wait").description(
		"Block until every staged item's dry-run has settled (exit 8 on timeout, 9 on dry-run errors)",
	)
	withProject(cmd)
	withFormat(cmd)
	cmd.option("--poll-interval <seconds>", "status poll interval", "3")
	cmd.option("--timeout <seconds>", "give up after this many seconds", "120")
	return cmd.action(runAction(changesetWait))
}

export function changesetCommand(): Command {
	const cmd = new Command("changeset")
		.aliases(["cs"])
		.description("Stage, review, and discard batched resource changes")
	cmd.addCommand(statusCmd())
	cmd.addCommand(listCmd())
	cmd.addCommand(discardCmd())
	cmd.addCommand(unstageCmd())
	cmd.addCommand(applyCmd())
	cmd.addCommand(refreshDryRunsCmd())
	cmd.addCommand(waitCmd())
	return cmd
}
