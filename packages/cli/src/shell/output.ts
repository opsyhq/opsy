import { CliError, hintForTag, isOpsyError } from "@core/errors"
import { formatKeyValue } from "@core/output/key-value"
import { formatTable } from "@core/output/table"
import { serialize } from "@opsy/contracts/errors"
import chalk from "chalk"

// Output abstraction modeled on vercel/vercel packages/cli/src/util/output.
// One class, methods named by intent (success, warn, error, note) rather than
// shape. Composed from the table/key-value primitives in sibling files.
//
// Intentionally NOT included (until we need them):
//   spinner, link, box, progress, code, highlight, list-item, indent, …
//
// JSON output dispatch is NOT a method on this class. Per vercel's pattern,
// commands check `isJsonOutput(opts)` and call `output.printJson(data)` with
// an explicit early return. The Output class only handles human formatting.

interface OutputOptions {
	/** Override color detection. Default: enabled when stream is a TTY and NO_COLOR is unset. */
	color?: boolean
	debug?: boolean
	quiet?: boolean
}

export class Output {
	readonly stream: NodeJS.WriteStream
	readonly errStream: NodeJS.WriteStream
	readonly isTTY: boolean
	readonly color: boolean
	readonly debugEnabled: boolean
	readonly quiet: boolean

	constructor(stream: NodeJS.WriteStream, opts: OutputOptions = {}) {
		this.stream = stream
		this.errStream = process.stderr
		this.isTTY = Boolean(stream.isTTY)
		const noColor =
			Boolean(process.env.NO_COLOR) || process.env.FORCE_COLOR === "0"
		this.color = opts.color ?? (!noColor && this.isTTY)
		this.debugEnabled = opts.debug ?? false
		this.quiet = opts.quiet ?? false
		if (!this.color) chalk.level = 0
	}

	// ─── raw I/O ──────────────────────────────────────────────────────────

	print(str: string): void {
		this.stream.write(str)
	}

	log(str = ""): void {
		this.stream.write(`${str}\n`)
	}

	/** Raw stderr write — no formatting, no newline. Used for progress dots. */
	writeErrRaw(str: string): void {
		this.errStream.write(str)
	}

	// ─── semantic ─────────────────────────────────────────────────────────

	success(msg: string): void {
		if (this.quiet) return
		this.stream.write(`${chalk.green("✓")} ${msg}\n`)
	}

	warn(msg: string): void {
		this.errStream.write(`${chalk.yellow("!")} ${msg}\n`)
	}

	note(msg: string): void {
		if (this.quiet) return
		this.stream.write(`${chalk.dim(msg)}\n`)
	}

	dim(msg: string): void {
		this.stream.write(`${chalk.dim(msg)}\n`)
	}

	/**
	 * Print a dimmed section header preceded by a blank line. Used to group
	 * sub-blocks within a single command's output (e.g. `change preview`
	 * showing the change summary, then a "planned state:" section, then the
	 * JSON dump). Caller follows up with whatever printer makes sense for the
	 * section content (`keyValue`, `printJson`, `table`, `log`, etc.).
	 */
	section(title: string): void {
		this.stream.write(`\n${chalk.dim(`${title}:`)}\n`)
	}

	error(err: unknown): void {
		const msg = err instanceof Error ? err.message : String(err)
		this.errStream.write(`${chalk.red("Error:")} ${msg}\n`)
		const hint = isOpsyError(err)
			? hintForTag(err._tag)
			: err instanceof CliError
				? err.hint
				: undefined
		if (hint) this.errStream.write(`${chalk.dim(`Hint: ${hint}`)}\n`)
	}

	// On stdout (not stderr) so `-F json` consumers — who read stdout — get
	// machine-parseable errors on non-zero exit.
	errorJson(err: unknown): void {
		const msg = err instanceof Error ? err.message : String(err)
		const body: {
			error: string
			code?: string
			tag?: string
			hint?: string
			[k: string]: unknown
		} = { error: msg }
		if (isOpsyError(err)) {
			const { _tag, message: _m, ...payload } = serialize(err)
			body.tag = _tag
			const hint = hintForTag(err._tag)
			if (hint) body.hint = hint
			Object.assign(body, payload)
		} else if (err instanceof CliError) {
			body.code = err.code
			if (err.hint) body.hint = err.hint
		}
		this.stream.write(`${JSON.stringify(body)}\n`)
	}

	debug(msg: string): void {
		if (!this.debugEnabled) return
		this.errStream.write(`${chalk.dim(`[debug] ${msg}`)}\n`)
	}

	// ─── structured ───────────────────────────────────────────────────────

	table(rows: Record<string, unknown>[], cols?: string[]): void {
		if (rows.length === 0) return
		this.stream.write(`${formatTable(rows, cols)}\n`)
	}

	keyValue(rows: Array<[string, unknown]>): void {
		if (rows.length === 0) return
		this.stream.write(`${formatKeyValue(rows)}\n`)
	}

	printJson(data: unknown): void {
		this.stream.write(`${JSON.stringify(data, null, 2)}\n`)
	}
}
