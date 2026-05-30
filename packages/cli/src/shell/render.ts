import { apiError, CliError } from "@core/errors"
import { isJsonOutput } from "@core/output/output-format"
import {
	formatOperation,
	formatOperationStatusEvent,
	type OperationView,
} from "@core/render/operation"
import type { RenderOp } from "@core/render/ops"
import { formatResource } from "@core/render/resource"
import type { HandlerDeps } from "@core/types/deps"
import {
	type OperationResultResponse,
	type OperationSettlement,
	toOperationSettlement,
} from "@core/types/operation-settlement"
import { type ApprovalFlagOpts, handleApprovalGate } from "./approval"
import type { DryRunAction } from "./changeset"
import { watchOperationStatus } from "./operation-stream"

export {
	collect,
	readJsonFlag,
	readSelector,
	resolveInputs,
} from "@core/inputs/resolve"

function printOps(out: HandlerDeps["output"], ops: RenderOp[]): void {
	for (const op of ops) {
		switch (op.op) {
			case "log":
				out.log(op.line)
				break
			case "section":
				out.section(op.title)
				break
			case "keyValue":
				out.keyValue(op.rows)
				break
			case "note":
				out.note(op.msg)
				break
			case "warn":
				out.warn(op.msg)
				break
			case "success":
				out.success(op.msg)
				break
			case "table":
				out.table(op.rows, op.cols)
				break
		}
	}
}

type OperationResponse = { operation: { id: string; status: string } }

// Shared subset of every dry-run wire shape — sync `/resources/dry-run` and
// the per-changeset-item cached row both surface these fields.
export interface DryRunSummary {
	action: DryRunAction
	requiresReplace: string[][] | null
	error?: { message: string } | null
}

export interface DryRunResponse extends DryRunSummary {
	priorState: unknown | null
	plannedState: unknown | null
}

export interface DryRunOpts {
	dryRun?: boolean
}

export function formatDryRunLine(dryRun: DryRunSummary): string {
	if (dryRun.error) return `error — ${dryRun.error.message}`
	if (dryRun.action === "replace") {
		const paths = (dryRun.requiresReplace ?? []).map((p) => p.join("."))
		if (paths.length === 0) return "replace"
		const head = paths.slice(0, 3).join(", ")
		const more = paths.length - 3
		return `replace — paths: ${head}${more > 0 ? ` (+${more} more)` : ""}`
	}
	if (dryRun.action === "deferred")
		return "deferred — check depends_on for unresolved references"
	return dryRun.action
}

// priorState/plannedState ride in the JSON output for agents but are omitted
// from the pretty form — they're large blobs.
export function renderDryRun(
	deps: HandlerDeps,
	dryRun: DryRunResponse,
	opts: { format?: string },
): void {
	if (isJsonOutput(opts)) {
		deps.output.printJson({ dryRun })
		return
	}
	deps.output.keyValue([
		["action", dryRun.action],
		["summary", formatDryRunLine(dryRun)],
	])
	if (dryRun.requiresReplace && dryRun.requiresReplace.length > 0) {
		deps.output.section("paths forcing replace")
		for (const path of dryRun.requiresReplace) {
			deps.output.log(path.join("."))
		}
	}
}

async function fetchOperation(
	deps: HandlerDeps,
	operationId: string,
): Promise<OperationResultResponse> {
	const res = await deps.client.operations[":id"].$get({
		param: { id: operationId },
	})
	if (!res.ok) throw apiError(res.status, await res.text())
	return (await res.json()) as OperationResultResponse
}

async function awaitOperationIfRunning(
	deps: HandlerDeps,
	initial: OperationResponse,
	silent = false,
): Promise<OperationSettlement> {
	const operation = initial.operation
	if (
		operation.status === "succeeded" ||
		operation.status === "failed" ||
		operation.status === "canceled" ||
		operation.status === "awaiting_approval"
	) {
		return toOperationSettlement(await fetchOperation(deps, operation.id))
	}
	const controller = new AbortController()
	const unregister = deps.signals.onInterrupt(() => controller.abort())
	try {
		if (!silent) {
			deps.output.keyValue([
				["operation", operation.id],
				["status", operation.status],
			])
			deps.output.section("events")
		}
		for await (const ev of watchOperationStatus(
			operation.id,
			controller.signal,
		)) {
			if (!silent) deps.output.log(formatOperationStatusEvent(ev))
			if (ev.closedAt) {
				return toOperationSettlement(await fetchOperation(deps, operation.id))
			}
		}
		throw new CliError(
			"operation stream ended without settlement",
			"STREAM_INCOMPLETE",
			`re-check with "opsy operation get ${operation.id}"`,
		)
	} finally {
		unregister()
	}
}

export async function runMutationOperation(
	deps: HandlerDeps,
	raw: OperationResponse,
	opts: ApprovalFlagOpts & { format?: string },
	render: (data: OperationResultResponse) => void = (data) =>
		renderOperation(deps, data.operation),
): Promise<void> {
	const json = isJsonOutput(opts)
	const settlement = await handleApprovalGate(
		deps,
		await awaitOperationIfRunning(deps, raw, json),
		opts,
	)
	const data = settlement.data
	if (json) deps.output.printJson({ operation: data.operation })
	else render(data)
	if (settlement.status !== "succeeded") {
		throw new CliError(
			`operation ${data.operation.id} settled with status=${settlement.status}`,
			"OPERATION_ERROR",
		)
	}
}

export function renderOperation(
	deps: HandlerDeps,
	operation: OperationView,
): void {
	printOps(deps.output, formatOperation(operation))
}

export function renderResource(
	deps: HandlerDeps,
	r: Parameters<typeof formatResource>[0],
): void {
	printOps(deps.output, formatResource(r))
}
