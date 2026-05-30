import { and, arrayContains, eq, ne } from "drizzle-orm"
import { start } from "workflow/api"
import { db } from "../../lib/db/client"
import { changeSetItems, changeSets, resourceDryRuns } from "../../lib/db/schema"
import {
	createResourceWorkflow,
	deleteResourceWorkflow,
	forgetResourceWorkflow,
	importResourceWorkflow,
	updateResourceWorkflow,
} from "../../resources/workflows"
import { changeSetItemSlug, type ChangeSetApplyGraph } from "../plan"
import type { ChangeSetView } from "../changesets"
import {
	applyCreateOperation,
	applyDeleteOperation,
	applyForgetOperation,
	applyImportOperation,
	applyUpdateOperation,
	cancelChangeSet,
	closeChangeSet,
	getChangeSetDryRunInputs,
	getChangeSetItem,
	markDryRunFailed,
	planResourceDryRun,
	reopenChangeSet,
	updateDryRun,
	updateDryRunDeferred,
} from "./steps"

export interface ApplyChangeSetWorkflowInput {
	changeSet: ChangeSetView
	applyGraph: ChangeSetApplyGraph
}

type ItemOutcome = "skipped" | "succeeded" | "canceled"

export async function applyChangeSetWorkflow(
	input: ApplyChangeSetWorkflowInput,
): Promise<{ changeSet: ChangeSetView }> {
	"use workflow"

	try {
		const succeeded = new Set(
			input.changeSet.items
				.filter((item) => item.applyStatus === "succeeded")
				.map((item) => item.id),
		)
		for (const level of input.applyGraph.levels) {
			const settled = await Promise.allSettled(
				level.map(async (item): Promise<ItemOutcome> => {
					if (succeeded.has(item.id)) return "skipped"
					switch (item.kind) {
						case "create_resource": {
							const op = await applyCreateOperation(input.changeSet, item)
							const result = await createResourceWorkflow(op)
							if ("canceled" in result) return "canceled"
							return "succeeded"
						}
						case "import_resource": {
							const op = await applyImportOperation(input.changeSet, item)
							const result = await importResourceWorkflow(op)
							if ("canceled" in result) return "canceled"
							return "succeeded"
						}
						case "update_resource": {
							const op = await applyUpdateOperation(input.changeSet, item)
							const result = await updateResourceWorkflow(op)
							if ("canceled" in result) return "canceled"
							return "succeeded"
						}
						case "delete_resource": {
							if (item.changes.mode === "forget") {
								const op = await applyForgetOperation(input.changeSet, item)
								// Target already gone: forget is a no-op, settle succeeded.
								if (!op) return "succeeded"
								const result = await forgetResourceWorkflow(op)
								if ("canceled" in result) return "canceled"
								return "succeeded"
							}
							const op = await applyDeleteOperation(input.changeSet, item)
							const result = await deleteResourceWorkflow(op)
							if ("canceled" in result) return "canceled"
							return "succeeded"
						}
					}
				}),
			)
			const rejected = settled.find(
				(result): result is PromiseRejectedResult =>
					result.status === "rejected",
			)
			if (rejected) throw rejected.reason
			const canceled = settled.some(
				(result) =>
					result.status === "fulfilled" && result.value === "canceled",
			)
			if (canceled) {
				return { changeSet: await cancelChangeSet(input.changeSet) }
			}
		}
		return { changeSet: await closeChangeSet(input.changeSet) }
	} catch (error) {
		await reopenChangeSet(input.changeSet)
		throw error
	}
}

export interface DryRunChangeWorkflowInput {
	itemId: string
	projectId: string
	observed: Date
}

