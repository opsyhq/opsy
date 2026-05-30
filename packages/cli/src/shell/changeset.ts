// Shared helpers for the changeset lifecycle: resolving the project's single
// active draft changeset, staging items into it, and rendering its contents.
// The frontend mirrors the same model — one `draft` changeset per project,
// items staged into it, then validated and applied as one async workflow.

import { apiError, CliError } from "@core/errors"
import { isJsonOutput } from "@core/output/output-format"
import type { HandlerDeps } from "@core/types/deps"
import type { InferRequestType } from "hono/client"
import type { client } from "../client"
import { formatDryRunLine } from "./render"

// The server returns the full Drizzle-backed ChangeSetView (with artifact
// blobs). The CLI only needs this slice; mirrors apps/web's own ChangeSet
// type rather than reconstructing the server type.
// SYNC WITH changeSetStatusEnum in apps/api/src/lib/db/schema/shared.ts.
export type ChangeSetStatus =
	| "draft"
	| "applying"
	| "applied"
	| "discarded"
	| "canceled"

export type DryRunAction =
	| "pending"
	| "noop"
	| "create"
	| "update"
	| "delete"
	| "replace"
	| "deferred"
	| "error"

// Reactive cache row surfaced by the server. `pending` is the placeholder
// inserted alongside the item — the per-item workflow advances it to a real
// action.
// Large priorState/plannedState blobs are intentionally omitted from the
// default show output; agents fetch them via status -F json if needed.
export interface ResourceDryRunView {
	action: DryRunAction
	requiresReplace: string[][] | null
	error: { message: string } | null
	updatedAt: string
}

export interface ChangeSetItemView {
	id: string
	kind:
		| "create_resource"
		| "update_resource"
		| "delete_resource"
		| "import_resource"
	targetResourceSlug: string | null
	resourceType: string | null
	validationStatus: "valid" | "invalid"
	validationResult: { message?: string } | null
	// Outcome of the last apply attempt. `succeeded` items are skipped when a
	// partially-failed changeset is re-applied (resumable retry).
	applyStatus: "pending" | "succeeded" | "failed"
	applyError: { message?: string } | null
	dryRun: ResourceDryRunView | null
	source: string
	createdAt: string
}

export interface ChangeSetView {
	id: string
	status: ChangeSetStatus
	title: string | null
	items: ChangeSetItemView[]
	createdAt: string
	updatedAt: string
}

// Mirrors the server's addChangeSetItemBody discriminated union
// (apps/api/src/changesets/schemas.ts). The create/import `changes` is the same
// shape as the resource create/import bodies and is re-validated server-side
// with zod, so it is typed structurally rather than via the hono client (the
// create route's zod preprocess collapses InferRequestType to `unknown`).
type StageItemSource = "user" | "llm" | "canvas_drag_drop" | "import"

export type StageItemBody =
	| {
			kind: "create_resource"
			source?: StageItemSource
			changes: Record<string, unknown>
	  }
	| {
			kind: "import_resource"
			source?: StageItemSource
			changes: Record<string, unknown>
	  }
	| {
			kind: "update_resource"
			source?: StageItemSource
			targetResourceSlug?: string | null
			changes: {
				inputs?: Record<string, unknown>
				selector?: Record<string, unknown>
			}
	  }
	| {
			kind: "delete_resource"
			source?: StageItemSource
			targetResourceSlug?: string | null
			changes: { mode: "delete" | "forget" }
	  }

const TERMINAL: ReadonlySet<ChangeSetStatus> = new Set<ChangeSetStatus>([
	"applied",
	"discarded",
	"canceled",
])

export function isTerminal(status: ChangeSetStatus): boolean {
	return TERMINAL.has(status)
}

const APPLY_ACTIVE: ReadonlySet<ChangeSetStatus> = new Set<ChangeSetStatus>([
	"applying",
])

// True while an apply is still in flight. A resumable-retry failure rolls the
// changeset back to `draft` (not a terminal status), so the poll loop must
// stop when the status simply leaves the active set rather than waiting for
// `isTerminal`.
export function isApplyActive(status: ChangeSetStatus): boolean {
	return APPLY_ACTIVE.has(status)
}

// POST .../changesets/active is idempotent: returns the existing draft or
// creates one. Used by every `--stage` path so staging never needs a
// separate "create changeset" step.
export async function getOrCreateActiveChangeSet(
	deps: HandlerDeps,
	project: string,
): Promise<ChangeSetView> {
	const res = await deps.client.projects[":project"].changesets.active.$post({
		param: { project },
	})
	if (!res.ok) throw apiError(res.status, await res.text())
	return (await res.json()) as ChangeSetView
}

