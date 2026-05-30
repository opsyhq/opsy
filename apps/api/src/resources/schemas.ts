import { z } from "zod"

const resourceSlug = z
	.string()
	.min(1)
	.max(64)
	.regex(/^[a-z0-9-]+$/, "slug must be lowercase letters, digits, and hyphens")

const tfType = z.string().min(1).max(128)

export const resourceState = z.record(z.string(), z.unknown())
// Data-source lookup filter. Still used to validate `$ref`-inlined selectors
// (`references.ts`) and the one-shot `/data/query` lookup; data sources
// themselves are a separate domain (`data-sources/schemas.ts`).
export const resourceSelector = z.record(z.string(), z.unknown())

const integrationSlug = z
	.string()
	.min(1)
	.max(64)
	.regex(/^[a-z0-9-]+$/)

const canvasPosition = z.object({ x: z.number(), y: z.number() })

// POST /projects/:project/resources — create a managed resource row. Either
// provider-backed (carries `type` + `inputs`) or an empty placeholder (slug
// only; provider/type wired in later via update). Data sources are NOT created
// here — they are a separate synchronous domain.
const createResourceCommon = {
	slug: resourceSlug,
	// Optional friendly name for UI listings. Persists to resources.metadata.displayName.
	displayName: z.string().min(1).max(120).optional(),
	// Initial canvas position. Written to resource_layouts in the same step as
	// the resources row so the canvas never sees a position-less resource.
	position: canvasPosition.optional(),
}

const createProviderResourceBase = {
	...createResourceCommon,
	type: tfType,
	// Optional slug selecting which of the project's integrations for this
	// type's provider to use. Defaults to "default" server-side. The first
	// integration in a project for a given provider conventionally uses the
	// "default" slug; additional integrations need an explicit slug here.
	integrationSlug: integrationSlug.optional(),
}

export const createProviderResourceBody = z.object({
	...createProviderResourceBase,
	inputs: resourceState,
})

export const createEmptyResourceBody = z.object({
	...createResourceCommon,
	type: z.undefined().optional(),
	inputs: z.undefined().optional(),
	integrationSlug: z.undefined().optional(),
})

export const createResourceBody = z.union([
	createProviderResourceBody,
	createEmptyResourceBody,
])

// POST /projects/:project/resources/lookup — one-off stateless data source
// read. Maps to an Operation(kind=lookup). No row is written — lookup is the
// one-shot sibling of a data source read.
export const lookupBody = z.object({
	type: tfType,
	integrationSlug: integrationSlug.optional(),
	selector: resourceSelector,
})

// PATCH /projects/:project/resources/:slug — update desired inputs for a
// managed resource → Operation(kind=update) + apply.
export const updateResourceBody = z.object({
	inputs: resourceState,
})

// An import is either import-id mode (a raw `terraform import` ID) or
// identity mode (each structured identity attribute by name, as the raw
// strings the user typed). Exactly one must be supplied — they are mutually
// exclusive on Terraform's ImportResourceState RPC. The bridge owns the
// cached identity schema and coerces the identity strings to their wire
// types, so the values stay untyped here.
export const importResourceBody = z
	.object({
		slug: resourceSlug,
		type: tfType,
		integrationSlug: integrationSlug.optional(),
		providerId: z.string().min(1).optional(),
		identity: z.record(z.string(), z.string()).optional(),
		position: canvasPosition.optional(),
	})
	.refine(
		(b) =>
			(b.providerId !== undefined) !==
			(b.identity !== undefined && Object.keys(b.identity).length > 0),
		{ message: "provide exactly one of providerId or a non-empty identity" },
	)

// PATCH /projects/:project/resources/:slug/layout — persist canvas position/size.
// Bypasses operations: layout is shared UI preference, not a
// "unit of work" in the data model.
const positionShape = z.object({ x: z.number(), y: z.number() }).nullable()
const sizeShape = z
	.object({ w: z.number(), h: z.number() })
	.nullable()
	.optional()

export const resourceLayoutBody = z.object({
	position: positionShape.optional(),
	size: sizeShape,
	collapsed: z.boolean().optional(),
})

export const bulkResourceLayoutBody = z.object({
	layouts: z.array(
		z.object({
			slug: resourceSlug,
			position: positionShape.optional(),
			size: sizeShape,
			collapsed: z.boolean().optional(),
		}),
	),
})

export type CreateResourceBody = z.infer<typeof createResourceBody>
export type CreateProviderResourceBody = z.infer<
	typeof createProviderResourceBody
>
export type CreateEmptyResourceBody = z.infer<typeof createEmptyResourceBody>
export type UpdateResourceBody = z.infer<typeof updateResourceBody>
export type LookupBody = z.infer<typeof lookupBody>
export type ImportResourceBody = z.infer<typeof importResourceBody>
export type ResourceLayoutBody = z.infer<typeof resourceLayoutBody>
export type BulkResourceLayoutBody = z.infer<typeof bulkResourceLayoutBody>

// Workflow request shapes. These are constructed inside the resource service
// (not parsed from HTTP bodies — the delete/read routes take no JSON body), so
// they live as TS types rather than Zod schemas.
export type ReadResourceRequest = { slug: string }
export type DeleteResourceRequest = { slug: string; mode: "delete" | "forget" }
