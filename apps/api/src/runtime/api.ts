import { shutdownDb } from "../lib/db/client"
import { migrate } from "../lib/db/migrate"
import { env } from "../lib/env"
import { baseLogger } from "../lib/logger"
import { shutdownProviders } from "../lib/providers"
import { startScanLoop, stopScanLoop } from "../projects"
import {
	type ApiRuntimeState,
	getApiRuntimeState,
	type RuntimeBindings,
	type RuntimeDisposer,
} from "./state"

type ProcessEvent =
	| "SIGTERM"
	| "SIGINT"
	| "uncaughtException"
	| "unhandledRejection"

interface RuntimeProcessLike {
	on(event: ProcessEvent, listener: (...args: unknown[]) => void): unknown
	off(event: ProcessEvent, listener: (...args: unknown[]) => void): unknown
}

export interface ApiRuntimeDeps {
	exit(code: number): void
	logError(ctx: Record<string, unknown>, message: string): void
	migrate: typeof migrate
	process: RuntimeProcessLike
	shutdownDb: typeof shutdownDb
	shutdownProviders: typeof shutdownProviders
	startScanLoop: typeof startScanLoop
	startWorkflowWorld(): Promise<void>
	stopScanLoop: typeof stopScanLoop
}

const log = baseLogger.child({ module: "api-runtime" })

const defaultRuntimeDeps: ApiRuntimeDeps = {
	exit: (code) => process.exit(code),
	logError: (ctx, message) => log.error(ctx, message),
	migrate,
	process,
	shutdownDb,
	shutdownProviders,
	startScanLoop,
	startWorkflowWorld: async () => {
		process.env.WORKFLOW_TARGET_WORLD = env.WORKFLOW_TARGET_WORLD
		process.env.WORKFLOW_POSTGRES_URL ??=
			env.WORKFLOW_POSTGRES_URL ?? env.DATABASE_URL
		process.env.WORKFLOW_POSTGRES_WORKER_CONCURRENCY ??= String(
			env.WORKFLOW_POSTGRES_WORKER_CONCURRENCY,
		)
		process.env.WORKFLOW_POSTGRES_MAX_POOL_SIZE ??= String(
			env.WORKFLOW_POSTGRES_MAX_POOL_SIZE,
		)

		if (env.WORKFLOW_TARGET_WORLD !== "@workflow/world-postgres") return
		const [{ setWorld }, { createWorld }] = await Promise.all([
			import("workflow/runtime"),
			import("@workflow/world-postgres"),
			import("@workflow/world-postgres/cli"),
		])
		const world = createWorld()
		setWorld(world)
		await world.start?.()
	},
	stopScanLoop,
}

async function dispose(
	name: keyof RuntimeBindings,
	fn: RuntimeDisposer | undefined,
	deps: ApiRuntimeDeps,
): Promise<void> {
	if (!fn) return
	try {
		await fn()
	} catch (err) {
		deps.logError({ err, binding: name }, "runtime binding cleanup failed")
	}
}

async function stopHotBindings(
	deps: ApiRuntimeDeps = defaultRuntimeDeps,
	state: ApiRuntimeState = getApiRuntimeState(),
): Promise<void> {
	const bindings = state.bindings
	state.bindings = {}
	await dispose("stopScanLoop", bindings.stopScanLoop, deps)
}

async function ensureBootedOnce(
	deps: ApiRuntimeDeps = defaultRuntimeDeps,
	state: ApiRuntimeState = getApiRuntimeState(),
): Promise<void> {
	if (state.booted) return
	if (state.bootPromise) return state.bootPromise

	state.bootPromise = (async () => {
		await deps.migrate()
		await deps.startWorkflowWorld()
		state.booted = true
	})()

	try {
		await state.bootPromise
	} finally {
		state.bootPromise = null
	}
}

export async function refreshHotBindings(
	deps: ApiRuntimeDeps = defaultRuntimeDeps,
	state: ApiRuntimeState = getApiRuntimeState(),
): Promise<void> {
	await stopHotBindings(deps, state)
	const nextBindings: RuntimeBindings = {}
	state.bindings = nextBindings
	try {
		deps.startScanLoop()
		nextBindings.stopScanLoop = () => deps.stopScanLoop()
	} catch (err) {
		await stopHotBindings(deps, state)
		throw err
	}
}

export async function stopApiRuntime(
	deps: ApiRuntimeDeps = defaultRuntimeDeps,
	state: ApiRuntimeState = getApiRuntimeState(),
): Promise<void> {
	if (state.shuttingDown) return
	state.shuttingDown = true
	await stopHotBindings(deps, state)
	await deps.shutdownProviders()
	await deps.shutdownDb()
	state.booted = false
}

function installApiRuntimeProcessHandlers(
	deps: ApiRuntimeDeps = defaultRuntimeDeps,
	state: ApiRuntimeState = getApiRuntimeState(),
): void {
	state.requestShutdown = (code: number) => {
		void stopApiRuntime(deps, state).finally(() => deps.exit(code))
	}
	if (state.processHandlersInstalled) return

	const onSigterm = () => state.requestShutdown?.(0)
	const onSigint = () => state.requestShutdown?.(0)
	const onUncaughtException = (err: unknown) => {
		deps.logError({ err }, "uncaughtException")
		state.requestShutdown?.(1)
	}
	// Log only — do NOT shut down. Closing the DB pool here races the
	// workflow worker (still polling graphile_worker for jobs) and strands
	// in-flight steps with "CONNECTION_ENDED" mid-update, leaving operation
	// rows pinned at `pending`/`running` because their cleanup queries fail
	// too. A stray rejection in fire-and-forget code shouldn't take the
	// process down. `uncaughtException` still triggers shutdown — that one
	// genuinely indicates corrupted process state.
	const onUnhandledRejection = (reason: unknown) => {
		deps.logError({ err: reason }, "unhandledRejection")
	}

	state.processHandlers = {
		onSigterm,
		onSigint,
		onUncaughtException,
		onUnhandledRejection,
	}
	deps.process.on("SIGTERM", onSigterm)
	deps.process.on("SIGINT", onSigint)
	deps.process.on("uncaughtException", onUncaughtException)
	deps.process.on("unhandledRejection", onUnhandledRejection)
	state.processHandlersInstalled = true
}

export async function startApiRuntime(
	deps: ApiRuntimeDeps = defaultRuntimeDeps,
	state: ApiRuntimeState = getApiRuntimeState(),
): Promise<void> {
	installApiRuntimeProcessHandlers(deps, state)
	await ensureBootedOnce(deps, state)
	await refreshHotBindings(deps, state)
}
