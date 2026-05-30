import type { ResourceTypeArtifactsResponse } from "@opsy/api"
import { parseRefString, parseRefValue } from "@/lib/resourceRefs"

type RelationshipRulesData = NonNullable<
	NonNullable<ResourceTypeArtifactsResponse>["relationshipRules"]["data"]
>

export type ResourceReference = {
	sourcePath: string
	targetSlug: string
	targetPath: string
}

export type ResourceRole = "ATTACHMENT" | "REFERENCE" | "SCOPE" | "ASSOCIATION"

export type RelationshipRule = RelationshipRulesData[string][number]

export function flattenRelationshipRules(
	data: RelationshipRulesData | null | undefined,
): RelationshipRule[] {
	if (!data) return []
	return Object.values(data).flat()
}

export type CanvasRelationshipResource = {
	slug: string
	type: string
	provider: string | null
	identity?: unknown
	references: ResourceReference[]
}

export type CanvasEdge = {
	id: string
	source: string
	target: string
	sourcePath: string
	targetPath: string
	role: ResourceRole
	origin: "config" | "rule"
	ruleKey: string | null
	referrerSlug: string
}

export function getResourceTypeKey(input: {
	provider: string | null
	type: string
}): string | null {
	return input.provider ? `${input.provider}:resource:${input.type}` : null
}

export function getResourceReferences(
	value: unknown,
	path = "",
): ResourceReference[] {
	const ref = parseRefValue(value)
	if (ref) {
		const parsed = parseRefString(ref)
		return parsed
			? [{ sourcePath: path, targetSlug: parsed.slug, targetPath: parsed.path }]
			: []
	}
	if (Array.isArray(value)) {
		return value.flatMap((item, index) =>
			getResourceReferences(item, `${path}[${index}]`),
		)
	}
	if (!value || typeof value !== "object") return []
	return Object.entries(value as Record<string, unknown>).flatMap(
		([key, child]) =>
			getResourceReferences(child, path ? `${path}.${key}` : key),
	)
}

export function getResourceIdentityValuesByPath(
	state: unknown,
	path: string,
): Array<string | number | boolean> {
	const values: Array<string | number | boolean> = []
	const segments: Array<string | number> = []
	for (const segment of path.split(".").filter(Boolean)) {
		const open = segment.indexOf("[")
		if (open === -1) {
			segments.push(segment)
			continue
		}
		segments.push(segment.slice(0, open))
		for (const match of segment.slice(open).matchAll(/\[(\d+)\]/g)) {
			const index = Number(match[1])
			if (Number.isInteger(index)) segments.push(index)
		}
	}

	const visit = (current: unknown, remaining: Array<string | number>): void => {
		if (remaining.length === 0) {
			if (Array.isArray(current)) {
				for (const item of current) visit(item, [])
			} else if (
				typeof current === "string" ||
				typeof current === "number" ||
				typeof current === "boolean"
			) {
				values.push(current)
			}
			return
		}
		if (current == null) return
		const [head, ...tail] = remaining
		if (Array.isArray(current)) {
			if (typeof head === "number") {
				visit(current[head], tail)
				return
			}
			for (const item of current) visit(item, remaining)
			return
		}
		if (typeof head === "number" || typeof current !== "object") return
		visit(Reflect.get(current as object, head), tail)
	}

	visit(state, segments)
	return values
}

function canvasEdgeId(edge: Omit<CanvasEdge, "id">): string {
	return [
		edge.origin,
		edge.source,
		edge.target,
		edge.sourcePath,
		edge.targetPath,
		edge.role,
	].join("|")
}

