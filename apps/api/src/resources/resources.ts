import {
	ResourceDuplicateSlug,
	ResourceNotFound,
	ResourceReservedSlug,
} from "@opsy/contracts/errors"
import { and, arrayContains, eq, isNull } from "drizzle-orm"
import { start } from "workflow/api"
import {
	getIntegrationById,
	getIntegrationByResourceType,
} from "../integrations"
import { db } from "../lib/db/client"
import {
	changeSetItems,
	type Operation,
	type Project,
	type Resource,
	type ResourceLayout,
	resourceLayouts,
	resources,
} from "../lib/db/schema"
import { extractRefs } from "../lib/refs/ast"
import { RefError } from "../lib/refs/errors"
import * as operations from "../operations"
import type { Actor } from "../types"
import {
	getResourceReferences,
	getValueWithResourceRefs,
	type ResourceReference,
} from "./references"
import {
	type BulkResourceLayoutBody,
	type CreateProviderResourceBody,
	type CreateResourceBody,
	type DeleteResourceRequest,
	type ImportResourceBody,
	type LookupBody,
	type ReadResourceRequest,
	type ResourceLayoutBody,
	resourceState,
	type UpdateResourceBody,
} from "./schemas"
import {
	createResourceWorkflow,
	deleteResourceWorkflow,
	forgetResourceWorkflow,
	importResourceWorkflow,
	lookupDataWorkflow,
	readResourceWorkflow,
	updateResourceWorkflow,
} from "./workflows"
import {
	assertImportTargetExists,
	planResource,
	type ResourcePlan,
} from "./workflows/steps"

type ResourceLayoutFields = Pick<
	ResourceLayout,
	"position" | "size" | "collapsed"
>

export type ResourceView = Resource & {
	position: { x: number; y: number } | null
	size: { w: number; h: number } | null
	collapsed: boolean
	references: ResourceReference[]
	inlinedInputs?: unknown
}

export async function getResourceBySlug(
	projectId: string,
	slug: string,
): Promise<Resource | null> {
	return (
		(await db.query.resources.findFirst({
			where: and(
				eq(resources.projectId, projectId),
				eq(resources.slug, slug),
				isNull(resources.deletedAt),
			),
		})) ?? null
	)
}

export async function getResourceByChangeSetItem(
	projectId: string,
	changeSetItemId: string,
): Promise<Resource | null> {
	const rows = await db
		.select({ resource: resources })
		.from(changeSetItems)
		.innerJoin(resources, eq(resources.id, changeSetItems.targetResourceId))
		.where(
			and(
				eq(changeSetItems.id, changeSetItemId),
				eq(resources.projectId, projectId),
				isNull(resources.deletedAt),
			),
		)
		.limit(1)
	return rows[0]?.resource ?? null
}

async function getResourceLayoutsByProject(
	projectId: string,
): Promise<Map<string, ResourceLayoutFields>> {
	const rows = await db
		.select({
			resourceId: resourceLayouts.resourceId,
			position: resourceLayouts.position,
			size: resourceLayouts.size,
			collapsed: resourceLayouts.collapsed,
		})
		.from(resourceLayouts)
		.innerJoin(resources, eq(resourceLayouts.resourceId, resources.id))
		.where(
			and(eq(resources.projectId, projectId), isNull(resourceLayouts.viewId)),
		)

	return new Map(
		rows.map((row) => [
			row.resourceId,
			{
				position: row.position ?? null,
				size: row.size ?? null,
				collapsed: row.collapsed,
			},
		]),
	)
}

function getResourceView(
	resource: Resource,
	layout: ResourceLayoutFields | undefined,
	options: { inlinedInputs?: unknown } = {},
): ResourceView {
	return {
		...resource,
		position: layout?.position ?? null,
		size: layout?.size ?? null,
		collapsed: layout?.collapsed ?? false,
		references: getResourceReferences(resource.inputs),
		...(options.inlinedInputs !== undefined
			? { inlinedInputs: options.inlinedInputs }
			: {}),
	}
}

