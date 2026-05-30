// Output format flag handling — adapted from vercel/vercel
// packages/cli/src/util/output-format.ts. Same shape, same semantics:
// commands declare a `--format <format>` option (commander), then call
// `isJsonOutput(opts)` near the top of the action and early-return after
// emitting `output.printJson(data)` if true.
//
// Designed for future formats (yaml, csv, table) without changing the surface.

type OutputFormat = "json"

const OUTPUT_FORMATS: readonly OutputFormat[] = ["json"] as const

export interface FormatFlags {
	format?: string
}

function parseOutputFormat(value: string): OutputFormat {
	const normalized = value.toLowerCase()
	if (OUTPUT_FORMATS.includes(normalized as OutputFormat)) {
		return normalized as OutputFormat
	}
	throw new Error(
		`invalid output format: "${value}". valid formats: ${OUTPUT_FORMATS.join(", ")}`,
	)
}

function getOutputFormat(flags: FormatFlags): OutputFormat | undefined {
	if (flags.format) return parseOutputFormat(flags.format)
	return undefined
}

export function isJsonOutput(flags: FormatFlags): boolean {
	return getOutputFormat(flags) === "json"
}
