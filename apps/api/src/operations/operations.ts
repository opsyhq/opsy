import { Conflict, InvalidInput, NotFound } from "@opsy/contracts/errors"
import { and, eq, inArray, lt, ne, or, sql } from "drizzle-orm"
import { getRun } from "workflow/api"
import { db } from "../lib/db/client"
import { isUniqueViolation } from "../lib/db/errors"
import { pgNotify } from "../lib/notify"
import {
	type NewOperation,
	type Operation,
	operations,
	type Project,
	type Resource,
	resourceLayouts,
	resources,
} from "../lib/db/schema"
import type { Actor } from "../types"
import { operationApprovalHook } from "./approval"
import type {
	ListOperationsQuery,
	OperationApproval,
	OperationError,
} from "./schemas"

// Status constants

export const OPEN_OPERATION_STATUSES = [
	"pending",
	"running",
	"awaiting_approval",
	"canceling",
] as const satisfies readonly Operation["status"][]

// Notification (private to writers below — events/projectEvents.ts subscribes,
// but only writers publish; no caller outside this file should ever invoke
// notifyOperation / notifyResource).

export const OPERATION_CHANNEL = "opsy_operations"
export const OPERATION_EVENT = "operation.updated"

export const RESOURCE_NOTIFY_CHANNEL = "opsy_resources"
export const RESOURCE_CREATED_EVENT = "resource.created"
export const RESOURCE_UPDATED_EVENT = "resource.updated"
export const RESOURCE_DELETED_EVENT = "resource.deleted"

export type OperationUpdateNotification = {
	id: Operation["id"]
	projectId: Operation["projectId"]
	resourceId: Operation["resourceId"]
	changeSetItemId: Operation["changeSetItemId"]
	kind: Operation["kind"]
	status: Operation["status"]
	createdAt: string
	updatedAt: string
	closedAt: string | null
}

function iso(value: Date | string): string {
	return value instanceof Date ? value.toISOString() : value
}

export function operationUpdateNotification(
	operation: Operation,
): OperationUpdateNotification {
	return {
		id: operation.id,
		projectId: operation.projectId,
		resourceId: operation.resourceId,
		changeSetItemId: operation.changeSetItemId,
		kind: operation.kind,
		status: operation.status,
		createdAt: iso(operation.createdAt),
		updatedAt: iso(operation.updatedAt),
		closedAt: operation.closedAt ? iso(operation.closedAt) : null,
	}
}

async function notifyOperation(operation: Operation): Promise<void> {
	await pgNotify(
		OPERATION_CHANNEL,
		JSON.stringify(operationUpdateNotification(operation)),
	)
}

// Minimal resource delta carried over pg_notify. Subscribers (the per-project
// SSE projector) load the fresh row and build a full ResourceView so the wire
// shape to the web client matches the REST list endpoint exactly.
export type ResourceNotification = {
	type:
		| typeof RESOURCE_CREATED_EVENT
		| typeof RESOURCE_UPDATED_EVENT
		| typeof RESOURCE_DELETED_EVENT
	id: Resource["id"]
	projectId: Resource["projectId"]
	slug: Resource["slug"]
}

// Public so resource-table writers outside this file (workflow steps that
// don't flow through `applyResourcePatch`, e.g. updateResourceInputs) can
// emit the delta. Operation/lifecycle writes still go through the markers
// and notify themselves.
export async function notifyResourceUpdated(resource: Resource): Promise<void> {
	await notifyResource(resource, "updated")
}

async function notifyResource(
	resource: Resource,
	kind: "created" | "updated" | "deleted",
): Promise<void> {
	const type =
		kind === "deleted"
			? RESOURCE_DELETED_EVENT
			: kind === "created"
				? RESOURCE_CREATED_EVENT
				: RESOURCE_UPDATED_EVENT
	const payload: ResourceNotification = {
		type,
		id: resource.id,
		projectId: resource.projectId,
		slug: resource.slug,
	}
	await pgNotify(RESOURCE_NOTIFY_CHANNEL, JSON.stringify(payload))
}

// Read shapes

type OperationActor = Pick<Actor, "type" | "id">

export type CreateOperationParams<
	TRequest extends NewOperation["request"] = NewOperation["request"],
