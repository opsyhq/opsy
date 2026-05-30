import { magicLinkClient } from "better-auth/client/plugins"
import { createAuthClient } from "better-auth/react"

const appOrigin =
	typeof window === "undefined"
		? "http://localhost:3001"
		: window.location.origin
const apiBaseUrl = new URL(import.meta.env.VITE_API_URL || "/api", appOrigin)
	.toString()
	.replace(/\/$/, "")
const authBaseUrl = apiBaseUrl.endsWith("/api")
	? `${apiBaseUrl}/auth`
	: `${apiBaseUrl}/api/auth`

export const authClient = createAuthClient({
	baseURL: authBaseUrl,
	plugins: [magicLinkClient()],
})
