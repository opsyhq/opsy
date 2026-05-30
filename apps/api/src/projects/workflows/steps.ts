import { Conflict, NotFound } from "@opsy/contracts/errors"
import type { ResourceTypeSchema, State } from "@opsy/provider"
import {
	and,
	asc,
	count,
	eq,
	gt,
	inArray,
	isNotNull,
	isNull,
	lt,
} from "drizzle-orm"
import { getIntegrationsByIds } from "../../integrations"
import { db } from "../../lib/db/client"
import {
	type IntegrationRow,
	type Operation,
	operations,
	type Resource,
	resources,
} from "../../lib/db/schema"
import {
	createOperation,
	describeOperationError,
	markOperationFailed,
	markOperationRunning,
	markOperationSucceeded,
	OPEN_OPERATION_STATUSES,
} from "../../operations/operations"
import {
	type ProviderRef,
	providerRefFromIntegration,
	providerRuntime,
} from "../../provider-runtime"
import { getResourceStatePatchAfterRead } from "../../resources/state"

export type ScanProjectBody = Record<string, never>

// A scan walks every applied managed resource and reads cloud truth back.
// `unchanged`: the no-op gate held. `absorbed`: facts were refreshed
// from the cloud. `missing`: the cloud object is gone. `failed`: the read or
// provider failed. `skippedDuringRun`: another operation held the lock.
export type ScanOutcome =
	| "unchanged"
	| "absorbed"
	| "missing"
	| "failed"
	| "skippedDuringRun"

export type ScanResourcePatchReason = "absorbed" | "missing"

// Only applied, provider-backed managed rows are scannable: a row with no
// `identity` was never applied (nothing to read back), and a providerless or
// integration-less row has no cloud truth to absorb.
function scanCandidateFilter(operation: Operation<ScanProjectBody>) {
	return and(
		eq(resources.projectId, operation.projectId),
		isNull(resources.deletedAt),
		isNotNull(resources.provider),
		isNotNull(resources.integrationId),
		isNotNull(resources.identity),
		lt(resources.createdAt, operation.createdAt),
	)
}

export async function countScanResources(
	operation: Operation<ScanProjectBody>,
): Promise<number> {
	"use step"

	const [row] = await db
		.select({ total: count() })
		.from(resources)
		.where(scanCandidateFilter(operation))
	return row?.total ?? 0
}

export async function getNextScanResources(
	operation: Operation<ScanProjectBody>,
	lastSeenResourceId: string | null,
	limit: number,
): Promise<{
	resources: Resource[]
	skippedInflight: number
	lastSeenResourceId: string | null
}> {
	"use step"

	const candidates = await db.query.resources.findMany({
		where: and(
			scanCandidateFilter(operation),
			lastSeenResourceId ? gt(resources.id, lastSeenResourceId) : undefined,
		),
		orderBy: [asc(resources.id)],
		limit,
	})

	const lastCandidate = candidates[candidates.length - 1]
	if (!lastCandidate) {
		return { resources: [], skippedInflight: 0, lastSeenResourceId: null }
	}

	const locked = await db
		.select({ lockKey: operations.lockKey })
		.from(operations)
		.where(
			and(
				eq(operations.projectId, operation.projectId),
				inArray(
					operations.lockKey,
					candidates.map((resource) => `resource:${resource.id}`),
				),
				inArray(operations.status, [...OPEN_OPERATION_STATUSES]),
			),
		)
	const lockedResources = new Set(locked.flatMap((row) => row.lockKey ?? []))

	return {
		resources: candidates.filter(
			(resource) => !lockedResources.has(`resource:${resource.id}`),
		),
		skippedInflight: candidates.filter((resource) =>
			lockedResources.has(`resource:${resource.id}`),
		).length,
		lastSeenResourceId: lastCandidate.id,
	}
}

export async function getScanResourceIntegrationGroups(
	operation: Operation<ScanProjectBody>,
	batchResources: Resource[],
): Promise<{
	groups: { integration: IntegrationRow; resources: Resource[] }[]
	failedResources: Resource[]
}> {
	"use step"

	const resourcesByIntegrationId = new Map<string, Resource[]>()
	const failedResources: Resource[] = []
	for (const resource of batchResources) {
		if (!resource.integrationId) {
			failedResources.push(resource)
			continue
		}
		const existing = resourcesByIntegrationId.get(resource.integrationId)
		if (existing) existing.push(resource)
		else resourcesByIntegrationId.set(resource.integrationId, [resource])
	}

	const integrationIds = [...resourcesByIntegrationId.keys()]
	const integrationsById = await getIntegrationsByIds(
		operation.projectId,
		integrationIds,
	)

	const groups: { integration: IntegrationRow; resources: Resource[] }[] = []
	for (const [integrationId, groupResources] of resourcesByIntegrationId) {
		const integration = integrationsById.get(integrationId)
		if (integration) groups.push({ integration, resources: groupResources })
		else failedResources.push(...groupResources)
	}

	return { groups, failedResources }
}

