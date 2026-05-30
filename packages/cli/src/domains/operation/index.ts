import { withFormat, withProject } from "@shell/commander-opts"
import { runAction } from "@shell/run-action"
import { Command } from "commander"
import { type CancelOpts, cancelOperation } from "../../verbs/cancel/handlers"
import { describeOperation } from "../../verbs/describe/handlers"
import {
	type GetOpts,
	getOperation,
	listOperations,
} from "../../verbs/get/handlers"
import { type RetryOpts, retryOperation } from "../../verbs/retry/handlers"
import { detailDispatch } from "../detail-dispatch"

const dispatchGet = detailDispatch(getOperation, describeOperation)

function listCmd(): Command {
	const cmd = new Command("list")
		.aliases(["ls"])
		.description("List operations in the project")
		.option("--resource <slug>", "filter by resource slug")
		.option("--kind <kind>", "filter by operation kind")
		.option("--status <status>", "filter by status")
		.option("--include-system", "include system-initiated operations")
		.option("--limit <n>", "max results (default 50)")
	withProject(cmd)
	withFormat(cmd)
	return cmd.action(
		runAction(async (d, opts: GetOpts) => listOperations(d, opts)),
	)
}

function getCmd(): Command {
	const cmd = new Command("get")
		.description("Show an operation (summary; --detail for the rich view)")
		.argument("<id>", "operation id")
		.option("--detail", "rich detail view")
	withProject(cmd)
	withFormat(cmd)
	return cmd.action(dispatchGet(false))
}

function describeCmd(): Command {
	const cmd = new Command("describe")
		.description("Rich detail for an operation (alias for `get --detail`)")
		.argument("<id>", "operation id")
	withProject(cmd)
	withFormat(cmd)
	return cmd.action(dispatchGet(true))
}

function retryCmd(): Command {
	const cmd = new Command("retry")
		.description("Retry a failed operation")
		.argument("<id>", "operation id")
	withFormat(cmd)
	return cmd.action(
		runAction(async (d, id: string, opts: RetryOpts) => {
			await retryOperation(d, id, opts)
		}),
	)
}

function cancelCmd(): Command {
	const cmd = new Command("cancel")
		.description("Cancel an in-flight operation")
		.argument("<id>", "operation id")
	withFormat(cmd)
	return cmd.action(
		runAction(async (d, id: string, opts: CancelOpts) => {
			await cancelOperation(d, id, opts)
		}),
	)
}

export function operationCommand(): Command {
	const cmd = new Command("operation")
		.aliases(["op", "operations"])
		.description("Operations: list, inspect, retry, cancel")
	cmd.addCommand(listCmd())
	cmd.addCommand(getCmd())
	cmd.addCommand(describeCmd(), { hidden: true })
	cmd.addCommand(retryCmd())
	cmd.addCommand(cancelCmd())
	return cmd
}
