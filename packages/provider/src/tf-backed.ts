import type { BridgeClient } from "@opsy/bridge-client"
import type { Integration } from "./integration"
import type {
	ApplyPayload,
	ImportPayload,
	PlanPayload,
	ProviderOp,
	ReadDataPayload,
	ReadPayload,
} from "./ops"
import type { State } from "./types"

// The bridge wire protocol returns `unknown | null` for state fields (the JSON
// payload can be any object or null). Cast to `State` at the boundary — the
// runtime contract guarantees these are either a JSON object or null.
function toState(v: unknown): State | null {
	return v as State | null
}

// State is TF-native end to end: a block's value carries Terraform's own
// shape (a `list`/`set` block is an array, `single`/`group` an object) at
// every layer — DB `resources.inputs`, absorb, API, web form, and this bridge
// wire. There is no collapse/expand boundary; values round-trip through the
// bridge unchanged, so plan/apply never see a phantom diff from a shape
// transform.

// INTERNAL — the composer is the only caller. Builds the bridge-backed
// portion of a provider's dispatch: Plan, Apply, Read, Import, ReadData.

interface ProviderRefFields {
	provider_source: string
	provider_version: string
	provider_config: Record<string, unknown>
}

export interface TfDispatchDeps {
	bridge: BridgeClient
	tfSource: string
	version: string
	providerConfigFor: (integration: Integration) => Record<string, unknown>
}

function toProviderRef(
	deps: TfDispatchDeps,
	integration: Integration,
): ProviderRefFields {
	return {
		provider_source: deps.tfSource,
		provider_version: deps.version,
		provider_config: deps.providerConfigFor(integration),
	}
}

export async function tfPlan(
	deps: TfDispatchDeps,
	op: Extract<ProviderOp, { kind: "Plan" }>,
	integration: Integration,
	signal: AbortSignal | undefined,
): Promise<PlanPayload> {
	const ref = toProviderRef(deps, integration)
	const resp = await deps.bridge.planResource(
		{
			...ref,
			type: op.type,
			prior_state: op.priorState,
			proposed_new_state: op.proposedState,
			config: op.config,
			prior_private: null,
		},
		{ signal },
	)
	return {
		plannedState: toState(resp.planned_state),
		plannedPrivate: resp.planned_private ?? null,
		requiresReplace: resp.requires_replace ?? [],
	}
}

export async function tfApply(
	deps: TfDispatchDeps,
	op: Extract<ProviderOp, { kind: "Apply" }>,
	integration: Integration,
	signal: AbortSignal | undefined,
): Promise<ApplyPayload> {
	const ref = toProviderRef(deps, integration)
	const resp = await deps.bridge.applyResource(
		{
			...ref,
			type: op.type,
			prior_state: op.priorState,
			planned_state: op.plannedState,
			config: op.config,
			planned_private: op.plannedPrivate,
			requires_replace: op.requiresReplace,
		},
		{ signal },
	)
	return { state: toState(resp.new_state) }
}

export async function tfRead(
	deps: TfDispatchDeps,
	op: Extract<ProviderOp, { kind: "Read" }>,
	integration: Integration,
	signal: AbortSignal | undefined,
): Promise<ReadPayload> {
	const ref = toProviderRef(deps, integration)
	const resp = await deps.bridge.readResource(
		{
			...ref,
			type: op.type,
			current_state: op.state,
			private: null,
		},
		{ signal },
	)
	return { state: toState(resp.new_state) }
}

export async function tfImport(
	deps: TfDispatchDeps,
	op: Extract<ProviderOp, { kind: "Import" }>,
	integration: Integration,
	signal: AbortSignal | undefined,
): Promise<ImportPayload> {
	const ref = toProviderRef(deps, integration)
	const resp = await deps.bridge.importResource(
		{
			...ref,
			type: op.type,
			...(op.identity
				? { identity: op.identity }
				: { provider_id: op.providerId }),
		},
		{ signal },
	)
	const first = resp.imported_resources[0]
	if (!first || first.state == null) {
		const handle = op.identity ? JSON.stringify(op.identity) : op.providerId
		// A zero-result import means the provider rejected it; the reason is
		// in the diagnostics. Surface them instead of a generic message so the
		// real cause (bad identity attr, missing object, …) reaches the user.
		const reason = (resp.diagnostics ?? [])
			.filter((d) => d.severity === "error")
			.map((d) => (d.detail ? `${d.summary}: ${d.detail}` : d.summary))
			.join("; ")
		throw new Error(
			`tfImport: ${op.type} ${handle} could not be imported` +
				(reason ? `: ${reason}` : " (provider returned no state)"),
		)
	}
	return { state: first.state as State }
}

export async function tfReadData(
	deps: TfDispatchDeps,
	op: Extract<ProviderOp, { kind: "ReadData" }>,
	integration: Integration,
	signal: AbortSignal | undefined,
): Promise<ReadDataPayload> {
	const ref = toProviderRef(deps, integration)
	const resp = await deps.bridge.readDataSource(
		{
			...ref,
			type: op.type,
			config: op.selector,
		},
		{ signal },
	)
	return { state: toState(resp.state) }
}
