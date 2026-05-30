import { useMutation } from "@tanstack/react-query"
import type { Node, OnNodeDrag } from "@xyflow/react"
import { useCallback, useEffect, useRef } from "react"
import { toast } from "sonner"
import type { CanvasModel } from "@/components/canvas/canvasModel"
import { runCanvasLayout } from "@/components/project-canvas/layout/layoutRunner"
import type { DisplayByTypeKey } from "@/components/project-canvas/nodeFootprint"
import type { ResourceLike } from "@/components/project-canvas/resourceProjection"
import {
	persistableLayouts,
	toLayoutSpecs,
} from "@/components/project-canvas/toFlowNodes"
import { updateChangeSetItemMutationOptions } from "@/lib/changeSetReactQuery"
import { queryClient } from "@/lib/query"
import {
	bulkUpdateResourceLayoutMutationOptions,
	updateResourceLayoutMutationOptions,
} from "@/lib/resourceReactQuery"
import { classifyDraggedNode } from "../-classifyDraggedNode"

export type RunAutoLayout = (options: { force: boolean }) => void

export function useCanvasLayout(input: {
	projectSlug: string
	model: CanvasModel
	resources: ResourceLike[]
	displayByTypeKey: DisplayByTypeKey
	nodes: Node[]
	setNodes: React.Dispatch<React.SetStateAction<Node[]>>
	fitView: (options?: {
		padding?: number
		maxZoom?: number
	}) => Promise<boolean>
	nodesInitialized: boolean
	onStagedPositionChange?: (
		itemId: string,
		position: { x: number; y: number },
	) => void
	onStagedPositionClear?: (itemId: string) => void
}): {
	runAutoLayout: RunAutoLayout
	onNodeDragStop: OnNodeDrag
} {
	const {
		projectSlug,
		model,
		resources,
		displayByTypeKey,
		nodes,
		setNodes,
		fitView,
		nodesInitialized,
		onStagedPositionChange,
		onStagedPositionClear,
	} = input

	const nodesRef = useRef(nodes)
	useEffect(() => {
		nodesRef.current = nodes
	}, [nodes])

	const { mutate: bulkLayoutMutate } = useMutation(
		bulkUpdateResourceLayoutMutationOptions({ projectSlug, queryClient }),
	)
	const { mutate: singleLayoutMutate } = useMutation(
		updateResourceLayoutMutationOptions({ projectSlug, queryClient }),
	)
	const { mutate: stagedItemMutate } = useMutation(
		updateChangeSetItemMutationOptions({
			projectSlug,
			id: model.draftChangeSet?.id ?? "",
			queryClient,
		}),
	)

	const runAutoLayout = useCallback<RunAutoLayout>(
		({ force }) => {
			if (!nodesInitialized && resources.length > 0) return
			const specs = toLayoutSpecs({
				resources,
				nodes: nodesRef.current,
				displayByTypeKey,
				force,
			})
			runCanvasLayout(specs)
				.then((result) => {
					if (
						Object.keys(result.positions).length === 0 &&
						Object.keys(result.sizes).length === 0
					) {
						return
					}
					const { layoutPositions, layouts } = persistableLayouts({
						result,
						resources,
					})
					setNodes((prev) =>
						prev.map((node) => {
							const position = layoutPositions[node.id]
							const size = result.sizes[node.id]
							if (!position && !size) return node
							return {
								...node,
								...(position ? { position } : {}),
								...(size
									? {
											style: {
												...(node.style ?? {}),
												width: size.w,
												height: size.h,
											},
										}
									: {}),
							}
						}),
					)
					if (layouts.length > 0) bulkLayoutMutate(layouts)
					window.requestAnimationFrame(() => {
						void fitView({ padding: 0.2, maxZoom: 1 })
					})
				})
				.catch((err: unknown) => {
					const message = err instanceof Error ? err.message : String(err)
					toast.error(`Auto-layout failed: ${message}`)
				})
		},
		[
			bulkLayoutMutate,
			displayByTypeKey,
			fitView,
			nodesInitialized,
			resources,
			setNodes,
		],
	)

	const hasAutolaidOut = useRef(false)
	useEffect(() => {
		if (hasAutolaidOut.current || !nodesInitialized) return
		const needsInitialLayout = resources.some(
			(resource) => !resource.componentHostSlug && !resource.position,
		)
		if (!needsInitialLayout) {
			hasAutolaidOut.current = true
			if (resources.length > 0) {
				window.requestAnimationFrame(() => {
					void fitView({ padding: 0.2, maxZoom: 1 })
				})
			}
			return
		}
		hasAutolaidOut.current = true
		runAutoLayout({
			force: !resources.some((resource) => resource.position),
		})
	}, [fitView, nodesInitialized, resources, runAutoLayout])

	const saveTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(
		new Map(),
	)
	const scheduleSave = useCallback(
		(
			slug: string,
			layout: {
				position?: { x: number; y: number }
				size?: { w: number; h: number }
			},
		) => {
			const existing = saveTimers.current.get(slug)
			if (existing) clearTimeout(existing)
			const t = setTimeout(() => {
				saveTimers.current.delete(slug)
				singleLayoutMutate({ slug, ...layout })
			}, 400)
			saveTimers.current.set(slug, t)
		},
		[singleLayoutMutate],
	)
	const cancelScheduledSave = useCallback((slug: string) => {
		const pending = saveTimers.current.get(slug)
		if (!pending) return
		clearTimeout(pending)
		saveTimers.current.delete(slug)
	}, [])

	useEffect(() => {
		const timers = saveTimers.current
		return () => {
			timers.forEach((timer) => {
				clearTimeout(timer)
			})
			timers.clear()
		}
	}, [])

	const draftChangeSet = model.draftChangeSet
	const activeItems = model.activeItems
	// React Flow passes every dragged node here — one when a single card moves,
	// the whole marquee selection when several move together.
	const onNodeDragStop = useCallback<OnNodeDrag>(
		(_event, _node, draggedNodes) => {
			if (draggedNodes.length === 0) return
			const moved = new Map(draggedNodes.map((n) => [n.id, n.position]))
			setNodes((prev) =>
				prev.map((candidate) =>
					moved.has(candidate.id)
						? {
								...candidate,
								position: moved.get(candidate.id) ?? candidate.position,
							}
						: candidate,
				),
			)
			const layouts: Array<{
				slug: string
				position: { x: number; y: number }
			}> = []
			for (const node of draggedNodes) {
				const action = classifyDraggedNode(
					node,
					draftChangeSet?.itemIds,
					activeItems,
				)
				if (!action) continue
				if (action.kind === "stagedPosition") {
					onStagedPositionChange?.(action.itemId, action.position)
					stagedItemMutate(
						{
							itemId: action.itemId,
							body: { kind: action.itemKind, changes: action.changes },
						},
						{
							onError: (err) => {
								onStagedPositionClear?.(action.itemId)
								const message = err instanceof Error ? err.message : String(err)
								toast.error(message)
							},
						},
					)
					continue
				}
				cancelScheduledSave(action.slug)
				layouts.push({ slug: action.slug, position: action.position })
			}
			if (layouts.length === 1) {
				scheduleSave(layouts[0].slug, { position: layouts[0].position })
			} else if (layouts.length > 1) {
				bulkLayoutMutate(layouts)
			}
		},
		[
			activeItems,
			bulkLayoutMutate,
			cancelScheduledSave,
			draftChangeSet,
			onStagedPositionChange,
			onStagedPositionClear,
			scheduleSave,
			setNodes,
			stagedItemMutate,
		],
	)

	return {
		runAutoLayout,
		onNodeDragStop,
	}
}
