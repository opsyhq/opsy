import { exitCodeForError } from "@core/errors"
import { type FormatFlags, isJsonOutput } from "@core/output/output-format"
import type { Output } from "./output"

const EXIT_SUCCESS = 0
export const EXIT_ERROR = 1
export const EXIT_AWAITING_APPROVAL = 2

interface CliErrorOpts extends FormatFlags {
	code?: number
}

export function cliError(
	output: Output,
	err?: unknown,
	opts: CliErrorOpts = {},
): never {
	const code =
		opts.code ?? (err !== undefined ? exitCodeForError(err) : EXIT_ERROR)
	if (err !== undefined) {
		if (isJsonOutput(opts)) output.errorJson(err)
		else output.error(err)
	}
	process.exitCode = code
	process.exit(code)
}

export function cliExit(code: number = EXIT_SUCCESS): never {
	process.exitCode = code
	process.exit(code)
}
