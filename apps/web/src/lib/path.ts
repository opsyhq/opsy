export function pathSegments(path: string): Array<string | number> {
	return path.split(".").flatMap((part) => {
		const open = part.indexOf("[")
		if (open === -1) return [part]
		const head = part.slice(0, open)
		const indexes = [...part.slice(open).matchAll(/\[(\d+)\]/g)].map((match) =>
			Number(match[1]),
		)
		return [head, ...indexes]
	})
}

export function valueAtPath(value: unknown, path: string): unknown {
	let current = value
	for (const segment of pathSegments(path)) {
		if (current == null) return undefined
		if (typeof segment === "number") {
			if (!Array.isArray(current)) return undefined
			current = current[segment]
		} else {
			if (typeof current !== "object" || Array.isArray(current))
				return undefined
			current = (current as Record<string, unknown>)[segment]
		}
	}
	return current
}

export function setAtPath(
	values: Record<string, unknown>,
	path: string,
	nextValue: unknown,
): Record<string, unknown> {
	if (Object.hasOwn(values, path)) return { ...values, [path]: nextValue }

	const segments = pathSegments(path)
	if (segments.length === 0) return values

	return setAtSegments(values, segments, nextValue) as Record<string, unknown>
}

function setAtSegments(
	current: unknown,
	segments: Array<string | number>,
	nextValue: unknown,
): unknown {
	const [segment, ...rest] = segments
	if (segment === undefined) return nextValue
	if (typeof segment === "number") {
		const next = Array.isArray(current) ? [...current] : []
		next[segment] = setAtSegments(next[segment], rest, nextValue)
		return next
	}

	const next =
		current && typeof current === "object" && !Array.isArray(current)
			? { ...(current as Record<string, unknown>) }
			: {}
	next[segment] = setAtSegments(next[segment], rest, nextValue)
	return next
}