export function getResourceRelationships(
	resources: CanvasRelationshipResource[],
	rulesByTypeKey: Map<string, RelationshipRule[]>,
): CanvasEdge[] {
	const resourcesBySlug = new Map(resources.map((r) => [r.slug, r]))

	const configEdges = resources.flatMap((row): CanvasEdge[] =>
		row.references.flatMap((ref): CanvasEdge[] => {
			const target = resourcesBySlug.get(ref.targetSlug)
			if (!target) return []
			const fromTypeKey = getResourceTypeKey(row)
			const toTypeKey = getResourceTypeKey(target)
			const candidateRules = [
				...(fromTypeKey ? (rulesByTypeKey.get(fromTypeKey) ?? []) : []),
				...(toTypeKey ? (rulesByTypeKey.get(toTypeKey) ?? []) : []),
			]
			const rules = Array.from(
				new Map(candidateRules.map((rule) => [rule.key, rule])).values(),
			)

			const refSourcePath = ref.sourcePath.replace(/\[\d+\]/g, "")
			const refTargetPath = ref.targetPath.replace(/\[\d+\]/g, "")
			const rule = rules.find(
				(r) =>
					(r.source.kind === "resource" &&
						row.type === r.source.type &&
						r.source.path === refSourcePath &&
						r.target.kind === "resource" &&
						target.type === r.target.type &&
						r.target.path === refTargetPath) ||
					(r.target.kind === "resource" &&
						row.type === r.target.type &&
						r.target.path === refSourcePath &&
						r.source.kind === "resource" &&
						target.type === r.source.type &&
						r.source.path === refTargetPath),
			)

			if (!rule) {
				const partial = {
					source: row.slug,
					target: target.slug,
					sourcePath: ref.sourcePath,
					targetPath: ref.targetPath,
					role: "REFERENCE" as const,
					origin: "config" as const,
					ruleKey: null,
					referrerSlug: row.slug,
				}
				return [{ id: canvasEdgeId(partial), ...partial }]
			}

			const referrerIsSource =
				rule.source.kind === "resource" &&
				row.type === rule.source.type &&
				rule.source.path === refSourcePath &&
				rule.target.kind === "resource" &&
				target.type === rule.target.type &&
				rule.target.path === refTargetPath

			const partial = {
				source: referrerIsSource ? row.slug : target.slug,
				target: referrerIsSource ? target.slug : row.slug,
				sourcePath: rule.source.path,
				targetPath: rule.target.path,
				role: rule.relationship,
				origin: "config" as const,
				ruleKey: rule.key,
				referrerSlug: row.slug,
			}
			return [{ id: canvasEdgeId(partial), ...partial }]
		}),
	)

	const ruleEdges = resources.flatMap((row): CanvasEdge[] => {
		if (
			!row.identity ||
			typeof row.identity !== "object" ||
			Array.isArray(row.identity)
		) {
			return []
		}
		const typeKey = getResourceTypeKey(row)
		if (!typeKey) return []
		const rules = rulesByTypeKey.get(typeKey) ?? []
		return rules.flatMap((rule): CanvasEdge[] =>
			[
				{ fromEndpoint: rule.source, toEndpoint: rule.target },
				{ fromEndpoint: rule.target, toEndpoint: rule.source },
			].flatMap(({ fromEndpoint, toEndpoint }): CanvasEdge[] => {
				if (
					fromEndpoint.kind !== "resource" ||
					toEndpoint.kind !== "resource" ||
					row.type !== fromEndpoint.type
				) {
					return []
				}
				const values = getResourceIdentityValuesByPath(
					row.identity,
					fromEndpoint.path,
				)
				if (values.length === 0) return []

				return resources.flatMap((candidate): CanvasEdge[] => {
					if (
						candidate.slug === row.slug ||
						candidate.type !== toEndpoint.type ||
						!candidate.identity ||
						typeof candidate.identity !== "object" ||
						Array.isArray(candidate.identity)
					) {
						return []
					}
					const candidateValues = new Set(
						getResourceIdentityValuesByPath(
							candidate.identity,
							toEndpoint.path,
						),
					)
					if (!values.some((v) => candidateValues.has(v))) return []

					const sourceResource = fromEndpoint === rule.source ? row : candidate
					const targetResource = fromEndpoint === rule.source ? candidate : row
					const partial = {
						source: sourceResource.slug,
						target: targetResource.slug,
						sourcePath: rule.source.path,
						targetPath: rule.target.path,
						role: rule.relationship,
						origin: "rule" as const,
						ruleKey: rule.key,
						referrerSlug: row.slug,
					}
					return [{ id: canvasEdgeId(partial), ...partial }]
				})
			}),
		)
	})

	return Array.from(
		new Map(
			[...configEdges, ...ruleEdges].map((edge) => [edge.id, edge]),
		).values(),
	)
}
