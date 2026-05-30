import { networkError } from "@core/errors"
import type { AppType } from "@opsy/api"
import { API_URL } from "@shell/config"
import { getAccessToken } from "@shell/credentials"
import { emitHttpDebug } from "@shell/debug"
import { hc } from "hono/client"

// API_URL is loaded once at module init from env / config file.
// If you ever need a different base URL within a process (tests, etc.),
// import `hc` from "hono/client" directly and build a fresh client.
export const client = hc<AppType>(API_URL, {
	fetch: opsyFetch,
})

export async function opsyFetch(
	input: string | URL | Request,
	init?: RequestInit,
): Promise<Response> {
	const started = performance.now()
	const headers = new Headers(init?.headers)
	const token = await getAccessToken()
	if (token) headers.set("Authorization", `Bearer ${token}`)
	const url =
		typeof input === "string"
			? input
			: input instanceof URL
				? input.href
				: input.url
	const method = init?.method ?? "GET"
	try {
		const res = await fetch(input, { ...init, headers })
		emitHttpDebug(input, init, {
			status: res.status,
			durationMs: performance.now() - started,
		})
		return res
	} catch (error) {
		emitHttpDebug(input, init, {
			error,
			durationMs: performance.now() - started,
		})
		throw networkError(error, { url, method })
	}
}
