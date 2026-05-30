import { randomUUID } from "node:crypto"
import {
	existsSync,
	mkdirSync,
	readFileSync,
	unlinkSync,
	writeFileSync,
} from "node:fs"
import type { DepsOptions, HandlerDeps } from "@core/types/deps"
import { client } from "../client"
import { setHttpDebugEnabled } from "./debug"
import { Output } from "./output"

export function realDeps(opts: DepsOptions = {}): HandlerDeps {
	setHttpDebugEnabled(Boolean(opts.debug))
	return {
		client,
		output: new Output(process.stdout, {
			debug: opts.debug,
			quiet: opts.quiet,
		}),
		fs: {
			readFileSync,
			existsSync,
			mkdirSync: (path, options) => {
				mkdirSync(path, options)
			},
			writeFileSync: (path, data) => {
				writeFileSync(path, data)
			},
			unlinkSync,
		},
		clock: { now: () => Date.now() },
		cwd: () => process.cwd(),
		randomUUID: () => randomUUID(),
		signals: {
			onInterrupt(cb) {
				process.once("SIGINT", cb)
				return () => process.removeListener("SIGINT", cb)
			},
		},
		sleep(ms, signal) {
			return new Promise((resolve) => {
				if (signal?.aborted) {
					resolve()
					return
				}
				const t = setTimeout(() => {
					signal?.removeEventListener("abort", onAbort)
					resolve()
				}, ms)
				const onAbort = () => {
					clearTimeout(t)
					resolve()
				}
				signal?.addEventListener("abort", onAbort, { once: true })
			})
		},
	}
}
