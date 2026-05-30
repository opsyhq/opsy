export function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value)
}

function normalizeComparable(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(normalizeComparable)
	if (isRecord(value)) {
		return Object.fromEntries(
			Object.keys(value)
				.sort()
				.map((key) => [key, normalizeComparable(value[key])]),
		)
	}
	return value
}

function stableStringify(value: unknown): string {
	if (value === undefined) return "unset"
	if (typeof value === "string") return value
	try {
		return JSON.stringify(normalizeComparable(value), null, 2) ?? String(value)
	} catch {
		return String(value)
	}
}

function valueChanged(before: unknown, after: unknown): boolean {
	return stableStringify(before) !== stableStringify(after)
}

export function hasChanges(before: unknown, after: unknown): boolean {
	return valueChanged(before, after)
}

export function diffPaths(
	before: unknown,
	after: unknown,
	segments: string[] = [],
): Array<{ path: string; before: unknown; after: unknown }> {
	if (!isRecord(before) && !isRecord(after)) {
		return valueChanged(before, after)
			? [{ path: formatPath(segments), before, after }]
			: []
	}
	const beforeRecord = isRecord(before) ? before : {}
	const afterRecord = isRecord(after) ? after : {}
	const keys = Array.from(
		new Set([...Object.keys(beforeRecord), ...Object.keys(afterRecord)]),
	).sort()
	return keys.flatMap((key) =>
		diffPaths(beforeRecord[key], afterRecord[key], [...segments, key]),
	)
}

function formatPath(segments: string[]): string {
	return segments.length > 0 ? segments.join(".") : "value"
}
