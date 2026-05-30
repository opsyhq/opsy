import { describe, expect, test } from "bun:test"
import {
	type ApiRuntimeDeps,
	refreshHotBindings,
	startApiRuntime,
	stopApiRuntime,
} from "./api"
import { type ApiRuntimeState, createApiRuntimeState } from "./state"

interface Calls {
	exits: number[]
	logErrors: number
	migrations: number
	processOns: string[]
	processOffs: string[]
	scanStarts: number
	scanStops: number
	shutdownDb: number
	shutdownProviders: number
	workflowWorldStarts: number
}

function makeCalls(): Calls {
	return {
		exits: [],
		logErrors: 0,
		migrations: 0,
		processOns: [],
		processOffs: [],
		scanStarts: 0,
		scanStops: 0,
		shutdownDb: 0,
		shutdownProviders: 0,
		workflowWorldStarts: 0,
	}
}

function makeDeps(state: ApiRuntimeState, calls: Calls): ApiRuntimeDeps {
	return {
		exit: (code) => {
			calls.exits.push(code)
		},
		logError: () => {
			calls.logErrors += 1
		},
		migrate: async () => {
			calls.migrations += 1
		},
		process: {
			on(event) {
				calls.processOns.push(event)
			},
			off(event) {
				calls.processOffs.push(event)
			},
		},
		shutdownDb: async () => {
			calls.shutdownDb += 1
		},
		shutdownProviders: async () => {
			calls.shutdownProviders += 1
			state.bridgeHandle = null
		},
		startScanLoop: () => {
			calls.scanStarts += 1
		},
		startWorkflowWorld: async () => {
			calls.workflowWorldStarts += 1
		},
		stopScanLoop: () => {
			calls.scanStops += 1
		},
	}
}

describe("api runtime lifecycle", () => {
	test("two hot starts run boot once and keep provider initialization single-spawn", async () => {
		const state = createApiRuntimeState()
		const calls = makeCalls()
		const deps = makeDeps(state, calls)

		await startApiRuntime(deps, state)
		await startApiRuntime(deps, state)

		expect(calls.migrations).toBe(1)
		expect(calls.workflowWorldStarts).toBe(1)
		expect(calls.processOns).toEqual([
			"SIGTERM",
			"SIGINT",
			"uncaughtException",
			"unhandledRejection",
		])
	})

	test("reload-sensitive bindings are replaced on each hot start", async () => {
		const state = createApiRuntimeState()
		const calls = makeCalls()
		const deps = makeDeps(state, calls)

		await startApiRuntime(deps, state)
		await startApiRuntime(deps, state)

		expect(calls.scanStarts).toBe(2)
		expect(calls.scanStops).toBe(1)
	})

	test("stopApiRuntime cleans active bindings and providers once", async () => {
		const state = createApiRuntimeState()
		const calls = makeCalls()
		const deps = makeDeps(state, calls)

		await startApiRuntime(deps, state)
		await stopApiRuntime(deps, state)
		await stopApiRuntime(deps, state)

		expect(calls.scanStops).toBe(1)
		expect(calls.shutdownProviders).toBe(1)
	})

	test("refreshHotBindings cleans partial bindings when startup fails", async () => {
		const state = createApiRuntimeState()
		const calls = makeCalls()
		const deps = makeDeps(state, calls)
		deps.startScanLoop = () => {
			calls.scanStarts += 1
			throw new Error("scan loop failed")
		}

		await expect(refreshHotBindings(deps, state)).rejects.toThrow(
			"scan loop failed",
		)

		expect(calls.scanStarts).toBe(1)
		expect(calls.scanStops).toBe(0)
		expect(state.bindings).toEqual({})
	})
})
