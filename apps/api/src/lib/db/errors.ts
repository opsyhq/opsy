// 23505 = unique_violation; drizzle wraps driver errors on `.cause`.
export function isUniqueViolation(err: unknown): boolean {
	if (typeof err !== "object" || err === null) return false
	if ((err as { code?: string }).code === "23505") return true
	const cause = (err as { cause?: unknown }).cause
	return (
		typeof cause === "object" &&
		cause !== null &&
		(cause as { code?: string }).code === "23505"
	)
}

// Constraint/index name of a 23505, when a table has several unique indexes
// and the caller must map each to a distinct domain error. Null if not a
// unique violation or the driver didn't surface the constraint.
export function uniqueViolationConstraint(err: unknown): string | null {
	if (typeof err !== "object" || err === null) return null
	const direct = err as { code?: string; constraint?: string }
	if (direct.code === "23505") return direct.constraint ?? null
	const cause = (err as { cause?: unknown }).cause
	if (
		typeof cause === "object" &&
		cause !== null &&
		(cause as { code?: string }).code === "23505"
	) {
		return (cause as { constraint?: string }).constraint ?? null
	}
	return null
}
