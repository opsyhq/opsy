import { Conflict } from "@opsy/contracts/errors"
import type { ResourceTypeSchema, State } from "@opsy/provider"
import type { Operation, Resource } from "../../lib/db/schema"
import { readResourceState } from "../../resources/workflows/steps"
import {
	completeScanAlignmentOperation,
	completeScanOperation,
	countScanResources,
	createScanAlignmentOperation,
	failScanAlignmentOperation,
	failScanOperation,
	getNextScanResources,
	getScanResourceIntegrationGroups,
	getScanResourcePatch,
	getScanResourceSchemas,
	type ScanOutcome,
	type ScanProjectBody,
	startScanOperation,
} from "./steps"

const SCAN_BATCH_SIZE = 25

export type ScanCounts = Record<
	"totalResources" | "scanned" | "skippedInflight" | ScanOutcome,
	number
>

export async function scanProjectWorkflow(
	operation: Operation<ScanProjectBody>,
): Promise<ScanCounts> {
	"use workflow"

	try {
		await startScanOperation(operation)
		const totalResources = await countScanResources(operation)
		const counts: ScanCounts = {
			totalResources,
			scanned: 0,
			skippedInflight: 0,
			unchanged: 0,
			absorbed: 0,
			missing: 0,
			failed: 0,
			skippedDuringRun: 0,
		}
		let cursor: string | null = null

		while (true) {
			const batch = await getNextScanResources(
				operation,
				cursor,
				SCAN_BATCH_SIZE,
			)
			cursor = batch.lastSeenResourceId
			counts.scanned += batch.resources.length
			counts.skippedInflight += batch.skippedInflight

			if (batch.resources.length > 0) {
				const groups = await getScanResourceIntegrationGroups(
					operation,
					batch.resources,
				)
				const schemas = await getScanResourceSchemas(groups.groups)
				const reads = await Promise.all(
					groups.groups.flatMap(({ integration, resources }) =>
						resources.map(async (resource) => {
							try {
								return {
									resource,
									schemaKey: `${integration.id}:${resource.type}`,
									state: await readResourceState(resource, integration),
									readFailed: false,
								}
							} catch {
								return {
									resource,
									schemaKey: `${integration.id}:${resource.type}`,
									state: null,
									readFailed: true,
								}
							}
						}),
					),
				)
				const readOutcomes = await Promise.all(
					reads.map(({ resource, schemaKey, state, readFailed }) =>
						alignScanResource(
							operation,
							resource,
							state,
							schemas[schemaKey] ?? null,
							readFailed,
						),
					),
				)
				const outcomes: ScanOutcome[] = [
					...groups.failedResources.map<ScanOutcome>(() => "failed"),
					...readOutcomes,
				]
				for (const outcome of outcomes) counts[outcome]++
			}

			if (!cursor) break
		}

		await completeScanOperation(operation, counts)
		return counts
	} catch (error) {
		await failScanOperation(operation, error)
		throw error
	}
}

async function alignScanResource(
	scanOperation: Operation<ScanProjectBody>,
	resource: Resource,
	read: State | null,
	schema: ResourceTypeSchema | null,
	readFailed: boolean,
): Promise<ScanOutcome> {
	if (readFailed) return "failed"
	const drift = await getScanResourcePatch(resource, read, schema)
	if (!drift) return "unchanged"

	let alignmentOperation: Operation
	try {
		alignmentOperation = await createScanAlignmentOperation(
			scanOperation,
			resource,
			drift.reason,
		)
	} catch (err) {
		if (err instanceof Conflict) return "skippedDuringRun"
		throw err
	}

	try {
		await completeScanAlignmentOperation(
			alignmentOperation,
			{
				scanOperationId: scanOperation.id,
				resourceId: resource.id,
				reason: drift.reason,
			},
			drift.patch,
		)
		return drift.reason
	} catch (err) {
		await failScanAlignmentOperation(alignmentOperation, err)
		return "failed"
	}
}
