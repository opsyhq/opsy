import { Hono } from "hono"
import { forceQuery, validate } from "../lib/validation"
import type { AppEnv } from "../types"
import {
	checkIntegration,
	checkIntegrationCredentials,
	createIntegration,
	deleteIntegration,
	getIntegrationBySlug,
	getIntegrationsByProject,
	getIntegrationView,
	updateIntegration,
} from "./integrations"
import {
	checkExistingIntegrationBody,
	checkIntegrationBody,
	createIntegrationBody,
	updateIntegrationBody,
} from "./schemas"

export const integrationRoutes = new Hono<AppEnv>()
	.post(
		"/:project/integrations",
		validate("json", createIntegrationBody),
		async (c) => {
			const row = await createIntegration(
				c.get("actor"),
				c.get("project"),
				c.req.valid("json"),
			)
			return c.json({ integration: getIntegrationView(row) }, 201)
		},
	)
	.get("/:project/integrations", async (c) => {
		const rows = await getIntegrationsByProject(c.get("project"))
		return c.json({ integrations: rows.map(getIntegrationView) })
	})
	.post(
		"/:project/integrations/check",
		validate("json", checkIntegrationBody),
		async (c) =>
			c.json({
				check: await checkIntegrationCredentials(c.req.valid("json")),
			}),
	)
	.post(
		"/:project/integrations/:slug/check",
		validate("json", checkExistingIntegrationBody),
		async (c) =>
			c.json({
				check: await checkIntegration(
					c.get("project"),
					c.req.param("slug"),
					c.req.valid("json"),
				),
			}),
	)
	.get("/:project/integrations/:slug", async (c) => {
		const row = await getIntegrationBySlug(
			c.get("project").id,
			c.req.param("slug"),
		)
		return c.json({ integration: getIntegrationView(row) })
	})
	.patch(
		"/:project/integrations/:slug",
		validate("json", updateIntegrationBody),
		async (c) => {
			const row = await updateIntegration(
				c.get("project"),
				c.req.param("slug"),
				c.req.valid("json"),
			)
			return c.json({ integration: getIntegrationView(row) })
		},
	)
	.delete(
		"/:project/integrations/:slug",
		validate("query", forceQuery),
		async (c) => {
			const { force } = c.req.valid("query")
			const { deleted } = await deleteIntegration(
				c.get("project"),
				c.req.param("slug"),
				{ force },
			)
			return c.json({ ok: true, deleted })
		},
	)
