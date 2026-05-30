// Fake deps for CLI unit tests — no network, no filesystem, no real streams.
// Mirrors `apps/api/src/lib/deps.fake.ts` in spirit: a factory that returns a
// `HandlerDeps` with sensible defaults, overridable slot-by-slot.
//
// Production code must never import this file; only test files do.

import type { FsDep, HandlerDeps } from "@core/types/deps"
import type { client } from "../client"
import { Output } from "./output"

// ─── in-memory stream satisfying the subset of NodeJS.WriteStream that
// Output actually uses: `.write(string)` and `.isTTY`. Cast at the boundary.

class MemStream {
	readonly chunks: string[] = []
	readonly isTTY = false
	write(chunk: string | Uint8Array): boolean {
		this.chunks.push(
			typeof chunk === "string" ? chunk : new TextDecoder().decode(chunk),
		)
		return true
	}
	get value(): string {
		return this.chunks.join("")
	}
}

export type FakeOutput = Output & {
	readonly stdoutMem: MemStream
	readonly stderrMem: MemStream
}

function fakeOutput(): FakeOutput {
	const stdoutMem = new MemStream()
	const stderrMem = new MemStream()
	const out = new Output(stdoutMem as unknown as NodeJS.WriteStream, {
		color: false,
	})
	// Output hardcodes this.errStream = process.stderr in its constructor. Swap
	// it for the memory stream here so tests can assert on stderr-bound output.
	;(out as unknown as { errStream: unknown }).errStream = stderrMem
	return Object.assign(out, { stdoutMem, stderrMem })
}

// ─── default throwing client: any endpoint accessed without being stubbed
// throws a loud error identifying which path the handler tried to call.

function throwingClient(): typeof client {
	const make = (path: string[]): unknown =>
		new Proxy(() => undefined, {
			get(_t, prop) {
				if (typeof prop !== "string") return undefined
				return make([...path, prop])
			},
			apply() {
				throw new Error(
					`fakeDeps.client: no stub for ${path.join(".")} — pass overrides.client in the test`,
				)
			},
		})
	return make([]) as typeof client
}

interface FakeDepsOverrides extends Partial<HandlerDeps> {}

export function fakeDeps(overrides: FakeDepsOverrides = {}): HandlerDeps {
	const noStub = (method: string) => (): never => {
		throw new Error(
			`fakeDeps.fs: no stub for ${method} — pass overrides.fs in the test`,
		)
	}
	const fs: FsDep = {
		readFileSync: noStub("readFileSync"),
		existsSync: noStub("existsSync"),
		mkdirSync: noStub("mkdirSync"),
		writeFileSync: noStub("writeFileSync"),
		unlinkSync: noStub("unlinkSync"),
	}
	const base: HandlerDeps = {
		client: throwingClient(),
		output: fakeOutput(),
		fs,
		clock: { now: () => new Date("2000-01-01T00:00:00.000Z").getTime() },
		signals: { onInterrupt: () => () => {} },
		sleep: () => Promise.resolve(),
		cwd: () => {
			throw new Error("fakeDeps.cwd: no stub — pass overrides.cwd in the test")
		},
		randomUUID: () => {
			throw new Error(
				"fakeDeps.randomUUID: no stub — pass overrides.randomUUID in the test",
			)
		},
	}
	return { ...base, ...overrides }
}