> = Pick<
	NewOperation,
	| "projectId"
	| "resourceId"
	| "changeSetItemId"
	| "retryOfOperationId"
	| "workflowRunId"
	| "lockKey"
	| "kind"
	| "approval"
> & { actor: OperationActor; request: TRequest }

export interface OperationDetail {
	operation: Operation
	resource: Resource | null
}

// Reads

export async function getOperation(
	actor: Actor,
	operationId: string,
): Promise<OperationDetail> {
	const row = await db.query.operations.findFirst({
		where: eq(operations.id, operationId),
		with: {
			project: { columns: { orgId: true } },
			resource: true,
		},
	})
	if (!row || row.project.orgId !== actor.orgId) {
		throw new NotFound({ detail: `operation not found: ${operationId}` })
	}
	const { project: _project, resource, ...operation } = row
	return { operation, resource: resource ?? null }
}

export async function listOperations(
	_actor: Actor,
	project: Project,
	filters: ListOperationsQuery,
): Promise<Operation[]> {
	const conds = [eq(operations.projectId, project.id)]
	if (filters.kind) conds.push(eq(operations.kind, filters.kind))
	if (filters.open)
		conds.push(inArray(operations.status, [...OPEN_OPERATION_STATUSES]))
	else if (filters.status) conds.push(eq(operations.status, filters.status))
	if (filters.resourceId)
		conds.push(eq(operations.resourceId, filters.resourceId))
	if (filters.cursorCreatedAt) {
		if (filters.cursorId) {
			const cursor = or(
				lt(operations.createdAt, filters.cursorCreatedAt),
				and(
					eq(operations.createdAt, filters.cursorCreatedAt),
					lt(operations.id, filters.cursorId),
				),
			)
			if (cursor) conds.push(cursor)
		} else {
			conds.push(lt(operations.createdAt, filters.cursorCreatedAt))
		}
	}
	if (filters.resourceSlug) {
		conds.push(
			inArray(
				operations.resourceId,
				db
					.select({ id: resources.id })
					.from(resources)
					.where(
						and(
							eq(resources.projectId, project.id),
							eq(resources.slug, filters.resourceSlug),
						),
					),
			),
		)
	}
	if (!filters.includeSystem) conds.push(ne(operations.actorType, "system"))
	return db.query.operations.findMany({
		where: and(...conds),
		orderBy: (t, { desc }) => [desc(t.createdAt)],
		limit: filters.limit ?? 50,
	})
}

// Create

export async function createOperation<
	TRequest extends NewOperation["request"] = NewOperation["request"],
>(p: CreateOperationParams<TRequest>): Promise<Operation<TRequest>> {
	"use step"

	try {
		const [inserted] = await db
			.insert(operations)
			.values({
				projectId: p.projectId,
				resourceId: p.resourceId ?? null,
				changeSetItemId: p.changeSetItemId ?? null,
				retryOfOperationId: p.retryOfOperationId ?? null,
				workflowRunId: p.workflowRunId ?? null,
				lockKey: p.lockKey ?? null,
				kind: p.kind,
				status: "pending",
				actorType: p.actor.type,
				actorId: p.actor.id,
				request: p.request,
				approval: p.approval ?? null,
			})
			.returning()
		if (!inserted) throw new Error("operation insert returned no row")
		await notifyOperation(inserted)
		return { ...inserted, request: p.request }
	} catch (err) {
		if (isUniqueViolation(err)) {
			throw new Conflict({ detail: "operation lock is already in flight" })
		}
		throw err
	}
}

// Atomic insert: a fresh resource row and the operation that owns its
// lifecycle, in one transaction so the lock (`resource:<id>`) and the row's
// `creating` / `importing` status come into existence together. Used by the
// create/import service entrypoints (direct + changeset apply) so there's no
// mid-flight `slug:*` → `resource:<id>` re-keying window.
export type CreateResourceWithOperationParams<
	TRequest extends NewOperation["request"] = NewOperation["request"],
