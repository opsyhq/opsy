import { type RenderOp, renderScalar } from "./ops"

export interface OperationView {
	id: string
	kind: string
	status: string
	resourceId?: string | null
	request?: unknown
	result?: unknown
	error?: unknown
	approval?: unknown
	createdAt?: string
	closedAt?: string | null
}

function sectionJson(title: string, value: unknown): RenderOp[] {
	if (value == null) return []
	return [
		{ op: "section", title },
		{ op: "log", line: JSON.stringify(value, null, 2) },
	]
}

export function formatOperation(operation: OperationView): RenderOp[] {
	const ops: RenderOp[] = [
		{
			op: "keyValue",
			rows: [
				["operation", operation.id],
				["kind", operation.kind],
				["status", operation.status],
				["resource", operation.resourceId ?? ""],
				["created", operation.createdAt ?? ""],
				["closed", operation.closedAt ?? ""],
			],
		},
	]
	ops.push(...sectionJson("request", operation.request))
	ops.push(...sectionJson("result", operation.result))
	ops.push(...sectionJson("error", operation.error))
	ops.push(...sectionJson("approval", operation.approval))
	return ops
}

export function formatOperationStatusEvent(event: {
	id: string
	status: string
	closedAt: string | Date | null
}): string {
	return [
		`operation=${event.id}`,
		`status=${event.status}`,
		event.closedAt ? `closed=${renderScalar(event.closedAt)}` : null,
	]
		.filter(Boolean)
		.join(" ")
}
