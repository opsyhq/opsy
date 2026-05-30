import { RefError } from "./errors"

// Wire format for a cross-resource reference. `$ref` is `<slug>.<dot-path>` —
// e.g. `{"$ref": "vpc.id"}` or `{"$ref": "cert.domainValidationOptions[0].resourceRecordName"}`.
// The structural object form was chosen over `${slug.path}` string sigils so
// resolution can't collide with provider-native syntax (IAM policy variables,
// CloudFormation Fn::Sub, bash in user_data, etc.).
// Slug is lowercase + digits + hyphens (matches the slug column constraint);
// path segments allow alphanumerics + underscores so camelCase provider
// outputs (domainValidationOptions) and snake_case ones (domain_name) both
// work; array indices are `[N]`.
export const REF_PATH_REGEX = /^[a-z0-9-]+(\.[a-zA-Z0-9_]+(\[\d+\])*)+$/

interface RefNode {
	$ref: string
}

interface ParsedRef {
	slug: string
	path: string
}

export type RefTarget =
	| { slug: string; ok: true; state: Record<string, unknown> }
	| { slug: string; ok: false; reason: "not_ready" | "missing" }

export function isRefNode(value: unknown): value is RefNode {
	return (
		typeof value === "object" &&
		value !== null &&
		!Array.isArray(value) &&
		"$ref" in value &&
		typeof (value as { $ref: unknown }).$ref === "string"
	)
}

export function parseRef(ref: string): ParsedRef {
	if (!REF_PATH_REGEX.test(ref)) {
		throw new RefError(
			"ref_invalid",
			"",
			`invalid $ref "${ref}" — expected "<slug>.<dot.path>"`,
		)
	}
	const dot = ref.indexOf(".")
	return { slug: ref.slice(0, dot), path: ref.slice(dot + 1) }
}

function* pathSegments(path: string): Generator<string | number> {
	for (const seg of path.split(".")) {
		const open = seg.indexOf("[")
		if (open === -1) {
			yield seg
			continue
		}
		yield seg.slice(0, open)
		for (const m of seg.slice(open).matchAll(/\[(\d+)\]/g)) yield Number(m[1])
	}
}

export function getAt(obj: unknown, path: string): unknown {
	let cur: unknown = obj
	for (const key of pathSegments(path)) {
		if (cur == null) return undefined
		if (typeof key === "number") {
			if (!Array.isArray(cur)) return undefined
			cur = cur[key]
		} else {
			if (typeof cur !== "object") return undefined
			cur = (cur as Record<string, unknown>)[key]
		}
	}
	return cur
}

// Validation happens here so transforms only see parsed `{slug, path}`.
export function mapRefs(
	value: unknown,
	transform: (ref: ParsedRef) => unknown,
): unknown {
	if (Array.isArray(value)) return value.map((v) => mapRefs(v, transform))
	if (isRefNode(value)) return transform(parseRef(value.$ref))
	if (value !== null && typeof value === "object") {
		const out: Record<string, unknown> = {}
		for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
			out[k] = mapRefs(v, transform)
		}
		return out
	}
	return value
}

export function extractRefs(value: unknown): string[] {
	const slugs = new Set<string>()
	mapRefs(value, (r) => {
		slugs.add(r.slug)
		return undefined
	})
	return [...slugs]
}

export function substituteRefs(
	value: unknown,
	targets: Map<string, RefTarget>,
): unknown {
	return mapRefs(value, (ref) => {
		const t = targets.get(ref.slug)
		if (!t) {
			throw new RefError(
				"ref_not_found",
				ref.slug,
				`resource "${ref.slug}" does not exist in this project`,
			)
		}
		if (!t.ok) {
			if (t.reason === "missing") {
				throw new RefError(
					"ref_target_missing",
					ref.slug,
					`resource "${ref.slug}" no longer exists in the cloud — refresh or re-create it before referencing`,
				)
			}
			throw new RefError(
				"ref_not_ready",
				ref.slug,
				`resource "${ref.slug}" not live yet — cannot resolve $ref`,
			)
		}
		const resolved = getAt(t.state, ref.path)
		if (resolved === undefined) {
			throw new RefError(
				"ref_path_missing",
				ref.slug,
				`"${ref.path}" not found on resource "${ref.slug}" outputs`,
			)
		}
		return resolved
	})
}
