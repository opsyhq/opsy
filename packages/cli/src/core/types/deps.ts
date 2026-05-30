import type { Output } from "@shell/output"
import type { client } from "../../client"

export interface FsDep {
	readFileSync(path: string, encoding: BufferEncoding): string
	existsSync(path: string): boolean
	mkdirSync(path: string, options?: { recursive?: boolean; mode?: number }): void
	writeFileSync(path: string, data: string): void
	unlinkSync(path: string): void
}

interface ClockDep {
	now(): number
}

interface SignalsDep {
	onInterrupt(cb: () => void): () => void
}

type SleepDep = (ms: number, signal?: AbortSignal) => Promise<void>

export interface HandlerDeps {
	client: typeof client
	output: Output
	fs: FsDep
	clock: ClockDep
	signals: SignalsDep
	sleep: SleepDep
	// Per-directory context: `cwd` anchors the upward `.opsy/` walk;
	// `randomUUID` is DI'd (like `clock`/`sleep`) so `integration setup`'s
	// id generation is deterministic in tests.
	cwd: () => string
	randomUUID: () => string
}

export interface DepsOptions {
	debug?: boolean
	quiet?: boolean
}
