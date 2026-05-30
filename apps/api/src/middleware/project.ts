import { InvalidInput, ProjectNotFound } from "@opsy/contracts/errors"
import { and, eq, isNull } from "drizzle-orm"
import { createMiddleware } from "hono/factory"
import { db } from "../lib/db/client"
import { projects } from "../lib/db/schema"
import type { AppEnv } from "../types"

/**
 * Resolve the `:project` path param (slug) to a `Project` row, scoped to the
 * actor's org. Attaches the row to `c.var.project` for downstream handlers.
 * 404s if the slug doesn't match a project in the actor's org.
 *
 * Must run after `requireActor()`.
 */
export const requireProject = () =>
	createMiddleware<AppEnv>(async (c, next) => {
		const slug = c.req.param("project")
		if (!slug) throw new InvalidInput({ detail: "project required" })
		const actor = c.get("actor")
		const project = await db.query.projects.findFirst({
			where: and(
				eq(projects.slug, slug),
				eq(projects.orgId, actor.orgId),
				isNull(projects.deletedAt),
			),
		})
		if (!project) throw new ProjectNotFound({ slug })
		c.set("project", project)
		await next()
	})
