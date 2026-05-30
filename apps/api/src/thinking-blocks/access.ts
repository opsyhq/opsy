import { createMiddleware } from "hono/factory"
import { auth } from "@/auth"
import { env } from "@/lib/env"
import type { AppEnv } from "@/types"

export function requireThinkingBlockSuperAdmin() {
	return createMiddleware<AppEnv>(async (c, next) => {
		const headers = c.req.raw.headers
		if (headers.get("authorization")?.toLowerCase().startsWith("bearer ")) {
			return c.json({ error: "Not found", status: 404 }, 404)
		}

		const sessionData = await auth.api.getSession({ headers }).catch(() => null)
		const email = sessionData?.user.email?.trim().toLowerCase()
		if (!email || !env.OPSY_SUPER_ADMIN_EMAILS.includes(email)) {
			return c.json({ error: "Not found", status: 404 }, 404)
		}

		await next()
	})
}
