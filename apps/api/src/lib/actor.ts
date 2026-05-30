import type { Actor } from "../types"

// Synthetic actor for background work initiated by the API itself. `actor_id`
// has no FK in any of the actor
// columns, so we reuse the orgId as an opaque id to keep the audit log
// org-traceable without minting a fresh sentinel UUID.
export const systemActor = (orgId: string): Actor => ({
	type: "system",
	id: orgId,
	orgId,
})

// True only for callers that actually render LLM-generated type artifacts
// (icons, display metadata, field metadata). Loading these queues generation
// for any type not yet seen, so programmatic callers (CLI device-flow, raw
// API keys) skip the load entirely — they don't render icons.
export const actorRendersArtifacts = (actor: Actor): boolean =>
	actor.type !== "api_key" && actor.channel !== "bearer"