// Resolve the provider resource schema once per (integration, type); reads
// needs it only to seed the declared mirror for never-projected rows, so a
// schema-unavailable type degrades to a null schema (state patching falls back to the
// stored inputs) rather than failing the scan.
export async function getScanResourceSchemas(
	groups: { integration: IntegrationRow; resources: Resource[] }[],
): Promise<Record<string, ResourceTypeSchema | null>> {
	"use step"

	const wanted = new Map<string, { ref: ProviderRef; type: string }>()
	for (const { integration, resources: groupResources } of groups) {
		const ref = providerRefFromIntegration(integration)
		for (const resource of groupResources) {
			const key = `${integration.id}:${resource.type}`
			if (!wanted.has(key)) wanted.set(key, { ref, type: resource.type })
		}
	}

	const schemas: Record<string, ResourceTypeSchema | null> = {}
	await Promise.all(
		Array.from(wanted, async ([key, { ref, type }]) => {
			try {
				const provider = await providerRuntime.require(ref)
				schemas[key] = (await provider.getSchema(type, "resource")) ?? null
			} catch {
				schemas[key] = null
			}
		}),
	)
	return schemas
}

// Pure compute: derive the patch (if any) that would bring `resource` in
// sync with the cloud truth read. Stays a step so the durable workflow
// replays consistently against the same snapshot.
export async function getScanResourcePatch(
	resource: Resource,
	read: State | null,
	schema: ResourceTypeSchema | null,
): Promise<{
	patch: NonNullable<ReturnType<typeof getResourceStatePatchAfterRead>>
	reason: ScanResourcePatchReason
} | null> {
	"use step"

	const patch = getResourceStatePatchAfterRead(resource, read, schema)
	if (!patch) return null
	return { patch, reason: patch.status === "missing" ? "missing" : "absorbed" }
}


// Operation lifecycle steps for the scan workflow. Thin `"use step"`
// wrappers around the `mark*` writers in `operations.ts`. See the analogous
// block in `resources/workflows/steps.ts` for the workflow-bundler reason
// they exist.

export async function startScanOperation(
	operation: Operation<ScanProjectBody>,
): Promise<Operation<ScanProjectBody>> {
	"use step"

	return markOperationRunning(operation)
}

export async function completeScanOperation(
	operation: Operation<ScanProjectBody>,
	result: Record<string, unknown>,
): Promise<Operation<ScanProjectBody>> {
	"use step"

	return markOperationSucceeded(operation, result)
}

export async function failScanOperation(
	operation: Operation<ScanProjectBody>,
	error: unknown,
): Promise<Operation<ScanProjectBody>> {
	"use step"

	return markOperationFailed(operation, describeOperationError(error))
}

// Alignment operation lifecycle. Each scan-driven drift becomes a separate
// `kind=update` operation that owns the resource lock; if another open
// operation already holds the lock, `createOperation` raises `Conflict`
// (translated to the `skippedDuringRun` scan outcome).
export async function createScanAlignmentOperation(
	scanOperation: Operation<ScanProjectBody>,
	resource: Resource,
	reason: ScanResourcePatchReason,
): Promise<Operation> {
	"use step"

	return createOperation({
		projectId: scanOperation.projectId,
		resourceId: resource.id,
		lockKey: `resource:${resource.id}`,
		kind: "update",
		actor: { type: scanOperation.actorType, id: scanOperation.actorId },
		request: {
			mode: "scan_alignment",
			scanOperationId: scanOperation.id,
			reason,
		},
	})
}

// Close a scan-alignment operation, applying the cloud-truth patch to its
// resource in the same tx. The patch shape (status="live" with inputs/outputs
// or status="missing") settles the resource lifecycle so an absorbed drift or
// missing-from-cloud read is durable with the op success.
export async function completeScanAlignmentOperation(
	alignmentOperation: Operation,
	result: Record<string, unknown>,
	patch: NonNullable<ReturnType<typeof getResourceStatePatchAfterRead>>,
): Promise<Operation> {
	"use step"

	return markOperationSucceeded(alignmentOperation, result, patch)
}

export async function failScanAlignmentOperation(
	alignmentOperation: Operation,
	error: unknown,
): Promise<Operation> {
	"use step"

	return markOperationFailed(alignmentOperation, describeOperationError(error))
}
