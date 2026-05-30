import {
	ResourceNotFound,
	ResourceProviderTargetNoIdentity,
} from "@opsy/contracts/errors"
import { Hono } from "hono"
import { validate } from "../lib/validation"
import type { AppEnv } from "../types"
import { getResourceDryRunAction } from "./dry-run"
import * as resources from "./resources"
import {
	bulkResourceLayoutBody,
	createResourceBody,
	importResourceBody,
	lookupBody,
	resourceLayoutBody,
	updateResourceBody,
} from "./schemas"

export const resourceRoutes = new Hono<AppEnv>()
	.post(
		"/:project/resources",
		validate("json", createResourceBody),
		async (c) => {
			const result = await resources.createResource(
				c.get("actor"),
				c.get("project"),
				c.req.valid("json"),
			)
			return c.json(result, 201)
		},
	)
	.post(
		"/:project/resources/dry-run",
		validate("json", createResourceBody),
		async (c) => {
			const body = c.req.valid("json")
			if (body.type === undefined) {
				return c.json({
					dryRun: {
						action: getResourceDryRunAction(null, null, [], "create_resource"),
						priorState: null,
						plannedState: null,
						requiresReplace: [],
					},
				})
			}
			const plan = await resources.planCreateResource(c.get("project"), body)
			return c.json({
				dryRun: {
					action: getResourceDryRunAction(
						plan.priorState,
						plan.plannedState,
						plan.requiresReplace,
						"create_resource",
					),
					priorState: plan.priorState,
					plannedState: plan.plannedState,
					requiresReplace: plan.requiresReplace,
				},
			})
		},
	)
	.post(
		"/:project/resources/import",
		validate("json", importResourceBody),
		async (c) => {
			const body = c.req.valid("json")
			const result = await resources.importResource(
				c.get("actor"),
				c.get("project"),
				body,
			)
			return c.json(result, 201)
		},
	)
	.post("/:project/resources/:slug/forget", async (c) => {
		const project = c.get("project")
		const resource = await resources.getResourceBySlug(
			project.id,
			c.req.param("slug"),
		)
		if (!resource) {
			throw new ResourceNotFound({
				slug: c.req.param("slug"),
				projectSlug: project.slug,
			})
		}
		const result = await resources.forgetResource(
			c.get("actor"),
			project,
			resource,
		)
		return c.json(result)
	})
	.post("/:project/resources/:slug/read", async (c) => {
		const project = c.get("project")
		const resource = await resources.getResourceBySlug(
			project.id,
			c.req.param("slug"),
		)
		if (!resource) {
			throw new ResourceNotFound({
				slug: c.req.param("slug"),
				projectSlug: project.slug,
			})
		}
		if (!resource.identity) {
			throw new ResourceProviderTargetNoIdentity({
				kind: "read",
				slug: resource.slug,
			})
		}
		const result = await resources.readResource(
			c.get("actor"),
			project,
			resource,
		)
		return c.json(result)
	})
	.post(
		"/:project/resources/:slug/dry-run/update",
		validate("json", updateResourceBody),
		async (c) => {
			const project = c.get("project")
			const resource = await resources.getResourceBySlug(
				project.id,
				c.req.param("slug"),
			)
			if (!resource) {
				throw new ResourceNotFound({
					slug: c.req.param("slug"),
					projectSlug: project.slug,
				})
			}
			const plan = await resources.planUpdateResource(
				project,
				resource,
				c.req.valid("json"),
			)
			return c.json({
				dryRun: {
					action: getResourceDryRunAction(
						plan.priorState,
						plan.plannedState,
						plan.requiresReplace,
						"update_resource",
					),
					priorState: plan.priorState,
					plannedState: plan.plannedState,
					requiresReplace: plan.requiresReplace,
				},
			})
		},
	)
	.post("/:project/resources/:slug/dry-run/delete", async (c) => {
		const project = c.get("project")
		const resource = await resources.getResourceBySlug(
			project.id,
			c.req.param("slug"),
		)
		if (!resource) {
			throw new ResourceNotFound({
				slug: c.req.param("slug"),
				projectSlug: project.slug,
			})
		}
		const plan = await resources.planDeleteResource(project, resource)
		return c.json({
			dryRun: {
				action: getResourceDryRunAction(
					plan.priorState,
					plan.plannedState,
					plan.requiresReplace,
					"delete_resource",
				),
				priorState: plan.priorState,
				plannedState: plan.plannedState,
				requiresReplace: plan.requiresReplace,
			},
		})
	})
	.patch(
		"/:project/resources/layout",
		validate("json", bulkResourceLayoutBody),
		async (c) => {
			const body = c.req.valid("json")
			const result = await resources.createOrUpdateResourceLayouts(
				c.get("actor"),
				c.get("project"),
				body,
			)
			return c.json(result)
		},
	)
	.patch(
		"/:project/resources/:slug/layout",
		validate("json", resourceLayoutBody),
		async (c) => {
			const body = c.req.valid("json")
			const result = await resources.createOrUpdateResourceLayout(
				c.get("actor"),
				c.get("project"),
				c.req.param("slug"),
				body,
			)
			return c.json(result)
		},
	)
	.patch(
		"/:project/resources/:slug",
		validate("json", updateResourceBody),
		async (c) => {
			const body = c.req.valid("json")
			const project = c.get("project")
			const resource = await resources.getResourceBySlug(
				project.id,
				c.req.param("slug"),
			)
			if (!resource) {
				throw new ResourceNotFound({
					slug: c.req.param("slug"),
					projectSlug: project.slug,
				})
			}
			const result = await resources.updateResource(
				c.get("actor"),
				project,
				resource,
				body,
			)
			return c.json(result)
		},
	)
	.delete("/:project/resources/:slug", async (c) => {
		const project = c.get("project")
		const resource = await resources.getResourceBySlug(
			project.id,
			c.req.param("slug"),
		)
		if (!resource) {
			throw new ResourceNotFound({
				slug: c.req.param("slug"),
				projectSlug: project.slug,
			})
		}
		const managed = !!(
			resource.provider &&
			resource.identity &&
			resource.status !== "missing"
		)
		const result = managed
			? await resources.deleteResource(c.get("actor"), project, resource)
			: await resources.forgetResource(c.get("actor"), project, resource)
		return c.json(result)
	})
	.get("/:project/resources", async (c) => {
		const result = await resources.getResourcesByProject(
			c.get("actor"),
			c.get("project"),
		)
		return c.json({ resources: result })
	})
	.get("/:project/resources/:slug", async (c) => {
		const result = await resources.getResourceViewBySlug(
			c.get("actor"),
			c.get("project"),
			c.req.param("slug"),
		)
		if (!result) {
			throw new ResourceNotFound({
				slug: c.req.param("slug"),
				projectSlug: c.get("project").slug,
			})
		}
		return c.json(result)
	})
	.post("/:project/data/query", validate("json", lookupBody), async (c) => {
		const body = c.req.valid("json")
		const result = await resources.lookupData(
			c.get("actor"),
			c.get("project"),
			body,
		)
		return c.json(result)
	})
