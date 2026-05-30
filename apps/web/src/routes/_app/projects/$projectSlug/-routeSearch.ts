export type OperationLimit = 10 | 20 | 50 | 100 | 200

const VALID_OPERATION_LIMITS: ReadonlySet<OperationLimit> = new Set([
	10, 20, 50, 100, 200,
])

export function coerceString(v: unknown): string | undefined {
	return typeof v === "string" && v.length > 0 ? v : undefined
}

export function coerceOperationLimit(v: unknown): OperationLimit | undefined {
	const n = typeof v === "number" ? v : Number(v)
	return Number.isFinite(n) && VALID_OPERATION_LIMITS.has(n as OperationLimit)
		? (n as OperationLimit)
		: undefined
}
