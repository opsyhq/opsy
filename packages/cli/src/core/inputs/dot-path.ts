// Extracted from dot-prop v10 (MIT, Sindre Sorhus)
// https://github.com/sindresorhus/dot-prop
// Only parsePath, setProperty, deleteProperty and their internal helpers.

const isObject = (value: unknown): value is Record<string, unknown> => {
	const type = typeof value
	return value !== null && (type === "object" || type === "function")
}

const disallowedKeys = new Set(["__proto__", "prototype", "constructor"])

const MAX_ARRAY_INDEX = 1_000_000

const isDigit = (character: string) => character >= "0" && character <= "9"

function shouldCoerceToNumber(segment: string): boolean {
	if (segment === "0") return true
	if (/^[1-9]\d*$/.test(segment)) {
		const parsed = Number.parseInt(segment, 10)
		return parsed <= Number.MAX_SAFE_INTEGER && parsed <= MAX_ARRAY_INDEX
	}
	return false
}

function processSegment(segment: string, parts: (string | number)[]): boolean {
	if (disallowedKeys.has(segment)) return false
	if (segment && shouldCoerceToNumber(segment)) {
		parts.push(Number.parseInt(segment, 10))
	} else {
		parts.push(segment)
	}
	return true
}

function parsePath(path: string): (string | number)[] {
	if (typeof path !== "string") {
		throw new TypeError(`Expected a string, got ${typeof path}`)
	}

	const parts: (string | number)[] = []
	let currentSegment = ""
	let currentPart: "start" | "property" | "index" | "indexEnd" = "start"
	let isEscaping = false
	let position = 0

	for (const character of path) {
		position++

		if (isEscaping) {
			currentSegment += character
			isEscaping = false
			continue
		}

		if (character === "\\") {
			if (currentPart === "index") {
				throw new Error(
					`Invalid character '${character}' in an index at position ${position}`,
				)
			}
			if (currentPart === "indexEnd") {
				throw new Error(
					`Invalid character '${character}' after an index at position ${position}`,
				)
			}
			isEscaping = true
			currentPart = currentPart === "start" ? "property" : currentPart
			continue
		}

		switch (character) {
			case ".": {
				if (currentPart === "index") {
					throw new Error(
						`Invalid character '${character}' in an index at position ${position}`,
					)
				}
				if (currentPart === "indexEnd") {
					currentPart = "property"
					break
				}
				if (!processSegment(currentSegment, parts)) return []
				currentSegment = ""
				currentPart = "property"
				break
			}

			case "[": {
				if (currentPart === "index") {
					throw new Error(
						`Invalid character '${character}' in an index at position ${position}`,
					)
				}
				if (currentPart === "indexEnd") {
					currentPart = "index"
					break
				}
				if (currentPart === "property" || currentPart === "start") {
					if (
						(currentSegment || currentPart === "property") &&
						!processSegment(currentSegment, parts)
					) {
						return []
					}
					currentSegment = ""
				}
				currentPart = "index"
				break
			}

			case "]": {
				if (currentPart === "index") {
					if (currentSegment === "") {
						const lastSegment = parts.pop() || ""
						currentSegment = `${lastSegment}[]`
						currentPart = "property"
					} else {
						const parsed = Number.parseInt(currentSegment, 10)
						const isValidInteger =
							!Number.isNaN(parsed) &&
							Number.isFinite(parsed) &&
							parsed >= 0 &&
							parsed <= Number.MAX_SAFE_INTEGER &&
							parsed <= MAX_ARRAY_INDEX &&
							currentSegment === String(parsed)

						if (isValidInteger) {
							parts.push(parsed)
						} else {
							parts.push(currentSegment)
						}
						currentSegment = ""
						currentPart = "indexEnd"
					}
					break
				}
				if (currentPart === "indexEnd") {
					throw new Error(
						`Invalid character '${character}' after an index at position ${position}`,
					)
				}
				currentSegment += character
				break
			}

			default: {
				if (currentPart === "index" && !isDigit(character)) {
					throw new Error(
						`Invalid character '${character}' in an index at position ${position}`,
					)
				}
				if (currentPart === "indexEnd") {
					throw new Error(
						`Invalid character '${character}' after an index at position ${position}`,
					)
				}
				if (currentPart === "start") {
					currentPart = "property"
				}
				currentSegment += character
			}
		}
	}

	if (isEscaping) {
		currentSegment += "\\"
	}

	switch (currentPart) {
		case "property": {
			if (!processSegment(currentSegment, parts)) return []
			break
		}
		case "index": {
			throw new Error("Index was not closed")
		}
		case "start": {
			parts.push("")
			break
		}
	}

	return parts
}

// Read the value at a dot-path, using the exact same `parsePath` grammar as
// `--set`/`--set-ref` (no parallel accessor DSL). Distinguishes "the path is
// absent" from "the path exists and holds null/undefined" so callers can map a
// genuine miss to a validation error rather than printing an empty line.
export function getProperty(
	object: unknown,
	path: string,
): { found: true; value: unknown } | { found: false } {
	const pathArray = parsePath(path)
	if (pathArray.length === 0) return { found: false }

	let current: unknown = object
	for (const key of pathArray) {
		if (!isObject(current)) return { found: false }
		if (!(key in current)) return { found: false }
		current = current[key]
	}
	return { found: true, value: current }
}

export function setProperty<T extends Record<string, unknown>>(
	object: T,
	path: string,
	value: unknown,
): T {
	if (!isObject(object)) return object

	const root = object
	const pathArray = parsePath(path)
	if (pathArray.length === 0) return object

	let current: Record<string, unknown> = object
	for (let index = 0; index < pathArray.length; index++) {
		const key = pathArray[index]

		if (index === pathArray.length - 1) {
			current[key] = value
		} else if (!isObject(current[key])) {
			const nextKey = pathArray[index + 1]
			current[key] = typeof nextKey === "number" ? [] : {}
		}

		current = current[key] as Record<string, unknown>
	}

	return root
}

export function deleteProperty(
	object: Record<string, unknown>,
	path: string,
): boolean {
	if (!isObject(object)) return false

	const pathArray = parsePath(path)
	if (pathArray.length === 0) return false

	let current: Record<string, unknown> = object
	for (let index = 0; index < pathArray.length; index++) {
		const key = pathArray[index]

		if (index === pathArray.length - 1) {
			const existed = Object.hasOwn(current, key)
			if (!existed) return false
			delete current[key]
			return true
		}

		current = current[key] as Record<string, unknown>
		if (!isObject(current)) return false
	}

	return false
}
