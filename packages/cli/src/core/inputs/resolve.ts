import type { FsDep } from "@core/types/deps"
import { CliError } from "../errors"
import { buildInputsFromFlags } from "./set-path"

export function collect(val: string, acc: string[]): string[] {
	acc.push(val)
	return acc
}

interface SetFlags {
	values?: string
	set: string[]
	setJson: string[]
	setRef: string[]
	unset: string[]
}

export function resolveInputs(
	fs: FsDep,
	opts: SetFlags,
	base: Record<string, unknown> = {},
): Record<string, unknown> {
	const hasSetFlags =
		opts.set.length > 0 ||
		opts.setJson.length > 0 ||
		opts.setRef.length > 0 ||
		opts.unset.length > 0
	if (opts.values && hasSetFlags) {
		throw new CliError(
			"--values and --set/--set-json/--set-ref/--unset are mutually exclusive",
			"CONFLICTING_FLAGS",
			"use either --values or --set/--set-json/--set-ref/--unset, not both",
		)
	}
	if (!opts.values && !hasSetFlags) {
		throw new CliError(
			"no values provided",
			"MISSING_VALUES",
			"pass --values <json> or --set key=value",
		)
	}
	if (opts.values) return readValues(fs, opts.values)
	return buildInputsFromFlags(
		base,
		opts.set,
		opts.setJson,
		opts.unset,
		opts.setRef,
	)
}

export function readValues(fs: FsDep, raw: string): Record<string, unknown> {
	return readJsonFlag(fs, raw, "--values", "INVALID_VALUES")
}

export function readSelector(fs: FsDep, raw: string): Record<string, unknown> {
	return readJsonFlag(fs, raw, "--selector", "INVALID_SELECTOR")
}

export function readJsonFlag(
	fs: FsDep,
	raw: string,
	flag: string,
	code = "INVALID_JSON",
): Record<string, unknown> {
	let text = raw
	if (raw.startsWith("@")) {
		const path = raw.slice(1)
		if (!path) {
			throw new CliError(
				`unable to read ${flag} file: missing path after @`,
				code,
				`pass ${flag} @path/to/file.json or inline JSON`,
			)
		}
		try {
			text = fs.readFileSync(path, "utf8")
		} catch (cause) {
			throw new CliError(
				`unable to read ${flag} file "${path}": ${formatReadError(cause)}`,
				code,
				`check the file path and permissions, or pass inline JSON to ${flag}`,
			)
		}
	}
	try {
		return JSON.parse(text) as Record<string, unknown>
	} catch (cause) {
		throw new CliError(
			`invalid ${flag} JSON: ${cause instanceof Error ? cause.message : String(cause)}`,
			code,
			`pass valid JSON or @path/to/file.json to ${flag}`,
		)
	}
}

function formatReadError(cause: unknown): string {
	if (cause && typeof cause === "object" && "code" in cause) {
		const code = String((cause as { code: unknown }).code)
		const message = cause instanceof Error ? cause.message : String(cause)
		return message.includes(code) ? message : `${code}: ${message}`
	}
	return cause instanceof Error ? cause.message : String(cause)
}
