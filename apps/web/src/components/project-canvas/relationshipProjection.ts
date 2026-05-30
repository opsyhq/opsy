import type { CanvasEdge } from "@/components/project-canvas/resourceRelationships"
import { type DisplayByTypeKey, resourceDisplay } from "./nodeFootprint"
import type { ResourceNodeNestedItem } from "./nodes/ResourceNode"
import type { ResourceLike } from "./resourceProjection"

export type ProjectedRelationship = {
	id: string
	sourceSlug: string
	targetSlug: string
	edge: CanvasEdge
	underlyingEdgeIds: string[]
	hiddenResourceSlugs: string[]
	display: "collapsed" | "rerouted"
}

type VisibleEndpoint = {
	slug: string
	hiddenResourceSlugs: string[]
}

type ResourcePlacement = {
	hostSlug: string
	resource: ResourceLike
}

function resourceItemLabel(resource: ResourceLike): string {
	return `${resource.type} · ${resource.slug}`
}

function nestedResourceItem(
	resource: ResourceLike,
	displayByTypeKey: DisplayByTypeKey,
): ResourceNodeNestedItem {
	return {
		slug: resource.slug,
		type: resource.type,
		label: resourceItemLabel(resource),
		display: resourceDisplay(resource, displayByTypeKey),
	}
}

function resolveVisibleEndpoint(
	displayHostByHiddenSlug: Map<string, string>,
	hiddenSlugs: Set<string>,
	slug: string,
	seen = new Set<string>(),
): VisibleEndpoint {
	if (seen.has(slug)) return { slug, hiddenResourceSlugs: [] }
	const hostSlug = displayHostByHiddenSlug.get(slug)
	if (!hostSlug) return { slug, hiddenResourceSlugs: [] }
	const resolved = resolveVisibleEndpoint(
		displayHostByHiddenSlug,
		hiddenSlugs,
		hostSlug,
		new Set([...seen, slug]),
	)
	return {
		slug: resolved.slug,
		hiddenResourceSlugs: [
			...(hiddenSlugs.has(slug) ? [slug] : []),
			...resolved.hiddenResourceSlugs,
		],
	}
}

