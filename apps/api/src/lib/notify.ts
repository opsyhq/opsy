import { sql } from "drizzle-orm"
import { db } from "./db/client"
import { baseLogger } from "./logger"

const log = baseLogger.child({ module: "notify" })
const MAX_BUFFERED_NOTIFICATIONS = 64

type Listener = {
	listen(
		channel: string,
		handler: (payload: string) => void,
	): Promise<{ unlisten(): Promise<void> }>
}

type SubscriberQueue = {
	buffered: unknown[]
	resolvers: Array<(value: IteratorResult<unknown, void>) => void>
	closed: boolean
	filter?: (value: unknown) => boolean
}

type ChannelState = {
	subscribers: Set<SubscriberQueue>
	unlisten: (() => Promise<void>) | null
	listenPromise: Promise<void> | null
	refCount: number
}

export async function pgNotify(
	channel: string,
	payload: string,
): Promise<void> {
	await db.execute(sql`SELECT pg_notify(${channel}, ${payload})`)
}

export async function listen(
	channel: string,
	handler: (payload: string) => void,
): Promise<() => Promise<void>> {
	const sub = await db.$client.listen(channel, handler)
	return async () => {
		await sub.unlisten()
	}
}

export function makeJsonNotificationBus(
	listener: Listener,
	maxBuffered = MAX_BUFFERED_NOTIFICATIONS,
) {
	const channels = new Map<string, ChannelState>()

	function stateFor(channel: string): ChannelState {
		const existing = channels.get(channel)
		if (existing) return existing
		const state: ChannelState = {
			subscribers: new Set(),
			unlisten: null,
			listenPromise: null,
			refCount: 0,
		}
		channels.set(channel, state)
		return state
	}

	function dispatch(
		channel: string,
		state: ChannelState,
		value: unknown,
	): void {
		for (const subscriber of state.subscribers) {
			if (subscriber.closed) continue
			if (subscriber.filter) {
				try {
					if (!subscriber.filter(value)) continue
				} catch (err) {
					log.warn({ err, channel }, "notification subscriber filter failed")
					continue
				}
			}
			const resolver = subscriber.resolvers.shift()
			if (resolver) {
				resolver({ value, done: false })
				continue
			}
			subscriber.buffered.push(value)
			if (subscriber.buffered.length > maxBuffered) {
				const dropped = subscriber.buffered.shift()
				log.warn({ channel, dropped }, "notification subscriber queue overflow")
			}
		}
	}

	function handlePayload(
		channel: string,
		state: ChannelState,
		payload: string,
	) {
		try {
			const value = JSON.parse(payload) as unknown
			dispatch(channel, state, value)
		} catch (err) {
			log.warn({ err, channel }, "malformed notification payload")
		}
	}

	async function ensureListening(channel: string, state: ChannelState) {
		if (state.unlisten) return
		if (state.listenPromise) return state.listenPromise
		state.listenPromise = (async () => {
			const sub = await listener.listen(channel, (payload) =>
				handlePayload(channel, state, payload),
			)
			state.unlisten = () => sub.unlisten()
		})()
		try {
			await state.listenPromise
		} finally {
			state.listenPromise = null
		}
		if (state.refCount === 0) void maybeStopListening(channel, state)
	}

	async function maybeStopListening(channel: string, state: ChannelState) {
		if (state.refCount > 0 || state.listenPromise || !state.unlisten) return
		const unlisten = state.unlisten
		state.unlisten = null
		channels.delete(channel)
		await unlisten().catch((err) => {
			log.warn({ err, channel }, "unlisten failed during shutdown")
		})
	}

	async function* subscribeJson<T>(
		channel: string,
		signal: AbortSignal,
		filter?: (value: T) => boolean,
	): AsyncGenerator<T, void, void> {
		if (signal.aborted) return

		const state = stateFor(channel)
		const queue: SubscriberQueue = {
			buffered: [],
			resolvers: [],
			closed: false,
			filter: filter as ((value: unknown) => boolean) | undefined,
		}
		state.subscribers.add(queue)
		state.refCount += 1

		let cleanedUp = false
		const cleanup = () => {
			if (cleanedUp) return
			cleanedUp = true
			queue.closed = true
			state.subscribers.delete(queue)
			for (const resolver of queue.resolvers) {
				resolver({ value: undefined, done: true })
			}
			queue.resolvers.length = 0
			queue.buffered.length = 0
			state.refCount -= 1
			signal.removeEventListener("abort", cleanup)
			void maybeStopListening(channel, state)
		}

		signal.addEventListener("abort", cleanup)

		try {
			await ensureListening(channel, state)
		} catch (err) {
			cleanup()
			throw err
		}

		try {
			while (!queue.closed) {
				if (queue.buffered.length > 0) {
					yield queue.buffered.shift() as T
					continue
				}
				const next = await new Promise<IteratorResult<unknown, void>>(
					(resolve) => {
						queue.resolvers.push(resolve)
					},
				)
				if (next.done) return
				yield next.value as T
			}
		} finally {
			cleanup()
		}
	}

	return {
		subscribeJson,
	}
}

const defaultJsonNotificationBus = makeJsonNotificationBus({
	listen: (channel, handler) => db.$client.listen(channel, handler),
})

export const subscribeJson = defaultJsonNotificationBus.subscribeJson
