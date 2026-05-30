import { CliError } from "@core/errors"
import { deleteProperty, setProperty } from "./dot-path"

export function coerceValue(raw: string): unknown {
	if (raw === "true") return true
	if (raw === "false") return false
	if (raw === "null") return null
	if (/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(raw))
		return Number(raw)
	return raw
}

export function parseAssignment(input: string): [string, string] {
	const eq = input.indexOf("=")
	if (eq === -1) {
		throw new CliError(
			`invalid --set value "${input}": missing '='`,
			"INVALID_SET",
			"use --set key=value",
		)
	}
	return [input.slice(0, eq), input.slice(eq + 1)]
}

// Mirrors apps/api/src/lib/refs/ast.ts REF_PATH_REGEX.
const REF_PATH_REGEX = /^[a-z0-9-]+(\.[a-zA-Z0-9_]+(\[\d+\])*)+$/

// Only whole-string `${slug.path}` is rewritten; partials like `"x-${a.b}-y"`
// stay literal so IAM policy variables and shell templating aren't hijacked.
const INLINE_REF_REGEX = /^\$\{([a-z0-9-]+(?:\.[a-zA-Z0-9_]+(?:\[\d+\])*)+)\}$/

export function expandInlineRefs(value: unknown): unknown {
	if (typeof value === "string") {
		const m = INLINE_REF_REGEX.exec(value)
		return m ? { $ref: m[1] } : value
	}
	if (Array.isArray(value)) return value.map(expandInlineRefs)
	if (value !== null && typeof value === "object") {
		return Object.fromEntries(
			Object.entries(value as Record<string, unknown>).map(([k, v]) => [
				k,
				expandInlineRefs(v),
			]),
		)
	}
	return value
}

export function buildInputsFromFlags(
	base: Record<string, unknown>,
	setFlags: string[],
	setJsonFlags: string[],
	unsetFlags: string[],
	setRefFlags: string[] = [],
): Record<string, unknown> {
	for (const flag of setFlags) {
		const [path, raw] = parseAssignment(flag)
		setProperty(base, path, coerceValue(raw))
	}

	for (const flag of setJsonFlags) {
		const [path, raw] = parseAssignment(flag)
		try {
			setProperty(base, path, expandInlineRefs(JSON.parse(raw)))
		} catch (cause) {
			throw new CliError(
				`invalid --set-json value for "${path}": ${cause instanceof Error ? cause.message : String(cause)}`,
				"INVALID_SET_JSON",
				"pass valid JSON as the value",
			)
		}
	}

	for (const flag of setRefFlags) {
		const [path, ref] = parseAssignment(flag)
		if (!REF_PATH_REGEX.test(ref)) {
			throw new CliError(
				`invalid --set-ref value for "${path}": ${JSON.stringify(ref)}`,
				"INVALID_SET_REF",
				"use --set-ref key=slug.path (e.g. --set-ref ami=al2023.id)",
			)
		}
		setProperty(base, path, { $ref: ref })
	}

	for (const path of unsetFlags) {
		deleteProperty(base, path)
	}

	return base
}