async function startDependentDryRuns(
	projectId: string,
	changeSetId: string,
	targetSlug: string,
	sourceItemId: string,
): Promise<void> {
	"use step"
	// updatedAt bump is intentional: each write produces a fresh CAS token so
	// concurrent dryRunChangeWorkflow executions on dependent items don't
	// clobber each other (each races on its own observed timestamp).
	const rows = await db
		.update(resourceDryRuns)
		.set({
			action: "pending",
			priorState: null,
			plannedState: null,
			plannedPrivate: null,
			requiresReplace: null,
			error: null,
			updatedAt: new Date(),
		})
		.from(changeSetItems)
		.innerJoin(changeSets, eq(changeSets.id, changeSetItems.changeSetId))
		.where(
			and(
				eq(resourceDryRuns.changeSetItemId, changeSetItems.id),
				eq(changeSetItems.changeSetId, changeSetId),
				eq(changeSets.status, "draft"),
				arrayContains(changeSetItems.dependsOn, [targetSlug]),
				ne(resourceDryRuns.changeSetItemId, sourceItemId),
			),
		)
		.returning({
			itemId: resourceDryRuns.changeSetItemId,
			updatedAt: resourceDryRuns.updatedAt,
		})

	await Promise.all(
		rows.map((row) =>
			start(dryRunChangeWorkflow, [
				{ itemId: row.itemId, projectId, observed: row.updatedAt },
			]),
		),
	)
}

export async function dryRunChangeWorkflow(
	input: DryRunChangeWorkflowInput,
): Promise<void> {
	"use workflow"

	try {
		const item = await getChangeSetItem(input.itemId)
		if (!item) return

		const inputs = await getChangeSetDryRunInputs(item, input.projectId)
		if (inputs.deferredOn.length > 0) {
			await updateDryRunDeferred(input.itemId, input.observed)
			return
		}

		const dryRun = await planResourceDryRun(item, input.projectId, inputs.inputs)
		await updateDryRun(input.itemId, dryRun, input.observed)

		const targetSlug = changeSetItemSlug(item)
		if (targetSlug) {
			await startDependentDryRuns(
				input.projectId,
				item.changeSetId,
				targetSlug,
				item.id,
			)
		}
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error)
		await markDryRunFailed(input.itemId, input.observed, message)
		throw error
	}
}

export interface RefreshDryRunsWorkflowInput {
	changeSetId: string
	projectId: string
}

async function resetChangeSetDryRuns(
	changeSetId: string,
): Promise<{ itemId: string; updatedAt: Date }[]> {
	"use step"
	// Upsert, not update: an item whose dry-run row is missing (e.g. staged
	// before the seeding insert shipped, or a workflow that never seeded it)
	// can never be healed by an update — it stays "missing" at the apply gate
	// forever. Seed a pending row for every draft item and reset existing ones
	// so Refresh reliably re-settles the whole changeset.
	const observed = new Date()
	const items = await db
		.select({ id: changeSetItems.id })
		.from(changeSetItems)
		.innerJoin(changeSets, eq(changeSets.id, changeSetItems.changeSetId))
		.where(
			and(
				eq(changeSetItems.changeSetId, changeSetId),
				eq(changeSets.status, "draft"),
			),
		)
	if (items.length === 0) return []
	return db
		.insert(resourceDryRuns)
		.values(
			items.map((item) => ({
				changeSetItemId: item.id,
				action: "pending" as const,
				updatedAt: observed,
			})),
		)
		.onConflictDoUpdate({
			target: resourceDryRuns.changeSetItemId,
			set: {
				action: "pending",
				priorState: null,
				plannedState: null,
				plannedPrivate: null,
				requiresReplace: null,
				error: null,
				updatedAt: observed,
			},
		})
		.returning({
			itemId: resourceDryRuns.changeSetItemId,
			updatedAt: resourceDryRuns.updatedAt,
		})
}

async function startDryRunWorkflows(
	projectId: string,
	items: { itemId: string; updatedAt: Date }[],
): Promise<void> {
	"use step"
	await Promise.all(
		items.map((item) =>
			start(dryRunChangeWorkflow, [
				{ itemId: item.itemId, projectId, observed: item.updatedAt },
			]),
		),
	)
}

export async function refreshDryRunsWorkflow(
	input: RefreshDryRunsWorkflowInput,
): Promise<void> {
	"use workflow"

	const items = await resetChangeSetDryRuns(input.changeSetId)
	await startDryRunWorkflows(input.projectId, items)
}
