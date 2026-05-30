import { and, eq, inArray, isNull } from "drizzle-orm"
import { db } from "../lib/db/client"
import { resources } from "../lib/db/schema"
import {
	extractRefs,
	parseRef,
	type RefTarget,
	substituteRefs,
} from "../lib/refs/ast"
import { type LookupBody, resourceSelector } from "./schemas"

export type ResourceReference = {
	sourcePath: string
	targetSlug: string
	targetPath: string
}

export function getResourceReferences(
	value: unknown,
	path = "",
): ResourceReference[] {
	if (Array.isArray(value)) {
		return value.flatMap((item, index) =>
			getResourceReferences(item, `${path}[${index}]`),
		)
	}
	if (!value || typeof value !== "object") return []
	const ref = Reflect.get(value, "$ref")
	if (typeof ref === "string") {
		try {
			const parsed = parseRef(ref)
			return [
				{
					sourcePath: path,
					targetSlug: parsed.slug,
					targetPath: parsed.path,
				},
			]
		} catch {
			return []
		}
	}
	return Object.entries(value).flatMap(([key, child]) =>
		getResourceReferences(child, path ? `${path}.${key}` : key),
	)
}

// Resolves `$ref` targets from `resources.outputs` — the last-known cloud
// snapshot maintained by the read workflow. The live provider Read lives in
// that workflow alone; refs consume the persisted snapshot rather than firing
// a fresh provider call per substitution. Slugs with no outputs report
// `not_ready`, ones whose lifecycle settled on `missing` report `missing`, and
// unknown slugs surface as `ref_not_found` from `substituteRefs`.
export async function getReferenceTargetsBySlug(
	projectId: string,
	slugs: string[],
): Promise<Map<string, RefTarget>> {
	"use step"

	if (slugs.length === 0) return new Map()
	const rows = await db.query.resources.findMany({
		where: and(
			eq(resources.projectId, projectId),
			inArray(resources.slug, slugs),
			isNull(resources.deletedAt),
		),
		columns: { slug: true, outputs: true, status: true },
	})

	const targets = new Map<string, RefTarget>()
	for (const row of rows) {
		if (row.status === "missing") {
			targets.set(row.slug, {
				slug: row.slug,
				ok: false,
				reason: "missing",
			})
			continue
		}
		if (!row.outputs) {
			targets.set(row.slug, {
				slug: row.slug,
				ok: false,
				reason: "not_ready",
			})
			continue
		}
		targets.set(row.slug, { slug: row.slug, ok: true, state: row.outputs })
	}
	return targets
}

export async function getValueWithResourceRefs(
	value: unknown,
	projectId: string,
): Promise<unknown> {
	"use step"
	const slugs = extractRefs(value)
	if (slugs.length === 0) return value
	const targets = await getReferenceTargetsBySlug(projectId, slugs)
	return substituteRefs(value, targets)
}

export async function getSelectorWithResourceRefs(
	selector: LookupBody["selector"],
	projectId: string,
): Promise<LookupBody["selector"]> {
	"use step"

	if (!selector) return {}
	const slugs = extractRefs(selector)
	const resolved =
		slugs.length === 0
			? selector
			: substituteRefs(
					selector,
					await getReferenceTargetsBySlug(projectId, slugs),
				)
	return resourceSelector.parse(resolved)
}