// Build a single ResourceView for SSE projection. The published Resource row
// is enriched with its layout (one extra row lookup) so subscribers receive
// the same shape the REST list endpoint returns and the canvas cache can
// replace the entry without losing derived fields.
export async function buildResourceView(
	resource: Resource,
): Promise<ResourceView> {
	const layout = await db.query.resourceLayouts.findFirst({
		where: and(
			eq(resourceLayouts.resourceId, resource.id),
			isNull(resourceLayouts.viewId),
		),
		columns: { position: true, size: true, collapsed: true },
	})
	return getResourceView(resource, layout ?? undefined)
}

export async function getResourceViewBySlug(
	_actor: Actor,
	project: Project,
	slug: string,
): Promise<ResourceView | null> {
	const layoutMapPromise = getResourceLayoutsByProject(project.id)
	const resource = await getResourceBySlug(project.id, slug)
	if (!resource) return null

	const [layoutMap, inlinedInputs] = await Promise.all([
		layoutMapPromise,
		getValueWithResourceRefs(resource.inputs, project.id),
	])

	return getResourceView(resource, layoutMap.get(resource.id), {
		...(inlinedInputs !== resource.inputs ? { inlinedInputs } : {}),
	})
}

export async function getResourcesByProject(
	_actor: Actor,
	project: Project,
): Promise<ResourceView[]> {
	const [rows, layoutMap] = await Promise.all([
		db.query.resources.findMany({
			where: and(
				eq(resources.projectId, project.id),
				isNull(resources.deletedAt),
			),
			orderBy: (table, { asc }) => [asc(table.slug)],
		}),
		getResourceLayoutsByProject(project.id),
	])
	return rows.map((resource) =>
		getResourceView(resource, layoutMap.get(resource.id)),
	)
}

export async function planCreateResource(
	project: Project,
	body: CreateProviderResourceBody,
): Promise<ResourcePlan> {
	const integration = await getIntegrationByResourceType(
		project.id,
		body.type,
		body.integrationSlug,
	)
	const config =
		body.inputs == null
			? null
			: resourceState.parse(
					await getValueWithResourceRefs(body.inputs, project.id),
				)
	return planResource(integration, body.type, null, config, "create")
}

export async function planUpdateResource(
	project: Project,
	resource: Resource,
	body: UpdateResourceBody,
): Promise<ResourcePlan> {
	if (!resource.integrationId) {
		throw new Error(`resource ${resource.slug} cannot be planned: no provider`)
	}
	const integration = await getIntegrationById(
		project.id,
		resource.integrationId,
	)
	const config =
		body.inputs == null
			? null
			: resourceState.parse(
					await getValueWithResourceRefs(body.inputs, project.id),
				)
	return planResource(
		integration,
		resource.type,
		resource.identity,
		config,
		"update",
	)
}

export async function planDeleteResource(
	project: Project,
	resource: Resource,
): Promise<ResourcePlan> {
	if (
		!resource.integrationId ||
		!resource.identity ||
		resource.status === "missing"
	) {
		return {
			priorState: null,
			plannedState: null,
			plannedPrivate: null,
			requiresReplace: [],
		}
	}
	const integration = await getIntegrationById(
		project.id,
		resource.integrationId,
	)
	return planResource(
		integration,
		resource.type,
		resource.identity,
		null,
		"delete",
	)
}

export async function createResource(
	actor: Actor,
	project: Project,
	body: CreateResourceBody,
): Promise<{ operation: Operation<CreateResourceBody> }> {
	if (body.slug === "data") throw new ResourceReservedSlug()
	if (await getResourceBySlug(project.id, body.slug)) {
		throw new ResourceDuplicateSlug({
			slug: body.slug,
			projectSlug: project.slug,
		})
	}

	const isProvider = body.type !== undefined
	if (isProvider) {
		const refs = extractRefs(body.inputs)
		if (refs.includes(body.slug)) {
			throw new RefError(
				"ref_cycle",
				body.slug,
				`resource "${body.slug}" cannot reference itself`,
			)
		}
	}

	const integration = isProvider
		? await getIntegrationByResourceType(
				project.id,
				body.type as string,
				body.integrationSlug,
			)
		: null
	const refs = isProvider ? extractRefs(body.inputs) : []

	const { operation } = await operations.createResourceWithOperation({
		actor,
		projectId: project.id,
		kind: "create",
		request: body,
		resource: {
			slug: body.slug,
			type: isProvider ? (body.type as string) : "resource",
			status: "creating",
			inputs: isProvider ? (body.inputs ?? null) : null,
			provider: integration?.provider ?? null,
			integrationId: integration?.id ?? null,
			dependsOn: refs.length > 0 ? refs : null,
			metadata: body.displayName ? { displayName: body.displayName } : {},
			position: body.position ?? null,
		},
	})
	const run = await start(createResourceWorkflow, [operation])
	return {
		operation: await operations.attachOperationWorkflowRun(operation, run.runId),
	}
}

