import { Hono } from "hono"
import { forceQuery, validate } from "../lib/validation"
import type { AppEnv } from "../types"
import {
	createProject,
	deleteProject,
	getProjectBySlug,
	listProjects,
	startProjectScan,
	updateProject,
} from "./projects"
import { createProjectBody, updateProjectBody } from "./schemas"

export const projectRoutes = new Hono<AppEnv>()
	.post("/", validate("json", createProjectBody), async (c) => {
		const body = c.req.valid("json")
		const project = await createProject(c.get("actor"), body)
		return c.json({ project }, 201)
	})
	.get("/", async (c) => {
		const projects = await listProjects(c.get("actor"))
		return c.json({ projects })
	})
	.get("/:project", async (c) => {
		const project = await getProjectBySlug(
			c.get("actor"),
			c.req.param("project"),
		)
		return c.json({ project })
	})
	.patch("/:project", validate("json", updateProjectBody), async (c) => {
		const body = c.req.valid("json")
		const project = await updateProject(
			c.get("actor"),
			c.req.param("project"),
			body,
		)
		return c.json({ project })
	})
	.delete("/:project", validate("query", forceQuery), async (c) => {
		const { force } = c.req.valid("query")
		await deleteProject(c.get("actor"), c.req.param("project"), { force })
		return c.json({ ok: true })
	})
	.post("/:project/scan", async (c) => {
		const result = await startProjectScan(c.get("actor"), c.get("project"))
		return c.json(result, 202)
	})
