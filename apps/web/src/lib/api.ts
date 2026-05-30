import type { AppType } from "@opsy/api"
import { tryDeserialize } from "@opsy/contracts/errors"
import { hc } from "hono/client"

export const apiBaseUrl = (import.meta.env.VITE_API_URL || "/api").replace(
	/\/$/,
	"",
)

// Better Auth uses cookies for browser sessions, so the fetch wrapper just
// needs `credentials: "include"`. The previous Authorization header / token
// getter shim is gone — bearer auth lives in the CLI now.
export const api = hc<AppType>(apiBaseUrl, {
	fetch(input: RequestInfo | URL, init?: RequestInit) {
		return fetch(input, { ...init, credentials: "include" })
	},
})

export async function throwingJson<T>(
	res: Response,
	fallback: string,
): Promise<T> {
	if (!res.ok) {
		const text = await res.text()
		let parsed: unknown = null
		try {
			parsed = text ? JSON.parse(text) : null
		} catch {
			parsed = null
		}
		const hydrated = tryDeserialize(parsed)
		if (hydrated) throw hydrated
		throw new Error(text || fallback)
	}
	return (await res.json()) as T
}
