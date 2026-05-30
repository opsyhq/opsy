import { z } from "zod"
import type { ResolvedField } from "@/components/resource-detail/resolvedTypeView"

export type FieldValues = Record<string, unknown>

// The server plan owns input validation: missing-required, type, and provider
// constraint checks happen there and surface as real provider diagnostics. The
// client form must NOT re-derive and hard-block on any of it — those artifact-
// derived flags/types are heuristics. Two ways that bites:
//   - `required`: facts-only resources legitimately carry blank desired inputs
//     for computed/state-backed fields.
//   - object types: imported resources carry the Terraform list-of-blocks
//     representation, so `logging`/`versioning`/`website` arrive as arrays, not
//     objects. A `z.object()` here rejects that array shape.
// In both cases the block is silent (no visible error) and duplicates the
// owning validation boundary. So every field is structurally permissive.
// `field.required` still drives the `*` UI hint; it no longer gates submit.
export function buildResolverSchema(
	fields: ResolvedField[],
): z.ZodObject<Record<string, z.ZodType>> {
	const shape: Record<string, z.ZodType> = {}
	for (const f of fields) shape[f.terraformName] = z.unknown().optional()
	return z.object(shape).passthrough()
}

function isBlank(v: unknown): boolean {
	if (v == null) return true
	if (typeof v === "string") return v === ""
	if (Array.isArray(v)) return v.length === 0
	if (typeof v === "object") return Object.keys(v as object).length === 0
	return false
}

// Drop unfilled fields (undefined / "" / empty collections) so the request
// body only carries what the user actually entered.
export function pruneBlanks(values: FieldValues): FieldValues {
	const out: FieldValues = {}
	for (const [k, v] of Object.entries(values)) {
		const pruned = pruneNestedBlanks(v)
		if (!isBlank(pruned)) out[k] = pruned
	}
	return out
}

function pruneNestedBlanks(value: unknown): unknown {
	if (value === undefined || value === null) return undefined
	if (Array.isArray(value)) return value
	if (typeof value !== "object") return value
	const out: FieldValues = {}
	for (const [k, v] of Object.entries(value)) {
		const pruned = pruneNestedBlanks(v)
		if (pruned !== undefined && !isBlank(pruned)) out[k] = pruned
	}
	return out
}