export async function getActiveChangeSet(
	deps: HandlerDeps,
	project: string,
): Promise<ChangeSetView | null> {
	const res = await deps.client.projects[":project"].changesets.active.$get({
		param: { project },
	})
	if (!res.ok) throw apiError(res.status, await res.text())
	const data = (await res.json()) as {
		draft: ChangeSetView | null
		applying: ChangeSetView[]
	}
	return data.draft
}

export async function requireActiveChangeSet(
	deps: HandlerDeps,
	project: string,
): Promise<ChangeSetView> {
	const cs = await getActiveChangeSet(deps, project)
	if (!cs) {
		throw new CliError(
			"no active changeset",
			"NO_ACTIVE_CHANGESET",
			"stage a change first, e.g. `opsy resource create <slug> --type <type> --stage`",
		)
	}
	return cs
}

export async function stageChangeSetItem(
	deps: HandlerDeps,
	project: string,
	body: StageItemBody,
): Promise<ChangeSetView> {
	const cs = await getOrCreateActiveChangeSet(deps, project)
	type ItemPostJson = InferRequestType<
		(typeof client.projects)[":project"]["changesets"][":id"]["items"]["$post"]
	>["json"]
	const res = await deps.client.projects[":project"].changesets[
		":id"
	].items.$post({
		param: { project, id: cs.id },
		// Server re-validates with zod; the structural StageItemBody is widened
		// to the route's inferred request type at this single boundary.
		json: body as unknown as ItemPostJson,
	})
	if (!res.ok) throw apiError(res.status, await res.text())
	return (await res.json()) as ChangeSetView
}

// Shared tail for every `--stage` path: stage the item, then either print the
// raw changeset (-F json) or a success line plus the changeset summary.
export async function reportStaged(
	deps: HandlerDeps,
	projectSlug: string,
	body: StageItemBody,
	opts: { format?: string },
	message: string,
): Promise<void> {
	const cs = await stageChangeSetItem(deps, projectSlug, body)
	if (isJsonOutput(opts)) {
		deps.output.printJson({ changeSet: cs })
		return
	}
	deps.output.success(message)
	renderChangeSet(deps, cs)
}

export function renderChangeSet(deps: HandlerDeps, cs: ChangeSetView): void {
	deps.output.keyValue([
		["changeset", cs.id],
		["status", cs.status],
		["title", cs.title ?? ""],
		["items", String(cs.items.length)],
		["updated", cs.updatedAt],
	])
	if (cs.items.length === 0) {
		deps.output.note("(no staged changes)")
		return
	}
	deps.output.section("items")
	deps.output.table(
		cs.items.map((i) => ({
			id: i.id,
			kind: i.kind,
			target: i.targetResourceSlug ?? i.resourceType ?? "",
			"dry-run": dryRunColumn(i.dryRun),
			validation: i.validationStatus,
			apply: i.applyStatus,
		})),
		["id", "kind", "target", "dry-run", "validation", "apply"],
	)
	for (const i of cs.items) {
		const target = i.targetResourceSlug ?? i.id
		if (i.validationStatus === "invalid") {
			deps.output.warn(`${target}: ${i.validationResult?.message ?? "invalid"}`)
		}
		if (i.applyStatus === "failed") {
			deps.output.warn(
				`${target}: apply failed — ${i.applyError?.message ?? "failed"}`,
			)
		}
		if (i.dryRun && shouldWarnForDryRun(i.dryRun)) {
			deps.output.warn(`${target}: ${formatDryRunLine(i.dryRun)}`)
		}
	}
}

function dryRunColumn(dryRun: ResourceDryRunView | null): string {
	if (!dryRun) return ""
	return dryRun.action
}

function shouldWarnForDryRun(dryRun: ResourceDryRunView): boolean {
	return (
		dryRun.action === "error" ||
		dryRun.action === "replace" ||
		dryRun.action === "deferred"
	)
}

export function hasPendingDryRuns(cs: ChangeSetView): boolean {
	return cs.items.some((i) => i.dryRun?.action === "pending")
}

export function hasDryRunErrors(cs: ChangeSetView): boolean {
	return cs.items.some((i) => i.dryRun?.action === "error")
}

export function renderChangeSetList(
	deps: HandlerDeps,
	changeSets: ChangeSetView[],
): void {
	if (changeSets.length === 0) {
		deps.output.note("(no changesets)")
		return
	}
	deps.output.table(
		changeSets.map((c) => ({
			id: c.id,
			status: c.status,
			items: String(c.items.length),
			title: c.title ?? "",
			updated: c.updatedAt,
		})),
		["id", "status", "items", "title", "updated"],
	)
}
