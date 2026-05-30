import { parseIntervalSeconds } from "@core/approval"
import { apiError, CliError } from "@core/errors"
import { isJsonOutput } from "@core/output/output-format"
import type { HandlerDeps } from "@core/types/deps"
import {
	type ChangeSetStatus,
	type ChangeSetView,
	getActiveChangeSet,
	hasDryRunErrors,
	hasPendingDryRuns,
	isApplyActive,
	isTerminal,
	renderChangeSet,
	renderChangeSetList,
	requireActiveChangeSet,
} from "@shell/changeset"
import { resolveProject } from "@shell/project"

export interface ChangesetOpts {
	project?: string
	format?: string
	wait?: boolean
	pollInterval?: string
	timeout?: string
}

export async function changesetStatus(
	deps: HandlerDeps,
	id: string | undefined,
	opts: ChangesetOpts,
): Promise<void> {
	const project = resolveProject(opts.project, deps)
	let cs: ChangeSetView | null
	if (id) {
		const res = await deps.client.projects[":project"].changesets[":id"].$get({
			param: { project, id },
		})
		if (!res.ok) throw apiError(res.status, await res.text())
		cs = (await res.json()) as ChangeSetView
	} else {
		cs = await getActiveChangeSet(deps, project)
	}
	if (isJsonOutput(opts)) {
		deps.output.printJson({ changeSet: cs })
		return
	}
	if (!cs) {
		deps.output.note("(no active changeset)")
		return
	}
	renderChangeSet(deps, cs)
}

export async function changesetList(
	deps: HandlerDeps,
	opts: ChangesetOpts,
): Promise<void> {
	const project = resolveProject(opts.project, deps)
	const res = await deps.client.projects[":project"].changesets.$get({
		param: { project },
	})
	if (!res.ok) throw apiError(res.status, await res.text())
	const data = (await res.json()) as { changeSets: ChangeSetView[] }
	if (isJsonOutput(opts)) {
		deps.output.printJson(data)
		return
	}
	renderChangeSetList(deps, data.changeSets)
}

// Force-refresh the cached dry-run rows. Dry runs are normally reactive (the
// API re-fires per-item workflows on every edit), but external mutation outside
// the changeset can stale them — another changeset applied a sibling, or a
// resource was touched directly. The status stays `draft`; the client polls
// item.dryRun as workflows land.
export async function changesetRefreshDryRuns(
	deps: HandlerDeps,
	opts: ChangesetOpts,
): Promise<void> {
	const project = resolveProject(opts.project, deps)
	const active = await requireActiveChangeSet(deps, project)
	const res = await deps.client.projects[":project"].changesets[":id"][
		"dry-runs"
	].refresh.$post({ param: { project, id: active.id } })
	if (!res.ok) throw apiError(res.status, await res.text())
	const cs = (await res.json()) as ChangeSetView
	if (isJsonOutput(opts)) {
		deps.output.printJson({ changeSet: cs })
		return
	}
	renderChangeSet(deps, cs)
}

export async function changesetDiscard(
	deps: HandlerDeps,
	opts: ChangesetOpts,
): Promise<void> {
	const project = resolveProject(opts.project, deps)
	const active = await requireActiveChangeSet(deps, project)
	const res = await deps.client.projects[":project"].changesets[
		":id"
	].discard.$post({ param: { project, id: active.id } })
	if (!res.ok) throw apiError(res.status, await res.text())
	const cs = (await res.json()) as ChangeSetView
	if (isJsonOutput(opts)) {
		deps.output.printJson({ changeSet: cs })
		return
	}
	deps.output.success(`discarded changeset ${cs.id}`)
}

export async function changesetUnstage(
	deps: HandlerDeps,
	itemId: string,
	opts: ChangesetOpts,
): Promise<void> {
	const project = resolveProject(opts.project, deps)
	const active = await requireActiveChangeSet(deps, project)
	const res = await deps.client.projects[":project"].changesets[":id"].items[
		":itemId"
	].$delete({ param: { project, id: active.id, itemId } })
	if (!res.ok) throw apiError(res.status, await res.text())
	const cs = (await res.json()) as ChangeSetView
	if (isJsonOutput(opts)) {
		deps.output.printJson({ changeSet: cs })
		return
	}
	deps.output.success(`unstaged ${itemId}`)
	renderChangeSet(deps, cs)
}

export async function changesetApply(
	deps: HandlerDeps,
	opts: ChangesetOpts,
): Promise<void> {
	const project = resolveProject(opts.project, deps)
	const active = await requireActiveChangeSet(deps, project)
	const res = await deps.client.projects[":project"].changesets[
		":id"
	].apply.$post({ param: { project, id: active.id } })
	if (!res.ok) throw apiError(res.status, await res.text())
	const { changeSet } = (await res.json()) as { changeSet: ChangeSetView }
	const json = isJsonOutput(opts)
	const wait = opts.wait !== false

	if (!wait || isTerminal(changeSet.status)) {
		if (json) {
			deps.output.printJson({ changeSet })
			return
		}
		renderChangeSet(deps, changeSet)
		if (!isTerminal(changeSet.status)) {
			deps.output.note(
				`changeset ${changeSet.status} — run \`opsy changeset status\` to track progress`,
			)
		}
		throwIfNotApplied(changeSet)
		return
	}

	const final = await watchChangeSet(
		deps,
		project,
		changeSet,
		parseIntervalSeconds(opts.pollInterval, 3),
		json,
	)
	if (final === null) return // detached on interrupt
	if (json) {
		deps.output.printJson({ changeSet: final })
		return
	}
	renderChangeSet(deps, final)
	throwIfNotApplied(final)
}