> = {
	actor: OperationActor
	projectId: string
	changeSetItemId?: string | null
	retryOfOperationId?: string | null
	kind: Extract<Operation["kind"], "create" | "import">
	request: TRequest
	approval?: NewOperation["approval"]
	resource: {
		slug: string
		type: string
		status: Extract<Resource["status"], "creating" | "importing">
		inputs?: Record<string, unknown> | null
		provider: string | null
		integrationId: string | null
		dependsOn?: string[] | null
		metadata?: Record<string, unknown>
		position?: { x: number; y: number } | null
	}
}

export async function createResourceWithOperation<
	TRequest extends NewOperation["request"] = NewOperation["request"],
>(
	p: CreateResourceWithOperationParams<TRequest>,
): Promise<{ resource: Resource; operation: Operation<TRequest> }> {
	"use step"

	try {
		return await db.transaction(async (tx) => {
			const [resource] = await tx
				.insert(resources)
				.values({
					projectId: p.projectId,
					slug: p.resource.slug,
					type: p.resource.type,
					status: p.resource.status,
					inputs: p.resource.inputs ?? null,
					provider: p.resource.provider,
					integrationId: p.resource.integrationId,
					dependsOn: p.resource.dependsOn ?? null,
					metadata: p.resource.metadata ?? {},
					createdByType: p.actor.type,
					createdById: p.actor.id,
				})
				.returning()
			if (!resource) throw new Error("resource insert returned no row")

			if (p.resource.position) {
				await tx.insert(resourceLayouts).values({
					resourceId: resource.id,
					viewId: null,
					position: p.resource.position,
				})
			}

			const [inserted] = await tx
				.insert(operations)
				.values({
					projectId: p.projectId,
					resourceId: resource.id,
					changeSetItemId: p.changeSetItemId ?? null,
					retryOfOperationId: p.retryOfOperationId ?? null,
					workflowRunId: null,
					lockKey: `resource:${resource.id}`,
					kind: p.kind,
					status: "pending",
					actorType: p.actor.type,
					actorId: p.actor.id,
					request: p.request,
					approval: p.approval ?? null,
				})
				.returning()
			if (!inserted) throw new Error("operation insert returned no row")
			return {
				resource,
				operation: { ...inserted, request: p.request },
			}
		}).then(async ({ resource, operation }) => {
			await notifyOperation(operation)
			await notifyResource(resource, "created")
			return { resource, operation }
		})
	} catch (err) {
		if (isUniqueViolation(err)) {
			throw new Conflict({
				detail: `resource slug already taken: ${p.resource.slug}`,
			})
		}
		throw err
	}
}

// Coalesce-first-write-wins: scan/changeset retry paths may attach a workflow
// run id after the operation was already tagged by another path; the existing
// value stays.
export async function attachOperationWorkflowRun<
	TRequest extends Operation["request"] = Operation["request"],
>(
	operation: Operation<TRequest>,
	workflowRunId: string,
): Promise<Operation<TRequest>> {
	"use step"

	const [row] = await db
		.update(operations)
		.set({
			workflowRunId: sql<string>`coalesce(${operations.workflowRunId}, ${workflowRunId})`,
		})
		.where(eq(operations.id, operation.id))
		.returning()
	if (!row)
		throw new NotFound({ detail: `operation not found: ${operation.id}` })
	await notifyOperation(row)
	return { ...row, request: operation.request }
}

// Status transitions — one named function per transition. Every operation row
// write in the codebase goes through one of these. The optional
// `resourcePatch` arg keeps the operation transition and the owned resource
// lifecycle update on a single tx so a crash between them can't leave the row
// stranded in a transient status (`updating` / `deleting` / `creating`).

export type ResourcePatch =
	| { status: Resource["status"] }
	| {
			status: Resource["status"]
			identity: Resource["identity"]
			outputs: Resource["outputs"]
	  }
	| {
			status: Resource["status"]
			inputs: Resource["inputs"]
			outputs: Resource["outputs"]
	  }
	| {
			status: Resource["status"]
			inputs: Resource["inputs"]
			identity: Resource["identity"]
			outputs: Resource["outputs"]
	  }
	| { deletedAt: Date }

// Tx type is intentionally `any` here: drizzle's PgTransaction generic chain
// is brittle to ship through every step wrapper. The runtime tx still enforces
// the SQL contract; this is purely a TS escape so the patch helper composes
// inside `db.transaction(async (tx) => …)` callbacks without leaking generics.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TxOrDb = any

