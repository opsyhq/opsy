import type { FieldValues } from "@/components/resource-fields/resolverSchema"

export function valueAtFieldPath(values: FieldValues, path: string): unknown {
	if (Object.hasOwn(values, path)) return values[path]
	return valueAtSegments(values, path.split(".").filter(Boolean))
}

function valueAtSegments(current: unknown, segments: string[]): unknown {
	if (segments.length === 0) return current
	if (current === null || current === undefined) return undefined
	if (Array.isArray(current)) {
		const values = current
			.map((item) => valueAtSegments(item, segments))
			.filter((value) => value !== undefined)
		return values.length === 0 ? undefined : values
	}
	if (typeof current !== "object") return undefined
	const [segment, ...rest] = segments
	const record = current as Record<string, unknown>
	if (Object.hasOwn(record, segment)) {
		return valueAtSegments(record[segment], rest)
	}
	const values = Object.values(record)
		.map((item) => valueAtSegments(item, segments))
		.filter((value) => value !== undefined)
	return values.length === 0 ? undefined : values
}
