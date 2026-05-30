export function toJsonValue(value: unknown): unknown {
	if (value === undefined) return undefined
	return JSON.parse(
		JSON.stringify(value, (_key, v) => {
			if (v instanceof Date) return v.toISOString()
			if (v instanceof Headers) return Object.fromEntries(v.entries())
			return v
		}),
	)
}

export function toJsonRecord(
	value: unknown,
): Record<string, unknown> | undefined {
	const json = toJsonValue(value)
	return json && typeof json === "object" && !Array.isArray(json)
		? (json as Record<string, unknown>)
		: undefined
}

export function serializeError(err: unknown): Record<string, unknown> {
	if (err instanceof Error) {
		return { name: err.name, message: err.message, stack: err.stack }
	}
	return { message: String(err) }
}