export async function updateResource(
	actor: Actor,
	project: Project,
	resource: Resource,
	body: UpdateResourceBody,
): Promise<{ operation: Operation<UpdateResourceBody> }> {
	const refs = extractRefs(body.inputs)
	if (refs.includes(resource.slug)) {
		throw new RefError(
			"ref_cycle",
			resource.slug,
			`resource "${resource.slug}" cannot reference itself`,
		)
	}

	const operation = await operations.createOperation({
		actor,
		projectId: project.id,
		resourceId: resource.id,
		kind: "update",
		lockKey: `resource:${resource.id}`,
		request: body,
	})
	const run = await start(updateResourceWorkflow, [operation])
	return {
		operation: await operations.attachOperationWorkflowRun(operation, run.runId),
	}
}

export async function importResource(
	actor: Actor,
	project: Project,
	body: ImportResourceBody,
): Promise<{ operation: Operation<ImportResourceBody> }> {
	if (body.slug === "data") throw new ResourceReservedSlug()
	if (await getResourceBySlug(project.id, body.slug)) {
		throw new ResourceDuplicateSlug({
			slug: body.slug,
			projectSlug: project.slug,
		})
	}

	const integration = await getIntegrationByResourceType(
		project.id,
		body.type,
		body.integrationSlug,
	)
	// Validate the target exists before persisting anything. A not-found import
	// (no provider state) must reject the request here rather than create a stub
	// the workflow would later mark "live" with null state or tombstone.
	await assertImportTargetExists(
		integration,
		body.type,
		body.identity ?? null,
		body.providerId ?? null,
	)
	const { operation } = await operations.createResourceWithOperation({
		actor,
		projectId: project.id,
		kind: "import",
		request: body,
		resource: {
			slug: body.slug,
			type: body.type,
			status: "importing",
			inputs: null,
			provider: integration.provider,
			integrationId: integration.id,
			metadata: {},
			position: body.position ?? null,
		},
	})
	const run = await start(importResourceWorkflow, [operation])
	return {
		operation: await operations.attachOperationWorkflowRun(operation, run.runId),
	}
}

export async function readResource(
	actor: Actor,
	project: Project,
	resource: Resource,
): Promise<{ operation: Operation<ReadResourceRequest> }> {
	const request: ReadResourceRequest = { slug: resource.slug }
	const operation = await operations.createOperation({
		actor,
		projectId: project.id,
		resourceId: resource.id,
		kind: "read",
		request,
	})
	const run = await start(readResourceWorkflow, [operation])
	return {
		operation: await operations.attachOperationWorkflowRun(operation, run.runId),
	}
}

export async function lookupData(
	actor: Actor,
	project: Project,
	body: LookupBody,
): Promise<{ operation: Operation<LookupBody> }> {
	const operation = await operations.createOperation({
		actor,
		projectId: project.id,
		kind: "lookup",
		request: body,
	})
	const run = await start(lookupDataWorkflow, [operation])
	return {
		operation: await operations.attachOperationWorkflowRun(operation, run.runId),
	}
}

export async function deleteResource(
	actor: Actor,
	project: Project,
	resource: Resource,
): Promise<{ operation: Operation<DeleteResourceRequest> }> {
	const request: DeleteResourceRequest = { slug: resource.slug, mode: "delete" }
	const operation = await operations.createOperation({
		actor,
		projectId: project.id,
		resourceId: resource.id,
		kind: "delete",
		lockKey: `resource:${resource.id}`,
		request,
	})
	const run = await start(deleteResourceWorkflow, [operation])
	return {
		operation: await operations.attachOperationWorkflowRun(operation, run.runId),
	}
}

