import { create } from "zustand"

// A resource the user is configuring but hasn't saved. It lives only in memory
// — nothing is written to the change set until they submit the editor — so the
// canvas, the staged-changes bar, and the server never see a half-baked node.
// Cancelling just drops this. Ephemeral on purpose (unlike detail/create state,
// which lives in the URL), since an unsaved draft shouldn't survive a reload.
export type ResourceDraft = {
	slug: string
	type: string
	integrationSlug: string
	displayName: string | null
	position: { x: number; y: number } | null
}

type ResourceDraftStore = {
	draft: ResourceDraft | null
	openDraft: (draft: ResourceDraft) => void
	clearDraft: () => void
}

export const useResourceDraftStore = create<ResourceDraftStore>((set) => ({
	draft: null,
	openDraft: (draft) => set({ draft }),
	clearDraft: () => set({ draft: null }),
}))
