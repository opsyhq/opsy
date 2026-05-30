import { z } from "zod"
import { createResourceBody, importResourceBody } from "../resources/schemas"

export const changeSetItemKind = z.enum([
	"create_resource",
	"update_resource",
	"delete_resource",
	"import_resource",
])

const changeSetItemSource = z.enum([
	"user",
	"llm",
	"canvas_drag_drop",
	"import",
])

export const createChangeSetBody = z.object({
	title: z.string().min(1).max(200).nullable().optional(),
})

const targetResourceFields = {
	targetResourceId: z.uuid().nullable().optional(),
	targetResourceSlug: z.string().min(1).max(64).nullable().optional(),
}

const positionShape = z.object({ x: z.number(), y: z.number() })

export const stagedCreateResourceChanges = z.intersection(
	createResourceBody,
	z.object({ position: positionShape.optional() }),
)

export const stagedImportResourceChanges = z.intersection(
	importResourceBody,
	z.object({ position: positionShape.optional() }),
)

export const stagedUpdateResourceChanges = z.object({
	inputs: z.record(z.string(), z.unknown()),
})

export const deleteResourceChanges = z
	.object({
		mode: z.enum(["delete", "forget"]).default("delete"),
	})
	.default({ mode: "delete" })

export type CreateResourceChanges = z.infer<typeof stagedCreateResourceChanges>
export type ImportResourceChanges = z.infer<typeof stagedImportResourceChanges>
export type UpdateResourceChanges = z.infer<typeof stagedUpdateResourceChanges>
export type DeleteResourceChanges = z.infer<typeof deleteResourceChanges>

// The jsonb `changes` column carries one of four shapes; the row's `kind`
// column is the discriminator. The row-level discriminated union (in
// db/schema/index.ts) correlates `kind` with the matching shape so readers
// narrow `item.changes` from `item.kind` without runtime parsing.
export type ChangeSetItemChanges =
	| CreateResourceChanges
	| ImportResourceChanges
	| UpdateResourceChanges
	| DeleteResourceChanges

const createResourceChangeItem = z.object({
	kind: z.literal("create_resource"),
	source: changeSetItemSource.optional(),
	changes: stagedCreateResourceChanges,
})

const updateResourceChangeItem = z.object({
	kind: z.literal("update_resource"),
	source: changeSetItemSource.optional(),
	changes: stagedUpdateResourceChanges,
	...targetResourceFields,
})

const deleteResourceChangeItem = z.object({
	kind: z.literal("delete_resource"),
	source: changeSetItemSource.optional(),
	changes: deleteResourceChanges,
	...targetResourceFields,
})

const importResourceChangeItem = z.object({
	kind: z.literal("import_resource"),
	source: changeSetItemSource.optional(),
	changes: stagedImportResourceChanges,
})

export const addChangeSetItemBody = z.discriminatedUnion("kind", [
	createResourceChangeItem,
	updateResourceChangeItem,
	deleteResourceChangeItem,
	importResourceChangeItem,
])

// Each update variant fixes the `kind` so `changes` narrows to the matching
// shape — no z.unknown(). The route validates, the service trusts the
// discriminator and merges branch-by-branch onto the existing row. The partial
// shapes are spelled out directly because the staged*Changes schemas use
// `z.intersection` / `z.refine` and don't expose `.partial()`.
const partialCreateResourceChanges = z
	.object({
		slug: z.string().min(1).max(64),
		type: z.string().min(1).max(128),
		integrationSlug: z.string().min(1).max(64),
		displayName: z.string().min(1).max(120),
		inputs: z.record(z.string(), z.unknown()),
		position: positionShape,
	})
	.partial()

const partialImportResourceChanges = z
	.object({
		slug: z.string().min(1).max(64),
		type: z.string().min(1).max(128),
		integrationSlug: z.string().min(1).max(64),
		providerId: z.string().min(1),
		identity: z.record(z.string(), z.string()),
		position: positionShape,
	})
	.partial()

const partialUpdateResourceChanges = z
	.object({ inputs: z.record(z.string(), z.unknown()) })
	.partial()

const partialDeleteResourceChanges = z
	.object({ mode: z.enum(["delete", "forget"]) })
	.partial()

const updateCreateResourceItem = z.object({
	kind: z.literal("create_resource"),
	source: changeSetItemSource.optional(),
	changes: partialCreateResourceChanges.optional(),
})

const updateUpdateResourceItem = z.object({
	kind: z.literal("update_resource"),
	source: changeSetItemSource.optional(),
	changes: partialUpdateResourceChanges.optional(),
	...targetResourceFields,
})

const updateDeleteResourceItem = z.object({
	kind: z.literal("delete_resource"),
	source: changeSetItemSource.optional(),
	changes: partialDeleteResourceChanges.optional(),
	...targetResourceFields,
})

const updateImportResourceItem = z.object({
	kind: z.literal("import_resource"),
	source: changeSetItemSource.optional(),
	changes: partialImportResourceChanges.optional(),
})

export const updateChangeSetItemBody = z
	.discriminatedUnion("kind", [
		updateCreateResourceItem,
		updateUpdateResourceItem,
		updateDeleteResourceItem,
		updateImportResourceItem,
	])
	.refine(
		(v) => {
			const { kind: _kind, ...rest } = v
			return Object.keys(rest).length > 0
		},
		{ message: "must provide at least one field" },
	)

export const changeSetIdParam = z.object({
	project: z.string().min(1),
	id: z.uuid(),
})
export const changeSetItemIdParam = z.object({
	project: z.string().min(1),
	id: z.uuid(),
	itemId: z.uuid(),
})

export type AddChangeSetItemBody = z.infer<typeof addChangeSetItemBody>
export type UpdateChangeSetItemBody = z.infer<typeof updateChangeSetItemBody>
