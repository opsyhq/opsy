import { spawn } from "node:child_process"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createInterface } from "node:readline"
import { BridgeClient, type BridgeClientOptions } from "./client"

interface SpawnBridgeOptions {
	/** Absolute path to the opsy-bridge binary. */
	binPath: string
	/** Provider directory containing terraform-provider-{name}/{version}/ binaries. */
	providerDir: string
	/** Directory where bridge schema extraction shards are stored. */
	schemaCacheDir?: string
	/** Pool size flag passed to the bridge. Default: 20. */
	poolSize?: number
	/** Receives bridge stderr lines (one per call). Default: pipe to process.stderr with prefix. */
	onStderr?: (line: string) => void
	/** Receives bridge stdout lines AFTER the port line. Default: pipe to process.stdout with prefix. */
	onStdout?: (line: string) => void
	/** Time to wait for the port line before failing. Default: 5000ms. */
	startupTimeoutMs?: number
	/** Time to wait for graceful SIGTERM shutdown before SIGKILL. Default: 5000ms. */
	shutdownGraceMs?: number
	/**
	 * Forwarded to the `BridgeClient` constructor — currently used to wire an
	 * `onCall` observability callback. The orchestrator passes a pino logger
	 * here in PR 4; default is undefined (no observability).
	 */
	bridgeClientOptions?: BridgeClientOptions
}

export interface SpawnedBridge {
	client: BridgeClient
	/** Cleanly shut the bridge down. Idempotent. */
	shutdown(): Promise<void>
	/** Resolves when the bridge process exits (cleanly or otherwise). */
	readonly exited: Promise<{
		code: number | null
		signal: NodeJS.Signals | null
	}>
}

export class BridgeStartupError extends Error {
	constructor(message: string) {
		super(message)
		this.name = "BridgeStartupError"
	}
}

export async function spawnBridge(
	opts: SpawnBridgeOptions,
): Promise<SpawnedBridge> {
	const args = [
		"--provider-dir",
		opts.providerDir,
		"--schema-cache-dir",
		opts.schemaCacheDir ??
			process.env.OPSY_SCHEMA_CACHE_DIR ??
			join(tmpdir(), "opsy-schema-cache"),
		"--pool-size",
		String(opts.poolSize ?? 20),
	]
	const child = spawn(opts.binPath, args, {
		stdio: ["ignore", "pipe", "pipe"],
		detached: false, // die when parent dies
	})

	const stderrLines = createInterface({ input: child.stderr })
	const onStderr =
		opts.onStderr ??
		((line: string) => process.stderr.write(`bridge: ${line}\n`))
	const stderrTail: string[] = []
	stderrLines.on("line", (line) => {
		stderrTail.push(line)
		if (stderrTail.length > 20) stderrTail.shift()
		onStderr(line)
	})

	// Node's `exit` event is synchronous — it won't await a promise, so the
	// exit-path handler must be sync. Async grace escalation lives on signals.
	let exitInfo: { code: number | null; signal: NodeJS.Signals | null } | null =
		null
	const killSync = (): void => {
		if (exitInfo) return
		try {
			child.kill("SIGTERM")
		} catch {
			/* already dead */
		}
	}
	const signalCleanup = (): void => {
		void shutdown()
	}

	const exited = new Promise<{
		code: number | null
		signal: NodeJS.Signals | null
	}>((resolve) => {
		child.on("exit", (code, signal) => {
			exitInfo = { code, signal }
			process.off("exit", killSync)
			process.off("SIGINT", signalCleanup)
			process.off("SIGTERM", signalCleanup)
			resolve({ code, signal })
		})
	})

	// First stdout line is the port; subsequent lines pipe to onStdout.
	const stdoutLines = createInterface({ input: child.stdout })
	const portStr = await Promise.race([
		new Promise<string>((resolve) => {
			const onLine = (line: string) => {
				stdoutLines.off("line", onLine)
				resolve(line.trim())
			}
			stdoutLines.on("line", onLine)
		}),
		exited.then((info) => {
			const detail =
				stderrTail.length > 0
					? `\n\nbridge stderr:\n${stderrTail.join("\n")}`
					: ""
			throw new BridgeStartupError(
				`bridge exited before announcing port (code=${info.code}, signal=${info.signal})${detail}`,
			)
		}),
		new Promise<never>((_, reject) => {
			setTimeout(
				() =>
					reject(
						new BridgeStartupError(
							`bridge did not announce port within ${opts.startupTimeoutMs ?? 5000}ms`,
						),
					),
				opts.startupTimeoutMs ?? 5000,
			)
		}),
	])

	const port = Number(portStr)
	if (!Number.isInteger(port) || port <= 0 || port > 65535) {
		child.kill("SIGKILL")
		throw new BridgeStartupError(`bridge announced invalid port: ${portStr}`)
	}

	const onStdout =
		opts.onStdout ??
		((line: string) => process.stdout.write(`bridge: ${line}\n`))
	stdoutLines.on("line", onStdout)

	const client = BridgeClient.fromUrl(
		`http://127.0.0.1:${port}`,
		opts.bridgeClientOptions,
	)

	let shutdownCalled = false
	async function shutdown(): Promise<void> {
		if (shutdownCalled) return
		shutdownCalled = true
		process.off("exit", killSync)
		process.off("SIGINT", signalCleanup)
		process.off("SIGTERM", signalCleanup)
		if (exitInfo) return
		child.kill("SIGTERM")
		const grace = opts.shutdownGraceMs ?? 5000
		await Promise.race([
			exited,
			new Promise<void>((resolve) => setTimeout(resolve, grace)),
		])
		if (!exitInfo) {
			child.kill("SIGKILL")
			await exited
		}
	}

	process.on("exit", killSync)
	process.on("SIGINT", signalCleanup)
	process.on("SIGTERM", signalCleanup)

	return { client, shutdown, exited }
}
