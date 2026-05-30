import type { SpawnedBridge } from "@opsy/bridge-client"

export type RuntimeDisposer = () => void | Promise<void>
export interface RuntimeBindings {
	stopScanLoop?: RuntimeDisposer
}

interface RuntimeProcessHandlers {
	onSigterm: () => void
	onSigint: () => void
	onUncaughtException: (err: unknown) => void
	onUnhandledRejection: (reason: unknown) => void
}

export interface ApiRuntimeState {
	bootPromise: Promise<void> | null
	booted: boolean
	bridgeHandle: SpawnedBridge | null
	bridgePromise: Promise<SpawnedBridge> | null
	bindings: RuntimeBindings
	processHandlers: RuntimeProcessHandlers | null
	processHandlersInstalled: boolean
	requestShutdown: ((code: number) => void) | null
	shuttingDown: boolean
}

declare global {
	// eslint-disable-next-line no-var
	var __opsyApiRuntime: ApiRuntimeState | undefined
}

export function createApiRuntimeState(): ApiRuntimeState {
	return {
		bootPromise: null,
		booted: false,
		bridgeHandle: null,
		bridgePromise: null,
		bindings: {},
		processHandlers: null,
		processHandlersInstalled: false,
		requestShutdown: null,
		shuttingDown: false,
	}
}

export function getApiRuntimeState(): ApiRuntimeState {
	globalThis.__opsyApiRuntime ??= createApiRuntimeState()
	return globalThis.__opsyApiRuntime
}
