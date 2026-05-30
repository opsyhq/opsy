import { Hono } from "hono"
import { validate } from "../lib/validation"
import type { AppEnv } from "../types"
import {
	apply,
	create,
	deleteItem,
	discard,
	get,
	getActive,
	getItemDryRun,
	getOrCreateActive,
	list,
	refreshDryRuns,
	stageItem,
	updateItem,
} from "./changesets"
import {
	addChangeSetItemBody,
	changeSetIdParam,
	changeSetItemIdParam,
	createChangeSetBody,
	updateChangeSetItemBody,
} from "./schemas"

export const changeSetRoutes = new Hono<AppEnv>()
	.get("/:project/changesets", async (c) => {
		const changeSets = await list(c.get("actor"), c.get("project"))
		return c.json({ changeSets })
	})
	.post(
		"/:project/changesets",
		validate("json", createChangeSetBody),
		async (c) => {
			const result = await create(
				c.get("actor"),
				c.get("project"),
				c.req.valid("json"),
			)
			return c.json(result, 201)
		},
	)
	.get("/:project/changesets/active", async (c) => {
		const result = await getActive(c.get("actor"), c.get("project"))
		return c.json(result)
	})
	.post("/:project/changesets/active", async (c) => {
		const changeSet = await getOrCreateActive(
			c.get("actor"),
			c.get("project"),
		)
		return c.json(changeSet, 201)
	})
	.get(
		"/:project/changesets/:id",
		validate("param", changeSetIdParam),
		async (c) => {
			const result = await get(
				c.get("actor"),
				c.get("project"),
				c.req.param("id"),
			)
			return c.json(result)
		},
	)
	.post(
		"/:project/changesets/:id/items",
		validate("param", changeSetIdParam),
		validate("json", addChangeSetItemBody),
		async (c) => {
			const result = await stageItem(
				c.get("actor"),
				c.get("project"),
				c.req.param("id"),
				c.req.valid("json"),
			)
			return c.json(result, 201)
		},
	)
	.patch(
		"/:project/changesets/:id/items/:itemId",
		validate("param", changeSetItemIdParam),
		validate("json", updateChangeSetItemBody),
		async (c) => {
			const result = await updateItem(
				c.get("actor"),
				c.get("project"),
				c.req.param("id"),
				c.req.param("itemId"),
				c.req.valid("json"),
			)
			return c.json(result)
		},
	)
	.delete(
		"/:project/changesets/:id/items/:itemId",
		validate("param", changeSetItemIdParam),
		async (c) => {
			const result = await deleteItem(
				c.get("actor"),
				c.get("project"),
				c.req.param("id"),
				c.req.param("itemId"),
			)
			return c.json(result)
		},
	)
	.post(
		"/:project/changesets/:id/dry-runs/refresh",
		validate("param", changeSetIdParam),
		async (c) => {
			const result = await refreshDryRuns(
				c.get("actor"),
				c.get("project"),
				c.req.param("id"),
			)
			return c.json(result)
		},
	)
	.get(
		"/:project/changesets/:id/items/:itemId/dry-run",
		validate("param", changeSetItemIdParam),
		async (c) => {
			const result = await getItemDryRun(
				c.get("project"),
				c.req.param("id"),
				c.req.param("itemId"),
			)
			return c.json(result)
		},
	)
	.post(
		"/:project/changesets/:id/apply",
		validate("param", changeSetIdParam),
		async (c) => {
			const result = await apply(
				c.get("actor"),
				c.get("project"),
				c.req.param("id"),
			)
			return c.json(result)
		},
	)
	.post(
		"/:project/changesets/:id/discard",
		validate("param", changeSetIdParam),
		async (c) => {
			const result = await discard(
				c.get("actor"),
				c.get("project"),
				c.req.param("id"),
			)
			return c.json(result)
		},
	)
