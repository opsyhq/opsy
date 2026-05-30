import type { Node } from "@xyflow/react"
import {
	type ChangeSetItemRuntimePhase,
	hasChangeSetItemRuntime,
	isRunningPhase,
} from "@/components/project-canvas/changeSetRuntime"
import { changesRecord } from "@/lib/changeSetReactQuery"
import type { LayoutNodeSpec, LayoutResult } from "./layout/layoutTypes"
import {
	BOTTOM_TUCKED_CHIP_HEIGHT,
	BOTTOM_TUCKED_CHIP_STRIDE,
	computeNodeFootprint,
	type DisplayByTypeKey,
	flattenBottomTuckedItems,
	maxSize,
	resourceDisplay,
} from "./nodeFootprint"
import type { ResourceNodeData } from "./nodes/ResourceNode"
import { customNodes } from "./nodes/registry.generated"
import type { ResourceLike, StagedResourceUpdate } from "./resourceProjection"

type CanvasSize = NonNullable<ResourceLike["size"]>

function itemRuntimePhase(
	item: StagedResourceUpdate["item"],
): ChangeSetItemRuntimePhase | null {
	return hasChangeSetItemRuntime(item) ? item.runtime.phase : null
}

function stagedActionLabel(update: StagedResourceUpdate): string {
	const phase = itemRuntimePhase(update.item)
	if (update.item.kind === "delete_resource") {
		if (phase === "pending") return "Delete pending"
		if (phase === "deleting") return "Deleting"
		if (phase === "done") return "Deleted"
		if (phase === "failed") return "Delete failed"
		if (phase === "canceled") return "Delete canceled"
		const changes = changesRecord(update.item)
		return changes.mode === "forget" ? "Forget staged" : "Delete staged"
	}
	if (update.item.kind === "import_resource") {
		if (phase === "pending") return "Import pending"
		if (phase === "importing") return "Importing"
		if (phase === "done") return "Imported"
		if (phase === "failed") return "Import failed"
		if (phase === "canceled") return "Import canceled"
		return "Import staged"
	}
	if (update.item.kind === "create_resource") {
		if (phase === "pending") return "Create pending"
		if (phase === "creating") return "Creating"
		if (phase === "done") return "Created"
		if (phase === "failed") return "Create failed"
		if (phase === "canceled") return "Create canceled"
		return "Create staged"
	}
	if (phase === "pending") return "Update pending"
	if (phase === "updating") return "Updating"
	if (phase === "done") return "Updated"
	if (phase === "failed") return "Update failed"
	if (phase === "canceled") return "Update canceled"
	return "Update staged"
}

function measuredNodeSize(
	node: Node | undefined,
	fallback: CanvasSize,
): CanvasSize {
	const style = node?.style as { width?: unknown; height?: unknown } | undefined
	return {
		w:
			node?.measured?.width ??
			(typeof style?.width === "number" ? style.width : fallback.w),
		h:
			node?.measured?.height ??
			(typeof style?.height === "number" ? style.height : fallback.h),
	}
}

function nodeData(
	resource: ResourceLike,
	stagedUpdate: StagedResourceUpdate | undefined,
	options: { isContainer: boolean; displayByTypeKey: DisplayByTypeKey },
): ResourceNodeData {
	const inputs = Object.keys(resource.inputs ?? {}).map((key) => ({ key }))
	const footprint = computeNodeFootprint(resource, options)
	const metadata =
		resource.metadata &&
		typeof resource.metadata === "object" &&
		!Array.isArray(resource.metadata)
			? resource.metadata
			: null
	const displayName =
		typeof metadata?.displayName === "string" ? metadata.displayName.trim() : ""
	const data: ResourceNodeData = {
		slug: resource.slug,
		resourceLabel: displayName || resource.slug,
		type: resource.type,
		provider: resource.provider,
		status: resource.status,
		inputs,
		display: resourceDisplay(resource, options.displayByTypeKey),
	}
	if (resource.topEdgeItems?.length) {
		data.topEdgeItems = resource.topEdgeItems
	}
	data.layout = footprint.render
	const stagedItem = resource.stagedItem ?? stagedUpdate?.item ?? null
	// During apply, the card returns to default styling — the in-flight verb
	// comes from `resource.status`. Staged styling stays for pre-apply previews
	// and terminal error phases (failed/canceled) so users still see those.
	const stagedPhase = stagedItem ? itemRuntimePhase(stagedItem) : null
	const isInFlight =
		stagedPhase === "pending" ||
		stagedPhase === "done" ||
		(stagedPhase !== null && isRunningPhase(stagedPhase))
	if (stagedItem && !isInFlight) {
		data.staged = true
		data.stageItemId = stagedItem.id
		data.stageKind = stagedItem.kind
		data.stageAction = stagedActionLabel(stagedUpdate ?? { item: stagedItem })
		data.dryRunInitial = stagedItem.dryRun ?? null
	}
	return data
}