async function applyResourcePatch(
	tx: TxOrDb,
	resourceId: string,
	patch: ResourcePatch,
): Promise<Resource> {
	const [updated] = await tx
		.update(resources)
		.set(patch)
		.where(eq(resources.id, resourceId))
		.returning()
	if (!updated)
		throw new NotFound({ detail: `resource not found: ${resourceId}` })
	return updated as Resource
}

// A patch that sets `deletedAt` is the tombstone path; the resource SSE
// stream emits a `resource.deleted` delta in that case so the client drops
// the row from its list.
function resourcePatchTombstones(patch: ResourcePatch): boolean {
	return "deletedAt" in patch
}

export async function markOperationRunning<
	TRequest extends Operation["request"] = Operation["request"],
>(
	operation: Operation<TRequest>,
	resourcePatch?: ResourcePatch,
): Promise<Operation<TRequest>> {
	"use step"

	const result = await db.transaction(async (tx) => {
		const [updated] = await tx
			.update(operations)
			.set({ status: "running" })
			.where(
				and(
					eq(operations.id, operation.id),
					inArray(operations.status, ["pending", "awaiting_approval"]),
				),
			)
			.returning()
		if (!updated) return null
		const patched =
			resourcePatch && operation.resourceId
				? await applyResourcePatch(tx, operation.resourceId, resourcePatch)
				: null
		return { row: updated, patched, patch: resourcePatch ?? null }
	})
	if (result) {
		await notifyOperation(result.row)
		if (result.patched && result.patch) {
			await notifyResource(
				result.patched,
				resourcePatchTombstones(result.patch) ? "deleted" : "updated",
			)
		}
		return { ...result.row, request: operation.request }
	}
	const current = await db.query.operations.findFirst({
		where: eq(operations.id, operation.id),
	})
	if (!current)
		throw new NotFound({ detail: `operation not found: ${operation.id}` })
	if (current.status === "running")
		return { ...current, request: operation.request }
	throw new Conflict({ detail: `operation is ${current.status}` })
}

export async function markOperationAwaitingApproval<
	TRequest extends Operation["request"] = Operation["request"],
>(
	operation: Operation<TRequest>,
	approval: OperationApproval,
): Promise<Operation<TRequest>> {
	"use step"

	const [row] = await db
		.update(operations)
		.set({ status: "awaiting_approval", approval })
		.where(
			and(eq(operations.id, operation.id), eq(operations.status, "pending")),
		)
		.returning()
	if (row) {
		await notifyOperation(row)
		return { ...row, request: operation.request }
	}
	const current = await db.query.operations.findFirst({
		where: eq(operations.id, operation.id),
	})
	if (!current)
		throw new NotFound({ detail: `operation not found: ${operation.id}` })
	if (
		current.status === "awaiting_approval" &&
		current.approval?.hook?.token === approval.hook?.token
	) {
		return { ...current, request: operation.request }
	}
	throw new Conflict({ detail: `operation is ${current.status}` })
}

export async function markOperationSucceeded<
	TRequest extends Operation["request"] = Operation["request"],
>(
	operation: Operation<TRequest>,
	result: Record<string, unknown>,
	resourcePatch?: ResourcePatch,
): Promise<Operation<TRequest>> {
	"use step"

	const closed = await db.transaction(async (tx) => {
		const [row] = await tx
			.update(operations)
			.set({ status: "succeeded", result, closedAt: new Date() })
			.where(eq(operations.id, operation.id))
			.returning()
		if (!row)
			throw new NotFound({ detail: `operation not found: ${operation.id}` })
		const patched =
			resourcePatch && operation.resourceId
				? await applyResourcePatch(tx, operation.resourceId, resourcePatch)
				: null
		return { row, patched }
	})
	await notifyOperation(closed.row)
	if (closed.patched && resourcePatch) {
		await notifyResource(
			closed.patched,
			resourcePatchTombstones(resourcePatch) ? "deleted" : "updated",
		)
	}
	return { ...closed.row, request: operation.request }
}

export async function markOperationFailed<
	TRequest extends Operation["request"] = Operation["request"],
