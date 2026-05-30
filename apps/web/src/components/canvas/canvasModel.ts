import {
	itemPhase,
	itemPosition,
	itemSlug,
} from "@/components/project-canvas/changeSetCanvas"
import type { CanvasChangeSetItem } from "@/components/project-canvas/changeSetRuntime"
import type { DisplayByTypeKey } from "@/components/project-canvas/nodeFootprint"
import {
	applyRelationshipProjection,
	type ProjectedRelationship,
} from "@/components/project-canvas/relationshipProjection"
import type {
	CanvasResourceStatus,
	ResourceLike,
	StagedResourceUpdate,
} from "@/components/project-canvas/resourceProjection"
import {
	type CanvasEdge,
	getResourceReferences,
	getResourceRelationships,
	type RelationshipRule,
} from "@/components/project-canvas/resourceRelationships"
import {
	type ChangeSet,
	type ChangeSetItem,
	changesRecord,
} from "@/lib/changeSetReactQuery"
import type { ProjectOpenOperation } from "@/lib/projectReactQuery"
import { nextStagedResourcePosition } from "@/routes/_app/projects/$projectSlug/architecture/-canvasPlacement"

export type CanvasDraftChangeSet = {
	id: string
	itemIds: Set<string>
}

export type CanvasModelInput = {
	appliedResources: ResourceLike[]
	draft: ChangeSet | null
	applying: ChangeSet[]
	openOperations: ProjectOpenOperation[]
	rulesByTypeKey: Map<string, RelationshipRule[]>
	displayByTypeKey: DisplayByTypeKey
}

export type CanvasModelChangeSetItem = CanvasChangeSetItem<
	ProjectOpenOperation,
	ResourceLike
>

export type CanvasModel = {
	resources: ResourceLike[]
	// Applied resources with staged-fallback positions overlaid, no projection
	// applied and no staged ghosts mixed in. Surfaced for sibling UI (search,
	// detail sheet) that doesn't care about the canvas's collapsed view.
	appliedResources: ResourceLike[]
	resourceEdges: CanvasEdge[]
	stagedUpdatesBySlug: Map<string, StagedResourceUpdate>
	draftChangeSet: CanvasDraftChangeSet | null
	activeItems: CanvasModelChangeSetItem[]
	hiddenRelationshipSlugs: Set<string>
	collapsedRelationships: ProjectedRelationship[]
	consumedDisplayEdgeIds: Set<string>
	displayByTypeKey: DisplayByTypeKey
}

function recordValue(value: unknown): Record<string, unknown> | null {
	if (!value || typeof value !== "object" || Array.isArray(value)) return null
	return Object.fromEntries(Object.entries(value))
}

function decorateChangeSetItem(
	item: ChangeSetItem,
	operation: ProjectOpenOperation | null,
	resourcesBySlug: Map<string, ResourceLike>,
): CanvasModelChangeSetItem {
	const slug = itemSlug(item)
	const resource = slug ? (resourcesBySlug.get(slug) ?? null) : null
	return {
		...item,
		runtime: {
			operation,
			resource,
			phase: itemPhase(item, operation),
			position: itemPosition(item),
		},
	}
}

// Applying items come first so a draft edit to the same slug wins downstream
// (slug-last-wins), reflecting the user's latest intent while the previous
// apply is still draining.
function deriveActiveItems(input: CanvasModelInput): {
	draftChangeSet: CanvasDraftChangeSet | null
	items: CanvasModelChangeSetItem[]
} {
	const opsByItemId = new Map<string, ProjectOpenOperation>()
	for (const op of input.openOperations) {
		if (op.closedAt || !op.changeSetItemId) continue
		opsByItemId.set(op.changeSetItemId, op)
	}
	const resourcesBySlug = new Map(
		input.appliedResources.map((resource) => [resource.slug, resource]),
	)
	const decorate = (item: ChangeSetItem) =>
		decorateChangeSetItem(
			item,
			opsByItemId.get(item.id) ?? null,
			resourcesBySlug,
		)
	const applyingItems = input.applying.flatMap((cs) => cs.items.map(decorate))
	const draftItems = (input.draft?.items ?? []).map(decorate)
	const draftChangeSet: CanvasDraftChangeSet | null = input.draft
		? {
				id: input.draft.id,
				itemIds: new Set(draftItems.map((item) => item.id)),
			}
		: null
	return { draftChangeSet, items: [...applyingItems, ...draftItems] }
}

