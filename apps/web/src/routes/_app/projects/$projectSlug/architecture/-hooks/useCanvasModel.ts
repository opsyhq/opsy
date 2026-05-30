import { useQueries } from "@tanstack/react-query"
import { useMemo } from "react"
import {
	type CanvasModel,
	type CanvasModelInput,
	canvasModel,
} from "@/components/canvas/canvasModel"
import type { DisplayByTypeKey } from "@/components/project-canvas/nodeFootprint"
import {
	flattenRelationshipRules,
	getResourceTypeKey,
	type RelationshipRule,
} from "@/components/project-canvas/resourceRelationships"
import { typeArtifactsQueryOptions } from "@/lib/providerReactQuery"

// Resolves the per-type relationship rules + display modes the canvas needs
// (one provider/type query per distinct kind among the applied resources),
// then feeds everything into the pure canvasModel function.
export function useCanvasModel(
	input: Omit<CanvasModelInput, "rulesByTypeKey" | "displayByTypeKey">,
): CanvasModel {
	const artifactInputs = useMemo(() => {
		const byTypeKey = new Map<
			string,
			{ provider: string; type: string; kind: "resource" }
		>()
		for (const resource of input.appliedResources) {
			if (!resource.provider) continue
			const key = getResourceTypeKey(resource)
			if (key && !byTypeKey.has(key)) {
				byTypeKey.set(key, {
					provider: resource.provider,
					type: resource.type,
					kind: "resource",
				})
			}
		}
		return Array.from(byTypeKey.values())
	}, [input.appliedResources])
	const artifactQueries = useQueries({
		queries: artifactInputs.map((entry) => typeArtifactsQueryOptions(entry)),
	})
	const artifactVersion = artifactInputs
		.map((entry, index) => {
			const updatedAt = artifactQueries[index]?.dataUpdatedAt ?? 0
			return `${entry.provider}:${entry.kind}:${entry.type}:${updatedAt}`
		})
		.join("|")

	// `artifactQueries` is a fresh array every render but its contents only
	// change when `artifactVersion` (a stamp built from each query's
	// `dataUpdatedAt`) changes. Recomputing on the version keeps the maps
	// referentially stable across renders that don't actually move data.
	// biome-ignore lint/correctness/useExhaustiveDependencies: artifactVersion is the stable proxy for artifactQueries
	const { rulesByTypeKey, displayByTypeKey } = useMemo(() => {
		const rules = new Map<string, RelationshipRule[]>()
		const display: DisplayByTypeKey = new Map()
		for (const query of artifactQueries) {
			const artifacts = query.data
			if (!artifacts) continue
			const key = getResourceTypeKey({
				provider: artifacts.provider,
				type: artifacts.type,
			})
			if (!key) continue
			rules.set(key, flattenRelationshipRules(artifacts.relationshipRules.data))
			const mode = artifacts.metadata.data?.display
			if (mode === "card" || mode === "chip") {
				display.set(key, mode)
			}
		}
		return { rulesByTypeKey: rules, displayByTypeKey: display }
	}, [artifactVersion])

	return useMemo(
		() =>
			canvasModel({
				appliedResources: input.appliedResources,
				draft: input.draft,
				applying: input.applying,
				openOperations: input.openOperations,
				rulesByTypeKey,
				displayByTypeKey,
			} satisfies CanvasModelInput),
		[
			input.appliedResources,
			input.draft,
			input.applying,
			input.openOperations,
			rulesByTypeKey,
			displayByTypeKey,
		],
	)
}
