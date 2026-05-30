import { create } from "zustand"
import type {
	RelatedCreateSource,
	RelatedCreateTargetEndpoint,
} from "@/lib/relatedResourceCreate"

export type RelatedCreate = {
	source: RelatedCreateSource
	targetEndpoint: RelatedCreateTargetEndpoint
	targetStagedItemId?: string
	// "returning" guards the store against being cleared while the orchestrator
	// is mid-flight between marking a target staged and navigating back to the
	// source — clearRelatedCreate() during that async window would lose the
	// source context and strand the user on the target sheet.
	step: "creating-target" | "returning"
}

type RelatedCreateStore = {
	state: RelatedCreate | null
	start: (input: {
		source: RelatedCreateSource
		targetEndpoint: RelatedCreateTargetEndpoint
	}) => void
	setTargetStagedItem: (stagedItemId: string) => void
	markReturning: () => void
	clear: () => void
	reset: () => void
}

export const useRelatedCreateStore = create<RelatedCreateStore>((set) => ({
	state: null,
	start: ({ source, targetEndpoint }) =>
		set({ state: { source, targetEndpoint, step: "creating-target" } }),
	setTargetStagedItem: (stagedItemId) =>
		set((s) =>
			s.state
				? {
						state: {
							...s.state,
							targetStagedItemId: stagedItemId,
							step: "creating-target",
						},
					}
				: {},
		),
	markReturning: () =>
		set((s) => (s.state ? { state: { ...s.state, step: "returning" } } : {})),
	clear: () => set({ state: null }),
	reset: () => set({ state: null }),
}))