// Overlay staged updates onto applied rows and synthesize ghost rows for
// staged creates/imports that have no backend row yet. Returns the merged
// resource list plus the per-slug staged update bookkeeping the canvas needs
// to render in-flight chrome.
function buildDraftGraph(input: {
	resources: ResourceLike[]
	items: CanvasModelChangeSetItem[]
}): {
	resources: ResourceLike[]
	stagedUpdatesBySlug: Map<string, StagedResourceUpdate>
} {
	const stagedUpdatesBySlug = new Map<string, StagedResourceUpdate>()
	const deletedSlugs = new Set<string>()
	const baseResourcesBySlug = new Map(
		input.resources.map((resource) => [resource.slug, resource]),
	)

	for (const item of input.items) {
		if (item.kind === "delete_resource" && item.targetResourceSlug) {
			deletedSlugs.add(item.targetResourceSlug)
			stagedUpdatesBySlug.set(item.targetResourceSlug, { item })
			continue
		}
		if (item.kind !== "update_resource" || !item.targetResourceSlug) continue
		if (deletedSlugs.has(item.targetResourceSlug)) continue

		const after = changesRecord(item)
		const inputs = recordValue(after.inputs)
		const position = itemPosition(item)
		if (!inputs && !position) continue

		stagedUpdatesBySlug.set(item.targetResourceSlug, {
			item,
			...(inputs ? { inputs } : {}),
			...(position ? { position } : {}),
		})
	}

	const resources = input.resources.map((resource): ResourceLike => {
		const update = stagedUpdatesBySlug.get(resource.slug)
		if (!update) return resource
		const nextInputs =
			update.inputs !== undefined ? update.inputs : resource.inputs
		return {
			...resource,
			...(update.inputs !== undefined ? { inputs: update.inputs } : {}),
			...(update.position !== undefined ? { position: update.position } : {}),
			references: deletedSlugs.has(resource.slug)
				? resource.references
				: getResourceReferences(nextInputs),
		}
	})

	const previewItems = input.items.filter(
		(item) =>
			item.kind === "create_resource" || item.kind === "import_resource",
	)
	previewItems.forEach((item, index) => {
		const after = changesRecord(item)
		const slug = after.slug
		if (typeof slug !== "string" || slug.length === 0) return
		if (deletedSlugs.has(slug)) return
		if (baseResourcesBySlug.has(slug)) return

		const type =
			typeof after.type === "string" ? after.type : (item.resourceType ?? "")
		const providerSeparator = type.indexOf("_")
		const displayName =
			typeof after.displayName === "string" ? after.displayName.trim() : ""
		const inputs = recordValue(after.inputs)
		resources.push({
			id: `staged:${item.id}`,
			slug,
			type: type || "resource",
			provider: providerSeparator > 0 ? type.slice(0, providerSeparator) : null,
			status: "staged" satisfies CanvasResourceStatus,
			inputs,
			references: getResourceReferences(inputs),
			...(displayName ? { metadata: { displayName } } : {}),
			position:
				itemPosition(item) ??
				nextStagedResourcePosition({
					resources: input.resources,
					previewIndex: index,
				}),
			size: null,
			stagedItem: item,
		})
	})

	return { resources, stagedUpdatesBySlug }
}

export function canvasModel(input: CanvasModelInput): CanvasModel {
	const { draftChangeSet, items } = deriveActiveItems(input)
	// Applied resources keep their persisted position. When missing, fall back
	// to the in-flight create/import's staged position so a newly created node
	// lands where the user dropped it rather than at (0,0) during the brief
	// window before its own layout row arrives.
	const positionedResources = input.appliedResources
		.map((resource) => {
			if (resource.position) return resource
			const stagedItem = items.find(
				(item) =>
					(item.kind === "create_resource" ||
						item.kind === "import_resource") &&
					itemSlug(item) === resource.slug &&
					item.runtime.operation !== null &&
					item.runtime.phase !== "failed" &&
					item.runtime.phase !== "canceled",
			)
			const position = stagedItem?.runtime.position ?? null
			return position ? { ...resource, position } : resource
		})
		.sort((left, right) => left.slug.localeCompare(right.slug))
	const draftGraph = buildDraftGraph({
		resources: positionedResources,
		items,
	})
	const resourceEdges = getResourceRelationships(
		draftGraph.resources,
		input.rulesByTypeKey,
	)
	const projection = applyRelationshipProjection(
		draftGraph.resources,
		resourceEdges,
		input.displayByTypeKey,
	)
	return {
		resources: projection.resources,
		appliedResources: positionedResources,
		resourceEdges,
		stagedUpdatesBySlug: draftGraph.stagedUpdatesBySlug,
		draftChangeSet,
		activeItems: items,
		hiddenRelationshipSlugs: projection.hiddenSlugs,
		collapsedRelationships: projection.collapsedRelationships,
		consumedDisplayEdgeIds: projection.consumedDisplayEdgeIds,
		displayByTypeKey: input.displayByTypeKey,
	}
}
