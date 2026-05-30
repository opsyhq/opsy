import { authExpired } from "@core/errors"
import { API_URL } from "../config"
import { getAccessToken } from "../credentials"
import { fetchSse, type SseMessage } from "./fetch-sse"

type ApiStreamOptions = { signal?: AbortSignal; reconnect?: boolean }

// getInit runs on every (re)connect so rotated bearers are picked up.
export async function* apiStream(
	path: string,
	opts: ApiStreamOptions = {},
): AsyncGenerator<SseMessage> {
	try {
		for await (const event of fetchSse({
			url: `${API_URL}${path}`,
			signal: opts.signal,
			reconnect: opts.reconnect ?? true,
			getInit: async () => {
				const token = await getAccessToken()
				const headers: Record<string, string> = {
					Accept: "text/event-stream",
				}
				if (token) headers.Authorization = `Bearer ${token}`
				return { headers }
			},
		})) {
			yield event
		}
	} catch (error) {
		if ((error as { status?: number } | null)?.status === 401)
			throw authExpired()
		throw error
	}
}

export async function* apiJsonStream<T>(
	path: string,
	opts: ApiStreamOptions = {},
): AsyncGenerator<T> {
	for await (const msg of apiStream(path, opts)) {
		if (!msg.data) continue
		try {
			yield JSON.parse(msg.data) as T
		} catch {
			// Skip malformed SSE data; the stream keeps flowing.
		}
	}
}
