import { createMiddleware } from "hono/factory"
import { baseLogger } from "../lib/logger"
import type { AppEnv } from "../types"

export const logger = () =>
	createMiddleware<AppEnv>(async (c, next) => {
		const requestId = c.get("requestId")
		const childLogger = baseLogger.child({ requestId })
		c.set("logger", childLogger)
		const start = Date.now()
		childLogger.info(
			{ method: c.req.method, path: c.req.path },
			"request start",
		)
		await next()
		childLogger.info(
			{
				method: c.req.method,
				path: c.req.path,
				status: c.res.status,
				duration: Date.now() - start,
			},
			"request complete",
		)
	})
