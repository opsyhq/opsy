export { toJsonValue } from "@opsy/thinking-blocks"

function isPlainObject(v: unknown): v is Record<string, unknown> {
	return typeof v === "object" && v !== null && !Array.isArray(v)
}

// null/undefined/[]/{} are all "empty" and equivalent. TF normalizes absent
// nested blocks/maps inconsistently (post-create `null`, post-read `[]`/`{}`),
// so collapsing them keeps the absorb no-op gate stable in steady state.
function isEmpty(v: unknown): boolean {
	if (v == null) return true
	if (Array.isArray(v)) return v.length === 0
	if (isPlainObject(v)) return Object.keys(v).length === 0
	return false
}

// One canonical deep JSON equality with empty-collapsing semantics. Used by
// the resource absorb no-op gate and the project scan.
export function jsonValueEqual(a: unknown, b: unknown): boolean {
	if (a === b) return true
	if (isEmpty(a) && isEmpty(b)) return true
	if (isEmpty(a) || isEmpty(b)) return false
	if (Array.isArray(a) && Array.isArray(b)) {
		if (a.length !== b.length) return false
		return a.every((value, index) => jsonValueEqual(value, b[index]))
	}
	if (isPlainObject(a) && isPlainObject(b)) {
		const keys = new Set([...Object.keys(a), ...Object.keys(b)])
		for (const key of keys) {
			if (!jsonValueEqual(a[key], b[key])) return false
		}
		return true
	}
	return false
}