function throwIfNotApplied(cs: ChangeSetView): void {
	if (cs.status === "applied") return
	// Still in flight — only reachable via --no-wait, where submitting is the
	// success condition.
	if (isApplyActive(cs.status)) return
	// Settled without applying: a terminal failure/cancel/discard, or a
	// resumable-retry rollback to `draft` after a partial apply failure.
	const failed = cs.items.filter((i) => i.applyStatus === "failed")
	const failedDetail =
		failed.length > 0
			? failed
					.map(
						(i) =>
							`${i.targetResourceSlug ?? i.id}: ${i.applyError?.message ?? "failed"}`,
					)
					.join("; ")
			: undefined
	const hint =
		cs.status === "draft"
			? `${failedDetail ? `${failedDetail} — ` : ""}fix the failed item(s) and re-run \`opsy deploy\` (applied items are skipped)`
			: failedDetail
	throw new CliError(
		`changeset ${cs.id} not applied (status=${cs.status})`,
		"CHANGESET_ERROR",
		hint,
	)
}

// Blocks until every item's cached dry-run has settled (no `pending` action).
// Exits 0 if all clear, 9 if any item ended in `error`, 8 on timeout.
export async function changesetWait(
	deps: HandlerDeps,
	opts: ChangesetOpts,
): Promise<void> {
	const project = resolveProject(opts.project, deps)
	const active = await requireActiveChangeSet(deps, project)
	const intervalMs = parseIntervalSeconds(opts.pollInterval, 3) * 1000
	const timeoutMs = parseIntervalSeconds(opts.timeout, 120) * 1000
	const controller = new AbortController()
	const unregister = deps.signals.onInterrupt(() => controller.abort())
	const start = Date.now()
	let cs = active
	let detached = false
	try {
		while (hasPendingDryRuns(cs)) {
			if (Date.now() - start >= timeoutMs) {
				throw new CliError(
					`dry-runs for changeset ${cs.id} did not settle within ${timeoutMs / 1000}s`,
					"DRY_RUN_TIMEOUT",
					"raise --timeout, or inspect blocked items with `opsy changeset status`",
				)
			}
			await deps.sleep(intervalMs, controller.signal)
			if (controller.signal.aborted) {
				detached = true
				break
			}
			const res = await deps.client.projects[":project"].changesets[":id"].$get(
				{ param: { project, id: cs.id } },
			)
			if (!res.ok) throw apiError(res.status, await res.text())
			cs = (await res.json()) as ChangeSetView
		}
	} finally {
		unregister()
	}
	if (detached) {
		if (!isJsonOutput(opts)) {
			deps.output.note(
				`detached — run \`opsy changeset wait\` again to resume polling`,
			)
		}
		return
	}
	if (isJsonOutput(opts)) {
		deps.output.printJson({ changeSet: cs })
	} else {
		renderChangeSet(deps, cs)
	}
	if (hasDryRunErrors(cs)) {
		throw new CliError(
			`changeset ${cs.id} has dry-run errors`,
			"DRY_RUN_ERROR",
			"fix the failing item(s) and re-run `opsy changeset refresh-dry-runs`",
		)
	}
}

// Apply runs as an async server workflow with no SSE stream, so progress is
// observed by polling the changeset. Returns the settled changeset once the
// apply is no longer in flight — terminal (`applied`/`failed`/...) or rolled
// back to `draft` by resumable retry — or null if the user interrupted (the
// workflow keeps running server-side).
async function watchChangeSet(
	deps: HandlerDeps,
	project: string,
	initial: ChangeSetView,
	intervalSeconds: number,
	silent: boolean,
): Promise<ChangeSetView | null> {
	const controller = new AbortController()
	const unregister = deps.signals.onInterrupt(() => controller.abort())
	let last: ChangeSetStatus | null = null
	const note = (status: ChangeSetStatus) => {
		if (silent || status === last) return
		deps.output.log(`status: ${status}`)
		last = status
	}
	const detached = (): null => {
		if (!silent) {
			deps.output.note(
				`detached — run \`opsy changeset status\` to track progress`,
			)
		}
		return null
	}
	try {
		note(initial.status)
		let current = initial
		while (isApplyActive(current.status)) {
			if (controller.signal.aborted) return detached()
			await deps.sleep(intervalSeconds * 1000, controller.signal)
			if (controller.signal.aborted) return detached()
			const res = await deps.client.projects[":project"].changesets[":id"].$get(
				{ param: { project, id: current.id } },
			)
			if (!res.ok) throw apiError(res.status, await res.text())
			current = (await res.json()) as ChangeSetView
			note(current.status)
		}
		return current
	} finally {
		unregister()
	}
}
