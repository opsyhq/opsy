import type { ChangeSetItem } from "../lib/db/schema"
import { extractRefs } from "../lib/refs/ast"

export type ApplyPlanBlocker = {
	itemId: string
	reason: "missing_target" | "delete_blocked" | "cycle" | "blocked_dependency"
	slug?: string
	blockedByItemId?: string
	blockedBySlug?: string
	message: string
}

export type ApplyPlanLiveResource = {
	id: string
	slug: string
	dependsOn: string[] | null
	deletedAt: Date | null
}

export function changeSetItemSlug(item: ChangeSetItem): string | null {
	if (item.kind === "create_resource" || item.kind === "import_resource") {
		return item.changes.slug
	}
	return item.targetResourceSlug ?? null
}

function refSources(item: ChangeSetItem): unknown[] {
	if (item.kind === "create_resource") {
		return ["inputs" in item.changes ? item.changes.inputs : undefined]
	}
	if (item.kind !== "update_resource") return []
	return [item.changes.inputs]
}

export function planChangesetApply(
	items: ChangeSetItem[],
	liveResources: ApplyPlanLiveResource[],
): {
	orderedItems: ChangeSetItem[]
	blockers: ApplyPlanBlocker[]
	dependenciesByItemId: Map<string, Set<string>>
} {
	const orderedByCreation = [...items].sort(
		(a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
	)
	const liveBySlug = new Map(
		liveResources
			.filter((resource) => !resource.deletedAt)
			.map((resource) => [resource.slug, resource]),
	)
	const stagedTargetsBySlug = new Map<string, ChangeSetItem>()
	const stagedMutationsBySlug = new Map<string, ChangeSetItem[]>()
	const stagedDeletesBySlug = new Map<string, ChangeSetItem>()
	for (const item of orderedByCreation) {
		const slug = changeSetItemSlug(item)
		if (!slug) continue
		if (item.kind === "create_resource" || item.kind === "import_resource") {
			stagedTargetsBySlug.set(slug, item)
		}
		if (item.kind === "delete_resource") {
			stagedDeletesBySlug.set(slug, item)
		} else {
			const mutations = stagedMutationsBySlug.get(slug) ?? []
			mutations.push(item)
			stagedMutationsBySlug.set(slug, mutations)
		}
	}

	const blockers: ApplyPlanBlocker[] = []
	const dependenciesByItemId = new Map(
		orderedByCreation.map((item) => [item.id, new Set<string>()]),
	)
	for (const item of orderedByCreation) {
		const itemSlug = changeSetItemSlug(item)
		for (const source of refSources(item)) {
			if (source === undefined) continue
			for (const refSlug of extractRefs(source)) {
				if (refSlug === itemSlug) {
					blockers.push({
						itemId: item.id,
						reason: "cycle",
						slug: refSlug,
						message: `resource ${refSlug} cannot reference itself`,
					})
					continue
				}
				const deleteItem = stagedDeletesBySlug.get(refSlug)
				if (deleteItem) {
					blockers.push({
						itemId: item.id,
						reason: "delete_blocked",
						slug: refSlug,
						blockedByItemId: deleteItem.id,
						message: `referenced resource ${refSlug} is staged for delete`,
					})
					continue
				}
				const stagedTarget = stagedTargetsBySlug.get(refSlug)
				if (stagedTarget) {
					if (item.id !== stagedTarget.id)
						dependenciesByItemId.get(item.id)?.add(stagedTarget.id)
					continue
				}
				const stagedMutations = stagedMutationsBySlug.get(refSlug)
				if (stagedMutations) {
					for (const mutation of stagedMutations) {
						if (item.id !== mutation.id)
							dependenciesByItemId.get(item.id)?.add(mutation.id)
					}
				} else if (!liveBySlug.has(refSlug)) {
					blockers.push({
						itemId: item.id,
						reason: "missing_target",
						slug: refSlug,
						message: `referenced resource ${refSlug} is missing`,
					})
				}
			}
		}
	}

	for (const [deleteSlug, deleteItem] of stagedDeletesBySlug) {
		for (const resource of liveBySlug.values()) {
			if (!resource.dependsOn?.includes(deleteSlug)) continue
			const resourceDelete = stagedDeletesBySlug.get(resource.slug)
			if (resourceDelete) {
				if (deleteItem.id !== resourceDelete.id)
					dependenciesByItemId.get(deleteItem.id)?.add(resourceDelete.id)
				continue
			}
			const finalMutation = (stagedMutationsBySlug.get(resource.slug) ?? [])
				.filter((mutation) =>
					refSources(mutation).some((source) => source !== undefined),
				)
				.at(-1)
			if (finalMutation) {
				const dependencyRemains = refSources(finalMutation).some((source) =>
					source === undefined
						? false
						: extractRefs(source).includes(deleteSlug),
				)
				if (!dependencyRemains) {
					if (deleteItem.id !== finalMutation.id)
						dependenciesByItemId.get(deleteItem.id)?.add(finalMutation.id)
					continue
				}
			}
			blockers.push({
				itemId: deleteItem.id,
				reason: "delete_blocked",
				slug: deleteSlug,
				blockedBySlug: resource.slug,
				message: `cannot delete ${deleteSlug} because ${resource.slug} references it`,
			})
		}
	}

	const blockedItemIds = new Set(blockers.map((blocker) => blocker.itemId))
	for (let changed = true; changed; ) {
		changed = false
		for (const item of orderedByCreation) {
			if (blockedItemIds.has(item.id)) continue
			const blockedDependency = Array.from(
				dependenciesByItemId.get(item.id) ?? [],
			).find((dependencyId) => blockedItemIds.has(dependencyId))
			if (!blockedDependency) continue
			blockedItemIds.add(item.id)
			blockers.push({
				itemId: item.id,
				reason: "blocked_dependency",
				blockedByItemId: blockedDependency,
				message: "changeset item depends on a blocked prerequisite",
			})
			changed = true
		}
	}

	const remainingDependenciesByItemId = new Map(
		Array.from(dependenciesByItemId.entries()).map(([itemId, dependencies]) => [
			itemId,
			new Set(dependencies),
		]),
	)
	const ready = orderedByCreation.filter(
		(item) =>
			!blockedItemIds.has(item.id) &&
			(remainingDependenciesByItemId.get(item.id)?.size ?? 0) === 0,
	)
	const orderedItems: ChangeSetItem[] = []
	for (let index = 0; index < ready.length; index++) {
		const item = ready[index]
		if (!item) continue
		orderedItems.push(item)
		for (const candidate of orderedByCreation) {
			const dependencies = remainingDependenciesByItemId.get(candidate.id)
			if (!dependencies?.delete(item.id) || dependencies.size !== 0) continue
			if (!blockedItemIds.has(candidate.id)) ready.push(candidate)
		}
	}
	for (const item of orderedByCreation) {
		if (
			blockedItemIds.has(item.id) ||
			orderedItems.some((ordered) => ordered.id === item.id)
		) {
			continue
		}
		blockers.push({
			itemId: item.id,
			reason: "cycle",
			slug: changeSetItemSlug(item) ?? undefined,
			message: "changeset dependency cycle detected",
		})
	}
	return { orderedItems, blockers, dependenciesByItemId }
}

export type ChangeSetApplyGraph = {
	levels: ChangeSetItem[][]
}

export function getChangeSetApplyGraph(
	plan: ReturnType<typeof planChangesetApply>,
): ChangeSetApplyGraph {
	if (plan.blockers.length > 0) {
		throw new Error(
			"invariant: getChangeSetApplyGraph called on a changeset with blockers",
		)
	}

	const includedIds = new Set(plan.orderedItems.map((item) => item.id))
	const depthById = new Map<string, number>()
	for (const item of plan.orderedItems) {
		let depth = 0
		for (const dependencyId of plan.dependenciesByItemId.get(item.id) ?? []) {
			if (!includedIds.has(dependencyId)) continue
			depth = Math.max(depth, (depthById.get(dependencyId) ?? 0) + 1)
		}
		depthById.set(item.id, depth)
	}

	const levels: ChangeSetItem[][] = []
	for (const item of plan.orderedItems) {
		const depth = depthById.get(item.id) ?? 0
		levels[depth] ??= []
		levels[depth].push(item)
	}
	return { levels }
}