function resourceDepth(
	resource: ResourceLike,
	bySlug: Map<string, ResourceLike>,
): number {
	let depth = 0
	let hostSlug = resource.componentHostSlug ?? null
	let host = hostSlug ? bySlug.get(hostSlug) : undefined
	const seen = new Set<string>()
	while (host && !seen.has(host.slug)) {
		seen.add(host.slug)
		depth += 1
		hostSlug = host.componentHostSlug ?? null
		host = hostSlug ? bySlug.get(hostSlug) : undefined
	}
	return depth
}

function bottomTuckedRowsBySlug(resources: ResourceLike[]) {
	const rows = new Map<string, { hostSlug: string; rowIndex: number }>()
	for (const resource of resources) {
		const items = resource.bottomTuckedItems ?? []
		items.forEach((item, rowIndex) => {
			rows.set(item.slug, {
				hostSlug: resource.slug,
				rowIndex,
			})
		})
	}
	return rows
}

function bottomTuckedVisualZIndexBySlug(resources: ResourceLike[]) {
	const visualZBySlug = new Map<string, number>()
	const bySlug = new Map(resources.map((resource) => [resource.slug, resource]))
	for (const resource of resources) {
		if (resource.componentHostSlug) continue
		const rows = flattenBottomTuckedItems(resource.bottomTuckedItems)
		if (rows.length === 0) continue
		const baseZ = resourceDepth(resource, bySlug) * 10
		visualZBySlug.set(resource.slug, baseZ + rows.length)
		rows.forEach((item, index) => {
			visualZBySlug.set(item.slug, baseZ + rows.length - index - 1)
		})
	}
	return visualZBySlug
}

export function applyTuckedNodePositions(
	nodes: Node[],
	resources: ResourceLike[],
): Node[] {
	const rowsBySlug = bottomTuckedRowsBySlug(resources)
	const byId = new Map(nodes.map((node) => [node.id, node]))
	const visualZBySlug = bottomTuckedVisualZIndexBySlug(resources)
	if (rowsBySlug.size === 0 && visualZBySlug.size === 0) return nodes
	return nodes.map((node) => {
		const row = rowsBySlug.get(node.id)
		const visualZIndex = visualZBySlug.get(node.id)
		if (!row) {
			if (visualZIndex === undefined) return node
			return {
				...node,
				style: {
					...(node.style ?? {}),
					zIndex: visualZIndex,
				},
				zIndex: visualZIndex,
			}
		}
		const host = byId.get(row.hostSlug)
		if (!host) return node
		const hostData = host.data as unknown as ResourceNodeData
		const bodyHeight = hostData.layout?.bodyHeight ?? 0
		const topEdgeHeight = hostData.layout?.topEdgeHeight ?? 0
		const overlap = hostData.layout?.bottomTuckedOverlap ?? 0
		return {
			...node,
			draggable: false,
			position: {
				x: 0,
				y:
					topEdgeHeight +
					bodyHeight -
					overlap +
					row.rowIndex * BOTTOM_TUCKED_CHIP_STRIDE,
			},
			style: {
				...(node.style ?? {}),
				height: BOTTOM_TUCKED_CHIP_HEIGHT,
				...(visualZIndex === undefined ? {} : { zIndex: visualZIndex }),
			},
			...(visualZIndex === undefined ? {} : { zIndex: visualZIndex }),
		}
	})
}