export function applyRelationshipProjection(
	resources: ResourceLike[],
	edges: CanvasEdge[],
	displayByTypeKey: DisplayByTypeKey,
): {
	resources: ResourceLike[]
	hiddenSlugs: Set<string>
	collapsedRelationships: ProjectedRelationship[]
	consumedDisplayEdgeIds: Set<string>
} {
	if (edges.length === 0) {
		return {
			resources: resources.map((resource) => ({ ...resource })),
			hiddenSlugs: new Set(),
			collapsedRelationships: [],
			consumedDisplayEdgeIds: new Set(),
		}
	}

	const resourceSlugs = new Set(resources.map((resource) => resource.slug))
	const resourceBySlug = new Map(
		resources.map((resource) => [resource.slug, resource]),
	)
	const visibleEdges = edges.filter(
		(edge) => resourceSlugs.has(edge.source) && resourceSlugs.has(edge.target),
	)
	const incidentEdgesBySlug = new Map(
		resources.map(
			(resource) =>
				[
					resource.slug,
					visibleEdges.filter(
						(edge) =>
							edge.source === resource.slug || edge.target === resource.slug,
					),
				] as const,
		),
	)

	const hiddenAssociationSlugs = new Set(
		resources
			.filter((resource) => {
				const outgoingAssociations = (
					incidentEdgesBySlug.get(resource.slug) ?? []
				).filter(
					(edge) =>
						edge.source === resource.slug &&
						edge.role === "ASSOCIATION" &&
						edge.target !== resource.slug,
				)
				return (
					new Set(outgoingAssociations.map((edge) => edge.target)).size >= 2
				)
			})
			.map((resource) => resource.slug),
	)

	const attachmentEdgesBySource = new Map<string, CanvasEdge[]>()
	for (const edge of visibleEdges) {
		if (edge.role !== "ATTACHMENT" || edge.source === edge.target) {
			continue
		}
		const sourceEdges = attachmentEdgesBySource.get(edge.source) ?? []
		sourceEdges.push(edge)
		attachmentEdgesBySource.set(edge.source, sourceEdges)
	}
	const attachmentPlacements = Array.from(
		attachmentEdgesBySource,
		([sourceSlug, sourceAttachments]): ResourcePlacement[] => {
			const resource = resourceBySlug.get(sourceSlug)
			if (!resource || resourceDisplay(resource, displayByTypeKey) !== "chip")
				return []
			const hostSlugs = new Set(sourceAttachments.map((edge) => edge.target))
			if (hostSlugs.size !== 1) return []
			const hostSlug = hostSlugs.values().next().value
			return typeof hostSlug === "string" ? [{ hostSlug, resource }] : []
		},
	).flat()
	const bottomTuckedItemsByHost = new Map<
		string,
		Map<string, ResourceNodeNestedItem>
	>()
	for (const placement of attachmentPlacements) {
		const items =
			bottomTuckedItemsByHost.get(placement.hostSlug) ??
			new Map<string, ResourceNodeNestedItem>()
		items.set(
			placement.resource.slug,
			nestedResourceItem(placement.resource, displayByTypeKey),
		)
		bottomTuckedItemsByHost.set(placement.hostSlug, items)
	}
	const displayHostByHiddenSlug = new Map(
		[] as Array<readonly [string, string]>,
	)
	const attachmentHostBySlug = new Map(
		attachmentPlacements.map(
			(placement) => [placement.resource.slug, placement.hostSlug] as const,
		),
	)
	const hiddenSlugs = new Set([...hiddenAssociationSlugs])
	const initiallyConsumedEdgeIds = new Set([
		...visibleEdges.flatMap((edge) =>
			edge.role === "ASSOCIATION" && hiddenAssociationSlugs.has(edge.source)
				? [edge.id]
				: [],
		),
	])

	const toNestedItem = (
		resource: ResourceLike,
		seen = new Set<string>(),
	): ResourceNodeNestedItem => {
		if (seen.has(resource.slug))
			return nestedResourceItem(resource, displayByTypeKey)
		seen.add(resource.slug)
		const bottomTuckedItems = [
			...(bottomTuckedItemsByHost.get(resource.slug)?.values() ?? []),
		]
			.sort((a, b) => a.slug.localeCompare(b.slug))
			.flatMap((item) => {
				const child = resourceBySlug.get(item.slug)
				return child ? [toNestedItem(child, new Set(seen))] : [item]
			})
		return {
			...nestedResourceItem(resource, displayByTypeKey),
			...(bottomTuckedItems.length > 0 ? { bottomTuckedItems } : {}),
		}
	}

	const collapsedAssociationRelationships = [...hiddenAssociationSlugs].flatMap(
		(sourceSlug) => {
			const associationEdges = (
				incidentEdgesBySlug.get(sourceSlug) ?? []
			).filter(
				(edge) => edge.source === sourceSlug && edge.role === "ASSOCIATION",
			)
			const neighbors = [
				...new Set(associationEdges.map((edge) => edge.target)),
			].filter((slug) => !hiddenSlugs.has(slug))
			if (neighbors.length < 2) return []
			const [source, ...targets] = neighbors
			const representative = associationEdges[0]
			if (!source || !representative) return []
			return targets.map(
				(target): ProjectedRelationship => ({
					id: `association:${sourceSlug}:${source}:${target}`,
					sourceSlug: source,
					targetSlug: target,
					edge: representative,
					underlyingEdgeIds: associationEdges.map((edge) => edge.id),
					hiddenResourceSlugs: [sourceSlug],
					display: "collapsed",
				}),
			)
		},
	)

	const reroutedRelationships = visibleEdges.flatMap((edge) => {
		if (initiallyConsumedEdgeIds.has(edge.id)) return []
		if (
			edge.role !== "ATTACHMENT" &&
			edge.role !== "ASSOCIATION" &&
			edge.role !== "REFERENCE"
		) {
			return []
		}
		const source = resolveVisibleEndpoint(
			displayHostByHiddenSlug,
			hiddenSlugs,
			edge.source,
		)
		const target = resolveVisibleEndpoint(
			displayHostByHiddenSlug,
			hiddenSlugs,
			edge.target,
		)
		if (source.slug === edge.source && target.slug === edge.target) {
			return []
		}
		if (
			source.slug === target.slug ||
			hiddenSlugs.has(source.slug) ||
			hiddenSlugs.has(target.slug)
		) {
			return []
		}
		const hiddenResourceSlugs = [
			...source.hiddenResourceSlugs,
			...target.hiddenResourceSlugs,
		]
		return [
			{
				id: `projected:${edge.id}:${source.slug}:${target.slug}`,
				sourceSlug: source.slug,
				targetSlug: target.slug,
				edge,
				underlyingEdgeIds: [edge.id],
				hiddenResourceSlugs,
				display: "rerouted" as const,
			},
		]
	})

	const consumedDisplayEdgeIds = new Set([
		...initiallyConsumedEdgeIds,
		...reroutedRelationships.flatMap((edge) => edge.underlyingEdgeIds),
	])
	const collapsedRelationships = [
		...collapsedAssociationRelationships,
		...reroutedRelationships,
	]

	const visibleResources = resources.flatMap((resource) => {
		if (hiddenSlugs.has(resource.slug)) return []
		const bottomTuckedItems = [
			...(bottomTuckedItemsByHost.get(resource.slug)?.values() ?? []),
		]
			.sort((a, b) => a.slug.localeCompare(b.slug))
			.flatMap((item) => {
				const child = resourceBySlug.get(item.slug)
				return child ? [toNestedItem(child)] : [item]
			})
		return {
			...resource,
			bottomTuckedItems,
			componentHostSlug: attachmentHostBySlug.get(resource.slug) ?? null,
		}
	})
	return {
		resources: visibleResources,
		hiddenSlugs,
		collapsedRelationships,
		consumedDisplayEdgeIds,
	}
}