export async function forgetResource(
	actor: Actor,
	project: Project,
	resource: Resource,
): Promise<{ operation: Operation<DeleteResourceRequest> }> {
	const dependents = await db
		.select({ slug: resources.slug })
		.from(resources)
		.where(
			and(
				eq(resources.projectId, project.id),
				isNull(resources.deletedAt),
				arrayContains(resources.dependsOn, [resource.slug]),
			),
		)
	if (dependents.length > 0) {
		throw new RefError(
			"ref_target_in_use",
			resource.slug,
			`cannot forget ${resource.slug}: [${dependents.map((d) => d.slug).join(", ")}] reference it; forget those first`,
		)
	}
	const request: DeleteResourceRequest = { slug: resource.slug, mode: "forget" }
	const operation = await operations.createOperation({
		actor,
		projectId: project.id,
		resourceId: resource.id,
		kind: "delete",
		lockKey: `resource:${resource.id}`,
		request,
	})
	const run = await start(forgetResourceWorkflow, [operation])
	return {
		operation: await operations.attachOperationWorkflowRun(operation, run.runId),
	}
}

export async function createOrUpdateResourceLayout(
	actor: Actor,
	project: Project,
	slug: string,
	body: ResourceLayoutBody,
): Promise<ResourceView> {
	const resource = await getResourceBySlug(project.id, slug)
	if (!resource) throw new ResourceNotFound({ slug, projectSlug: project.slug })
	const patch = {
		...(body.position !== undefined ? { position: body.position } : {}),
		...(body.size !== undefined ? { size: body.size } : {}),
		...(body.collapsed !== undefined ? { collapsed: body.collapsed } : {}),
	}

	const [layout] = await db
		.select({ id: resourceLayouts.id })
		.from(resourceLayouts)
		.where(
			and(
				eq(resourceLayouts.resourceId, resource.id),
				isNull(resourceLayouts.viewId),
			),
		)
		.limit(1)
	if (layout) {
		if (Object.keys(patch).length > 0) {
			const [updatedLayout] = await db
				.update(resourceLayouts)
				.set(patch)
				.where(eq(resourceLayouts.id, layout.id))
				.returning({ id: resourceLayouts.id })
			if (!updatedLayout) {
				throw new Error(`failed to update layout for resource ${resource.id}`)
			}
		}
	} else {
		const [createdLayout] = await db
			.insert(resourceLayouts)
			.values({
				resourceId: resource.id,
				viewId: null,
				...patch,
			})
			.returning({ id: resourceLayouts.id })
		if (!createdLayout) {
			throw new Error(`failed to create layout for resource ${resource.id}`)
		}
	}
	const view = await getResourceViewBySlug(actor, project, slug)
	if (!view) throw new ResourceNotFound({ slug, projectSlug: project.slug })
	return view
}

export async function createOrUpdateResourceLayouts(
	_actor: Actor,
	project: Project,
	body: BulkResourceLayoutBody,
): Promise<{ updated: number }> {
	if (body.layouts.length === 0) return { updated: 0 }
	let updated = 0
	await db.transaction(async (tx) => {
		for (const entry of body.layouts) {
			const resource = await tx.query.resources.findFirst({
				where: and(
					eq(resources.projectId, project.id),
					eq(resources.slug, entry.slug),
					isNull(resources.deletedAt),
				),
				columns: { id: true },
			})
			if (!resource) continue

			const patch = {
				...(entry.position !== undefined ? { position: entry.position } : {}),
				...(entry.size !== undefined ? { size: entry.size } : {}),
				...(entry.collapsed !== undefined
					? { collapsed: entry.collapsed }
					: {}),
			}

			const [layout] = await tx
				.select({ id: resourceLayouts.id })
				.from(resourceLayouts)
				.where(
					and(
						eq(resourceLayouts.resourceId, resource.id),
						isNull(resourceLayouts.viewId),
					),
				)
				.limit(1)
			if (layout) {
				if (Object.keys(patch).length === 0) continue
				const result = await tx
					.update(resourceLayouts)
					.set(patch)
					.where(eq(resourceLayouts.id, layout.id))
					.returning({ id: resourceLayouts.id })
				updated += result.length
				continue
			}

			const result = await tx
				.insert(resourceLayouts)
				.values({
					resourceId: resource.id,
					viewId: null,
					...patch,
				})
				.returning({ id: resourceLayouts.id })
			updated += result.length
		}
	})
	return { updated }
}