export function toFlowNodes(input: {
	resources: ResourceLike[]
	stagedUpdatesBySlug: Map<string, StagedResourceUpdate>
	displayByTypeKey: DisplayByTypeKey
	previousNodes?: Node[]
}): Node[] {
	const bySlug = new Map(
		input.resources.map((resource) => [resource.slug, resource]),
	)
	const previousById = new Map(
		(input.previousNodes ?? []).map((node) => [node.id, node]),
	)
	const resources = input.resources
		.map((resource, order) => ({
			resource,
			order,
			depth: resourceDepth(resource, bySlug),
		}))
		.sort((a, b) => a.depth - b.depth || a.order - b.order)

	const nodes = resources.map(({ resource, depth }) => {
		const data = nodeData(
			resource,
			input.stagedUpdatesBySlug.get(resource.slug),
			{ isContainer: false, displayByTypeKey: input.displayByTypeKey },
		)
		const footprint = computeNodeFootprint(resource, {
			isContainer: false,
			displayByTypeKey: input.displayByTypeKey,
		})
		const minimumSize = footprint.layoutSize
		const baseSize = minimumSize
		const existing = previousById.get(resource.slug)
		const size = maxSize(measuredNodeSize(existing, baseSize), minimumSize)
		const node: Node = {
			id: resource.slug,
			type:
				!resource.componentHostSlug &&
				resource.type &&
				resource.type in customNodes
					? resource.type
					: "resource",
			position: resource.position ?? { x: 0, y: 0 },
			data: data as unknown as Record<string, unknown>,
			style: {
				width: size.w,
				height: size.h,
				pointerEvents: "none",
			},
			zIndex: depth * 10,
		}
		if (resource.componentHostSlug && bySlug.has(resource.componentHostSlug)) {
			node.parentId = resource.componentHostSlug
		}
		const stagedUpdate = input.stagedUpdatesBySlug.get(resource.slug)
		if (existing && !data.stageItemId && !stagedUpdate?.position) {
			node.position = existing.position
		}
		return node
	})
	return applyTuckedNodePositions(nodes, input.resources)
}

export function toLayoutSpecs(input: {
	resources: ResourceLike[]
	nodes: Node[]
	displayByTypeKey: DisplayByTypeKey
	force: boolean
}): LayoutNodeSpec[] {
	const nodesById = new Map(input.nodes.map((node) => [node.id, node]))
	return input.resources.flatMap((resource, order) => {
		if (resource.componentHostSlug) return []
		const footprint = computeNodeFootprint(resource, {
			isContainer: false,
			displayByTypeKey: input.displayByTypeKey,
		})
		const minimumSize = footprint.layoutSize
		const size = maxSize(
			measuredNodeSize(nodesById.get(resource.slug), minimumSize),
			minimumSize,
		)
		return {
			id: resource.slug,
			width: size.w,
			height: size.h,
			order,
			isContainer: false,
			layoutType: `${resource.type || "resource"}:leaf`,
			...(!input.force && resource.position
				? { position: resource.position }
				: {}),
		}
	})
}

export function persistableLayouts(input: {
	result: LayoutResult
	resources: ResourceLike[]
}): {
	layoutPositions: LayoutResult["positions"]
	layouts: Array<{
		slug: string
		position?: NonNullable<ResourceLike["position"]>
		size?: CanvasSize
	}>
} {
	const layoutPositions = input.result.positions
	const layoutSlugs = new Set([
		...Object.keys(layoutPositions),
		...Object.keys(input.result.sizes),
	])
	const virtualSlugs = new Set(
		input.resources
			.filter((resource) => resource.stagedItem || resource.componentHostSlug)
			.map((resource) => resource.slug),
	)
	const layouts = Array.from(layoutSlugs)
		.filter((slug) => !virtualSlugs.has(slug))
		.map((slug) => ({
			slug,
			...(layoutPositions[slug] ? { position: layoutPositions[slug] } : {}),
			...(input.result.sizes[slug] ? { size: input.result.sizes[slug] } : {}),
		}))
	return { layoutPositions, layouts }
}