>(
	operation: Operation<TRequest>,
	error: OperationError,
	resourcePatch?: ResourcePatch,
): Promise<Operation<TRequest>> {
	"use step"

	const closed = await db.transaction(async (tx) => {
		const [row] = await tx
			.update(operations)
			.set({ status: "failed", error, closedAt: new Date() })
			.where(eq(operations.id, operation.id))
			.returning()
		if (!row)
			throw new NotFound({ detail: `operation not found: ${operation.id}` })
		const patched =
			resourcePatch && operation.resourceId
				? await applyResourcePatch(tx, operation.resourceId, resourcePatch)
				: null
		return { row, patched }
	})
	await notifyOperation(closed.row)
	if (closed.patched && resourcePatch) {
		await notifyResource(
			closed.patched,
			resourcePatchTombstones(resourcePatch) ? "deleted" : "updated",
		)
	}
	return { ...closed.row, request: operation.request }
}

export async function markOperationCanceling<
	TRequest extends Operation["request"] = Operation["request"],
>(operation: Operation<TRequest>): Promise<Operation<TRequest>> {
	"use step"

	const [row] = await db
		.update(operations)
		.set({ status: "canceling" })
		.where(
			and(eq(operations.id, operation.id), eq(operations.status, "running")),
		)
		.returning()
	if (row) {
		await notifyOperation(row)
		return { ...row, request: operation.request }
	}
	const current = await db.query.operations.findFirst({
		where: eq(operations.id, operation.id),
	})
	if (!current)
		throw new NotFound({ detail: `operation not found: ${operation.id}` })
	if (current.status === "canceling")
		return { ...current, request: operation.request }
	throw new Conflict({ detail: `operation is ${current.status}` })
}

export async function markOperationCanceled<
	TRequest extends Operation["request"] = Operation["request"],
>(
	operation: Operation<TRequest>,
	resourcePatch?: ResourcePatch,
): Promise<Operation<TRequest>> {
	"use step"

	const result = await db.transaction(async (tx) => {
		const [updated] = await tx
			.update(operations)
			.set({ status: "canceled", closedAt: new Date() })
			.where(
				and(
					eq(operations.id, operation.id),
					inArray(operations.status, [
						"pending",
						"running",
						"awaiting_approval",
						"canceling",
					]),
				),
			)
			.returning()
		if (!updated) return null
		const patched =
			resourcePatch && operation.resourceId
				? await applyResourcePatch(tx, operation.resourceId, resourcePatch)
				: null
		return { row: updated, patched }
	})
	if (result) {
		await notifyOperation(result.row)
		if (result.patched && resourcePatch) {
			await notifyResource(
				result.patched,
				resourcePatchTombstones(resourcePatch) ? "deleted" : "updated",
			)
		}
		return { ...result.row, request: operation.request }
	}
	const current = await db.query.operations.findFirst({
		where: eq(operations.id, operation.id),
	})
	if (!current)
		throw new NotFound({ detail: `operation not found: ${operation.id}` })
	if (current.status === "canceled")
		return { ...current, request: operation.request }
	throw new Conflict({ detail: `operation is ${current.status}` })
}

// User actions (HTTP entry points)

export async function approveOperation(
	operation: Operation,
	actor: Actor,
): Promise<Operation> {
	if (actor.type !== "user" || actor.channel !== "browser") {
		throw new InvalidInput({ detail: "approval requires a browser user" })
	}
	if (operation.status !== "awaiting_approval") {
		throw new Conflict({ detail: `operation is ${operation.status}` })
	}
	const token = operation.approval?.hook?.token
	if (!token) {
		throw new Conflict({ detail: "operation approval hook is missing" })
	}
	const approval: OperationApproval = {
		...(operation.approval as OperationApproval),
		approvedByType: actor.type,
		approvedById: actor.id,
		approvedAt: new Date().toISOString(),
	}
	const [updated] = await db
		.update(operations)
		.set({ approval })
		.where(
			and(
				eq(operations.id, operation.id),
				eq(operations.status, "awaiting_approval"),
			),
		)
		.returning()
	if (!updated) {
		throw new Conflict({ detail: `operation is no longer awaiting approval` })
	}
	await notifyOperation(updated)
	await operationApprovalHook.resume(token, { decision: "approved" })
	return updated
}

