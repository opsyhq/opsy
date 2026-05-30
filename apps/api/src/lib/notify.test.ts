import { describe, expect, test } from "bun:test"
import { makeJsonNotificationBus } from "./notify"

type FakeListener = {
	listenCalls: number
	unlistenCalls: number
	handlers: Map<string, (payload: string) => void>
	emit(channel: string, payload: string): void
	listen(
		channel: string,
		handler: (payload: string) => void,
	): Promise<{ unlisten(): Promise<void> }>
}

function makeFakeListener(): FakeListener {
	const state: FakeListener = {
		listenCalls: 0,
		unlistenCalls: 0,
		handlers: new Map(),
		emit: (channel, payload) => {
			state.handlers.get(channel)?.(payload)
		},
		listen: async (channel, handler) => {
			state.listenCalls += 1
			state.handlers.set(channel, handler)
			return {
				unlisten: async () => {
					state.unlistenCalls += 1
					state.handlers.delete(channel)
				},
			}
		},
	}
	return state
}

async function flushMicrotasks() {
	for (let i = 0; i < 5; i += 1) await Promise.resolve()
}

describe("subscribeJson", () => {
	test("shares one channel listener across filtered subscribers", async () => {
		const listener = makeFakeListener()
		const bus = makeJsonNotificationBus(listener)
		const first: Array<{ id: string }> = []
		const second: Array<{ id: string }> = []
		const ac1 = new AbortController()
		const ac2 = new AbortController()

		const c1 = (async () => {
			for await (const value of bus.subscribeJson<{ id: string }>(
				"ops",
				ac1.signal,
				(value) => value.id === "one",
			)) {
				first.push(value)
				break
			}
		})()
		const c2 = (async () => {
			for await (const value of bus.subscribeJson<{ id: string }>(
				"ops",
				ac2.signal,
				(value) => value.id === "two",
			)) {
				second.push(value)
				break
			}
		})()

		await flushMicrotasks()
		expect(listener.listenCalls).toBe(1)

		listener.emit("ops", JSON.stringify({ id: "ignored" }))
		listener.emit("ops", JSON.stringify({ id: "one" }))
		listener.emit("ops", JSON.stringify({ id: "two" }))

		await Promise.all([c1, c2])
		expect(first).toEqual([{ id: "one" }])
		expect(second).toEqual([{ id: "two" }])
	})

	test("bounds each subscriber queue and drops oldest notifications", async () => {
		const listener = makeFakeListener()
		const bus = makeJsonNotificationBus(listener, 3)
		const ac = new AbortController()
		const gen = bus.subscribeJson<{ seq: number }>("ops", ac.signal)

		const firstPromise = gen.next()
		await flushMicrotasks()
		listener.emit("ops", JSON.stringify({ seq: 0 }))
		const first = await firstPromise
		expect(first.done).toBe(false)
		expect(first.value).toEqual({ seq: 0 })

		for (let seq = 1; seq <= 5; seq += 1) {
			listener.emit("ops", JSON.stringify({ seq }))
		}

		const observed: number[] = []
		for (let i = 0; i < 3; i += 1) {
			const next = await gen.next()
			expect(next.done).toBe(false)
			if (next.value) observed.push(next.value.seq)
		}
		await gen.return()

		expect(observed).toEqual([3, 4, 5])
	})
})
