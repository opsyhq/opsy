import { Hono } from "hono"
import { validate } from "../lib/validation"
import type { AppEnv } from "../types"
import * as operations from "./operations"
import { listOperationsQuery, operationIdParam } from "./schemas"

export const projectOperationsRoutes = new Hono<AppEnv>().get(
	"/:project/operations",
	validate("query", listOperationsQuery),
	async (c) => {
		const rows = await operations.listOperations(
			c.get("actor"),
			c.get("project"),
			c.req.valid("query"),
		)
		return c.json({ operations: rows })
	},
)

export const operationsRoutes = new Hono<AppEnv>()
	.get("/:id", validate("param", operationIdParam), async (c) => {
		const result = await operations.getOperation(c.get("actor"), c.req.param("id"))
		return c.json(result)
	})
	.post("/:id/approve", validate("param", operationIdParam), async (c) => {
		const actor = c.get("actor")
		const { operation } = await operations.getOperation(actor, c.req.param("id"))
		const updated = await operations.approveOperation(operation, actor)
		return c.json({ operation: updated })
	})
	.post("/:id/cancel", validate("param", operationIdParam), async (c) => {
		const actor = c.get("actor")
		const { operation } = await operations.getOperation(actor, c.req.param("id"))
		const updated = await operations.cancelOperation(operation, actor)
		return c.json({ operation: updated })
	})
	.post("/:id/retry", validate("param", operationIdParam), async (c) => {
		const actor = c.get("actor")
		const { operation } = await operations.getOperation(actor, c.req.param("id"))
		const retried = await operations.retryOperation(operation, actor)
		return c.json({ operation: retried }, 201)
	})
