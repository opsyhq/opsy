import type { Operation } from "../types"

export type OperationErrorSummary = {
	message: string
	detail: unknown
}

// Normalize the opaque jsonb `error` blob into a presentable shape. The blob
// commonly carries `{ message: string, ... }` but provider failures can dump
// any structure here; fall back to a stringified rendering so the failed panel
// always has something to render.
export function operationErrorSummary(
	error: Operation["error"],
): OperationErrorSummary | null {
	if (error == null) return null
	if (typeof error === "string") {
		return { message: error, detail: null }
	}
	if (typeof error === "object") {
		const obj = error as Record<string, unknown>
		const msg = obj.message
		const message =
			typeof msg === "string" && msg.length > 0
				? msg
				: "Operation failed without a message."
		const { message: _, ...rest } = obj
		const hasDetail = Object.keys(rest).length > 0
		return { message, detail: hasDetail ? rest : null }
	}
	return { message: String(error), detail: null }
}
