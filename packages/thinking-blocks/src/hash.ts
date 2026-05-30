import { createHash } from "node:crypto"

function stableStringify(value: unknown): string {
	if (value === null || typeof value !== "object") return JSON.stringify(value)
	if (Array.isArray(value)) {
		return `[${value.map((v) => stableStringify(v)).join(",")}]`
	}
	const obj = value as Record<string, unknown>
	return `{${Object.keys(obj)
		.sort()
		.map((key) => `${JSON.stringify(key)}:${stableStringify(obj[key])}`)
		.join(",")}}`
}

export function thinkingBlockInputHash(value: unknown): string {
	return createHash("sha256").update(stableStringify(value)).digest("hex")
}
