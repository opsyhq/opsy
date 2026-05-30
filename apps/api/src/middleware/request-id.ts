import { createMiddleware } from "hono/factory"
import type { AppEnv } from "../types"

export const requestId = () =>
	createMiddleware<AppEnv>(async (c, next) => {
		const id = crypto.randomUUID()
		c.set("requestId", id)
		c.header("X-Request-ID", id)
		await next()
	})
