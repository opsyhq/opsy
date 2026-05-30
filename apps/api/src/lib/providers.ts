import {
	type BridgeClient,
	type SpawnedBridge,
	spawnBridge,
} from "@opsy/bridge-client"
import type { Integration as ProviderIntegration } from "@opsy/provider"
import { getApiRuntimeState } from "../runtime/state"
import type { IntegrationRow } from "./db/schema"
import { env } from "./env"
import { baseLogger } from "./logger"

const log = baseLogger.child({ component: "providers" })

async function initBridge(): Promise<SpawnedBridge> {
	const state = getApiRuntimeState()
	if (state.bridgeHandle) return state.bridgeHandle
	if (state.bridgePromise) return state.bridgePromise
	state.bridgePromise = spawnBridge({
		binPath: env.OPSY_BRIDGE_BIN,
		providerDir: env.OPSY_PROVIDER_DIR,
		schemaCacheDir: env.OPSY_SCHEMA_CACHE_DIR,
		// hashicorp's go-plugin sends every level (TRACE→ERROR) to stderr,
		// so logging it at warn would flood the console. Pipe both at
		// debug — flip LOG_LEVEL=debug to see bridge chatter.
		onStdout: (line) => log.debug({ line }, "bridge stdout"),
		onStderr: (line) => log.debug({ line }, "bridge stderr"),
	}).then((handle) => {
		state.bridgeHandle = handle
		log.info("spawned bridge")
		return handle
	})
	try {
		return await state.bridgePromise
	} catch (err) {
		state.bridgePromise = null
		throw err
	}
}

export async function getBridgeClient(): Promise<BridgeClient> {
	return (await initBridge()).client
}

/**
 * Translate a DB integration row into the shape `@opsy/provider` expects.
 * Runtime selection happens before dispatch; the version is still forwarded so
 * lower-level adapters can include the row's effective provider identity.
 */
export function toProviderIntegration(
	row: IntegrationRow,
): ProviderIntegration {
	return {
		provider: row.provider,
		credentials: row.credentials,
		config: row.config,
		...(row.providerVersion ? { providerVersion: row.providerVersion } : {}),
	}
}

export async function shutdownProviders(): Promise<void> {
	const state = getApiRuntimeState()
	const pendingBridge = state.bridgePromise
	const handle =
		state.bridgeHandle ??
		(await pendingBridge?.catch((err) => {
			log.warn({ err }, "bridge startup failed during shutdown")
			return null
		}))
	state.bridgeHandle = null
	state.bridgePromise = null
	if (!handle) return
	try {
		await handle.shutdown()
		log.info("bridge shut down")
	} catch (err) {
		log.warn({ err }, "bridge shutdown failed")
	}
}