// Canceling a never-applied create/import (status pending or awaiting_approval)
// tombstones its stub row in the same tx as the operation transition — the row
// only existed to reserve the slug for this in-flight attempt.
function cancelStubResourcePatch(operation: Operation): ResourcePatch | undefined {
	if (operation.kind !== "create" && operation.kind !== "import") return undefined
	if (!operation.resourceId) return undefined
	return { deletedAt: new Date() }
}

export async function cancelOperation(
	operation: Operation,
	actor: Actor,
): Promise<Operation> {
	if (operation.status === "awaiting_approval") {
		const token = operation.approval?.hook?.token ?? null
		const approval: OperationApproval = {
			...(operation.approval as OperationApproval),
			canceledByType: actor.type,
			canceledById: actor.id,
			canceledAt: new Date().toISOString(),
		}
		const stubPatch = cancelStubResourcePatch(operation)
		const result = await db.transaction(async (tx) => {
			const [row] = await tx
				.update(operations)
				.set({ status: "canceled", closedAt: new Date(), approval })
				.where(
					and(
						eq(operations.id, operation.id),
						eq(operations.status, "awaiting_approval"),
					),
				)
				.returning()
			if (!row) return null
			const patched =
				stubPatch && operation.resourceId
					? await applyResourcePatch(tx, operation.resourceId, stubPatch)
					: null
			return { row, patched }
		})
		if (!result) {
			throw new Conflict({ detail: `operation is no longer awaiting approval` })
		}
		await notifyOperation(result.row)
		if (result.patched && stubPatch) {
			await notifyResource(
				result.patched,
				resourcePatchTombstones(stubPatch) ? "deleted" : "updated",
			)
		}
		if (token) {
			await operationApprovalHook.resume(token, { decision: "canceled" })
		}
		return result.row
	}

	if (operation.status === "pending") {
		const canceled = await markOperationCanceled(
			operation,
			cancelStubResourcePatch(operation),
		)
		if (operation.workflowRunId) await getRun(operation.workflowRunId).cancel()
		return canceled
	}

	if (operation.status === "running") {
		return markOperationCanceling(operation)
	}

	if (operation.status === "canceling") return operation

	throw new Conflict({ detail: `operation is ${operation.status}` })
}

export async function retryOperation(
	operation: Operation,
	actor: Actor,
): Promise<Operation> {
	return createOperation({
		actor,
		projectId: operation.projectId,
		resourceId: operation.resourceId,
		changeSetItemId: operation.changeSetItemId,
		retryOfOperationId: operation.id,
		lockKey: operation.lockKey,
		kind: operation.kind,
		request: operation.request,
		approval: null,
	})
}

// Error normalization — peels workflow/step wrapper noise off and pulls the
// real provider error code/message out of the tail so the UI shows the cause,
// not the framing.

const STEP_WRAPPER_PREFIX =
	/^(?:FatalError:\s*)?Step\s+"[^"]*"\s+(?:failed after \d+ retr(?:y|ies)|exceeded max retries\s*\([^)]*\))\s*:?\s*/i

const API_ERROR_TAIL = /\bapi error ([A-Za-z][\w.-]*): (.+)$/

function rootCause(error: unknown): unknown {
	let current = error
	const seen = new Set<unknown>()
	while (
		current &&
		typeof current === "object" &&
		!seen.has(current) &&
		Reflect.get(current, "cause") != null
	) {
		seen.add(current)
		current = Reflect.get(current, "cause")
	}
	return current
}

export function describeOperationError(error: unknown): OperationError {
	const root = rootCause(error)
	const raw = root instanceof Error ? root.message : String(root ?? error)
	let code = root instanceof Error ? root.name : "Error"

	let message = raw
	for (let i = 0; i < 8; i++) {
		const next = message.replace(STEP_WRAPPER_PREFIX, "")
		if (next === message) break
		message = next
	}
	message = message.trim()

	const apiError = message.match(API_ERROR_TAIL)
	if (apiError) {
		code = apiError[1]
		message = `${apiError[1]}: ${apiError[2]}`.trim()
	} else if (code === "FatalError" || !code) {
		code = "Error"
	}

	return { message: message || raw, code, details: null }
}
