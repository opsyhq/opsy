import { getResourceTypeKey } from "@/components/project-canvas/resourceRelationships"
import type { ResolvedField } from "@/components/resource-detail/resolvedTypeView"
import type { ProjectResource } from "@/lib/projectReactQuery"

export type RefValue = { $ref: string }
export type ParsedRefString = { slug: string; path: string }
export type ResourceReferenceCandidate = {
	id: string
	slug: string
	type: string
	displayName: string | null
	ref: RefValue
}

const REF_PATH_REGEX = /^[a-z0-9-]+(\.[a-zA-Z0-9_]+(\[\d+\])*)+$/

export function isRefValue(value: unknown): value is RefValue {
	return (
		value !== null &&
		typeof value === "object" &&
		!Array.isArray(value) &&
		"$ref" in value &&
		typeof (value as { $ref?: unknown }).$ref === "string"
	)
}

export function parseRefValue(value: unknown): string | null {
	return isRefValue(value) ? value.$ref : null
}

export function parseRefString(ref: string): ParsedRefString | null {
	if (!REF_PATH_REGEX.test(ref)) return null
	const dot = ref.indexOf(".")
	return { slug: ref.slice(0, dot), path: ref.slice(dot + 1) }
}

export function makeRefValue(ref: string): RefValue {
	return { $ref: ref }
}

export function refStrings(value: unknown): string[] {
	if (Array.isArray(value)) {
		return value.flatMap((entry) => {
			const ref = parseRefValue(entry)
			return ref ? [ref] : []
		})
	}
	const ref = parseRefValue(value)
	return ref ? [ref] : []
}

export function selectFieldReferenceCandidates(input: {
	relationships: ResolvedField["relationships"]
	resources: readonly ProjectResource[]
}): ResourceReferenceCandidate[] {
	const targetsByRef = new Map<string, ResourceReferenceCandidate>()
	for (const relationship of input.relationships) {
		for (const resource of input.resources) {
			if (
				resource.status !== "live" ||
				resource.type !== relationship.selectable.type
			) {
				continue
			}
			const ref = `${resource.slug}.${relationship.selectable.path}`
			const displayName = resource.metadata?.displayName
			targetsByRef.set(ref, {
				id: resource.id,
				slug: resource.slug,
				type: resource.type,
				displayName: typeof displayName === "string" ? displayName : null,
				ref: { $ref: ref },
			})
		}
	}
	return [...targetsByRef.values()].sort((a, b) => a.slug.localeCompare(b.slug))
}

export function selectResourceReferenceCandidates(input: {
	resources: readonly ProjectResource[]
	referenceFieldsByTypeKey: Map<string, string[]>
}): ResourceReferenceCandidate[] {
	const targetsByRef = new Map<string, ResourceReferenceCandidate>()
	for (const resource of input.resources) {
		if (resource.status !== "live") continue
		const typeKey = getResourceTypeKey(resource)
		if (!typeKey) continue
		const paths = new Set(input.referenceFieldsByTypeKey.get(typeKey) ?? [])
		for (const path of paths) {
			if (!path) continue
			const ref = `${resource.slug}.${path}`
			const displayName = resource.metadata?.displayName
			targetsByRef.set(ref, {
				id: resource.id,
				slug: resource.slug,
				type: resource.type,
				displayName: typeof displayName === "string" ? displayName : null,
				ref: { $ref: ref },
			})
		}
	}
	return [...targetsByRef.values()].sort((a, b) =>
		a.ref.$ref.localeCompare(b.ref.$ref),
	)
}

export function referenceValueForSelection(input: {
	value: unknown
	ref: string | null
	cardinality: "one" | "many"
	selected?: boolean
}): unknown {
	if (input.cardinality === "one") {
		return input.ref ? makeRefValue(input.ref) : undefined
	}
	const refs = refStrings(input.value)
	if (!input.ref) return refs.length > 0 ? refs.map(makeRefValue) : undefined
	const next =
		input.selected === false
			? refs.filter((candidate) => candidate !== input.ref)
			: [...new Set([...refs, input.ref])]
	return next.length === 0 ? undefined : next.map(makeRefValue)
}
