import type { Integration } from "./integration"
import type { State } from "./types"

export type ProviderOp =
	| {
			kind: "Plan"
			type: string
			priorState: State | null
			proposedState: State | null
			config: State | null
	  }
	| {
			kind: "Apply"
			type: string
			priorState: State | null
			plannedState: State | null
			plannedPrivate: string | null
			config: State | null
			requiresReplace?: string[][]
			/** Action-kind hint so dispatch can emit a MarkResourceDeleted effect on destroy. */
			actionKind?: "create" | "update" | "delete"
	  }
	| {
			kind: "Read"
			type: string
			state: State
	  }
	| {
			kind: "Import"
			type: string
			// Mutually exclusive, mirroring Terraform's ImportResourceState:
			// providerId is the raw import ID; identity carries each structured
			// identity attribute by name (raw user strings — the bridge coerces
			// them against the cached identity schema).
			providerId?: string
			identity?: Record<string, string>
	  }
	| {
			kind: "ReadData"
			type: string
			selector: Record<string, unknown>
	  }

// ─── Per-kind payload shapes ──────────────────────────────────────────────

export interface PlanPayload {
	plannedState: State | null
	plannedPrivate: string | null
	requiresReplace: string[][]
}

export interface ApplyPayload {
	state: State | null
}

export interface ReadPayload {
	state: State | null
}

export interface ImportPayload {
	state: State
}

export interface ReadDataPayload {
	state: State | null
}

export type ProviderResultByKind = {
	Plan: PlanPayload
	Apply: ApplyPayload
	Read: ReadPayload
	Import: ImportPayload
	ReadData: ReadDataPayload
}

export interface ProviderOperationContext {
	integration: Integration
	signal?: AbortSignal
}
