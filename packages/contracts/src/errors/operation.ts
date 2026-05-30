import { Data } from "effect"

export class OperationApprovalChannelForbidden extends Data.TaggedError(
	"OperationApprovalChannelForbidden",
) {
	get message() {
		return "operations can only be approved from the web UI"
	}
}

export class OperationApprovalHookMissing extends Data.TaggedError(
	"OperationApprovalHookMissing",
)<{ operationId: string }> {
	get message() {
		return `operation ${this.operationId} approval hook is missing`
	}
}

export class OperationLockAlreadyInflight extends Data.TaggedError(
	"OperationLockAlreadyInflight",
)<{ lockKey: string | null }> {
	get message() {
		return this.lockKey
			? `operation lock is already in flight: ${this.lockKey}`
			: "operation lock is already in flight"
	}
}

export class OperationNotFound extends Data.TaggedError("OperationNotFound")<{
	operationId: string
}> {
	get message() {
		return `operation not found: ${this.operationId}`
	}
}

export class OperationStatusConflict extends Data.TaggedError(
	"OperationStatusConflict",
)<{ operationId: string; status: string }> {
	get message() {
		return `operation ${this.operationId} is ${this.status}`
	}
}

export type OperationError =
	| OperationApprovalChannelForbidden
	| OperationApprovalHookMissing
	| OperationLockAlreadyInflight
	| OperationNotFound
	| OperationStatusConflict
