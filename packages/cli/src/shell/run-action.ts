import type { HandlerDeps } from "@core/types/deps"
import type { Command } from "commander"
import { cliError } from "./exit"

// Commander calls actions with variadic `(argN..., opts, command)`.
// verbOpts comes from `raw[length-2]` so caught errors can honor `-F json`.
export function runAction<Args extends unknown[]>(
	fn: (deps: HandlerDeps, ...args: Args) => Promise<void>,
): (...args: [...Args, Command]) => Promise<void> {
	return async (...raw) => {
		const cmd = raw[raw.length - 1] as Command
		const d = (cmd.optsWithGlobals() as { _deps?: HandlerDeps })._deps
		if (!d) throw new Error("deps not set — preAction hook did not fire")
		const verbOpts = (raw[raw.length - 2] ?? {}) as { format?: string }
		const fnArgs = raw.slice(0, -1) as unknown as Args
		try {
			await fn(d, ...fnArgs)
		} catch (err) {
			cliError(d.output, err, { format: verbOpts.format })
		}
	}
}
