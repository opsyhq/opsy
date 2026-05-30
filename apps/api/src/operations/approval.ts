import type { Operation, Resource } from "../lib/db/schema"
import { evaluateOperationApproval } from "../policies/policies"
import { defineHook } from "workflow"
import {
	markOperationAwaitingApproval,
	markOperationCanceled,
	markOperationRunning,
} from "./operations"
import type { OperationApproval } from "./schemas"

export type OperationApprovalHookPayload =
	| { decision: "approved" }
	| { decision: "canceled" }

export const operationApprovalHook = defineHook<OperationApprovalHookPayload>()

export type ApprovalGateResult<TRequest extends Operation["request"]> =
	| { approved: true; operation: Operation<TRequest> }
	| { approved: false; operation: Operation }

// `waitForOperationApproval` is workflow-body code (awaits a durable hook), so
// it can't itself be a step. But every db write below is delegated through the
// thin step wrappers at the bottom of this file — that lets the workflow
// bundler stub them out and prevents `operations.ts` (and its `db` import)
// from being pulled into the workflow bundle.
export async function waitForOperationApproval<
	TRequest extends Operation["request"],
>(
	operation: Operation<TRequest>,
	resource: Resource | null,
): Promise<ApprovalGateResult<TRequest>> {
	const requirement = await getOperationApprovalRequirement(operation, resource)
	if (!requirement.required) {
		return {
			approved: true,
			operation: await runApprovedOperation(operation),
		}
	}

	const token = `operation-approval:${operation.id}`
	const hook = operationApprovalHook.create({
		token,
		metadata: {
			operationId: operation.id,
			projectId: operation.projectId,
		},
	})
	const awaitingOperation = await awaitOperationApproval(operation, {
		requestedAt: new Date().toISOString(),
		policyIds: requirement.policyIds,
		policyResults: requirement.policyResults,
		hook: { token },
	})

	const payload = await hook
	if (payload.decision === "canceled") {
		return {
			approved: false,
			operation: await cancelAwaitingOperation(awaitingOperation),
		}
	}

	return {
		approved: true,
		operation: await runApprovedOperation(awaitingOperation),
	}
}

async function getOperationApprovalRequirement(
	operation: Operation,
	resource: Resource | null,
): ReturnType<typeof evaluateOperationApproval> {
	"use step"

	return evaluateOperationApproval({ operation, resource })
}

async function awaitOperationApproval<TRequest extends Operation["request"]>(
	operation: Operation<TRequest>,
	approval: OperationApproval,
): Promise<Operation<TRequest>> {
	"use step"

	return markOperationAwaitingApproval(operation, approval)
}

async function runApprovedOperation<TRequest extends Operation["request"]>(
	operation: Operation<TRequest>,
): Promise<Operation<TRequest>> {
	"use step"

	return markOperationRunning(operation)
}

async function cancelAwaitingOperation<TRequest extends Operation["request"]>(
	operation: Operation<TRequest>,
): Promise<Operation<TRequest>> {
	"use step"

	// A canceled create/import never produced a real resource; tombstone the
	// stub row in the same tx as the operation transition so the slug frees.
	const patch =
		(operation.kind === "create" || operation.kind === "import") &&
		operation.resourceId
			? { deletedAt: new Date() }
			: undefined
	return markOperationCanceled(operation, patch)
}
