import type { ResourceIdentitySchema } from "@opsy/bridge-client"
import type { ProviderCapabilities, TypeCapabilities } from "./capabilities"
import type { ResourceTypeSchema } from "./field-tree"
import type {
	Integration,
	IntegrationCheckResult,
	ProviderIntegrationDefinition,
} from "./integration"
import type { ProviderOp, ProviderOperationContext } from "./ops"
import type { ProviderResult } from "./result"

export type {
	IdentityAttribute,
	ResourceIdentitySchema,
	ResourceSchema,
	SchemaAttribute,
	SchemaBlock,
	SchemaNestedBlock,
} from "@opsy/bridge-client"

// ─── State ────────────────────────────────────────────────────────────────

export type State = Record<string, unknown>

// ─── ProviderType — per-type metadata ─────────────────────────────────────
// ProviderOps flow through provider-level `dispatch` instead of per-entry
// methods, so the entry is pure metadata.

export interface ProviderType {
	type: string
	capabilities: TypeCapabilities
}

export interface ProviderTypeSearchResult {
	type: string
	kinds: Array<"resource" | "data">
}

// ─── OpsyProvider — single dispatch surface ───────────────────────────────

export interface OpsyProvider {
	name: string
	/**
	 * Initialize the provider against a pinned TF provider version. Fetches
	 * the manifest summary (no credentials required) and clears selected-schema
	 * caches when the version changes.
	 */
	init(version: string): Promise<void>
	/**
	 * Declarative capabilities computed at init() time. Null until init().
	 */
	readonly capabilities: ProviderCapabilities
	readonly info: { tfSource: string; version: string | null }
	readonly integrationDefinition: ProviderIntegrationDefinition | undefined
	checkIntegration(
		integration: Integration,
		signal?: AbortSignal,
	): Promise<IntegrationCheckResult>
	/** Per-type metadata (no methods). Returns undefined for unknown types. */
	getType(type: string): Promise<ProviderType | undefined>
	/**
	 * Import-identity schema for a resource type, served credential-free from
	 * the catalog. Tri-state, matching the three real domain outcomes:
	 *   - `ResourceIdentitySchema` — the provider advertises structured identity
	 *   - `null` — the resource exists but has no structured identity, so the
	 *     caller imports with a raw Terraform import ID
	 *   - `undefined` — not an importable resource type for this provider
	 */
	getTypeIdentity(
		type: string,
	): Promise<ResourceIdentitySchema | null | undefined>
	/** Manifest-backed bounded type search. */
	searchTypes(input: {
		q?: string
		kind?: "resource" | "data" | "both"
		limit?: number
		offset?: number
	}): Promise<{ results: ProviderTypeSearchResult[]; truncated: boolean }>
	/**
	 * Read-only selected schema accessors. Returns the normalized
	 * `ResourceTypeSchema` (the `Field[]` tree + root metadata) — raw cty
	 * `ResourceSchema` never crosses this boundary.
	 */
	getSchema(
		type: string,
		kind: "resource" | "data",
	): Promise<ResourceTypeSchema | undefined>
	getSchema(type: string): Promise<
		| {
				resource?: ResourceTypeSchema
				data?: ResourceTypeSchema
		  }
		| undefined
	>
	getProviderConfigSchema(): Promise<ResourceTypeSchema | undefined>
	/**
	 * Single entry point for every provider operation. Conditional return type
	 * narrows per Op kind.
	 */
	dispatch<Op extends ProviderOp>(
		op: Op,
		ctx: ProviderOperationContext,
	): Promise<ProviderResult<Op["kind"]>>
}
