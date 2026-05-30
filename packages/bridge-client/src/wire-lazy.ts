// wire-lazy.ts — hand-written Zod schemas for mutually-recursive types, plus
// SchemaAttribute which they depend on. Cannot be codegen'd due to z.lazy().
// wire.generated.ts imports from here; wire.ts re-exports both.
import { z } from "zod"

// SchemaAttribute has no recursive deps — kept here so SchemaBlock can use it
// without a circular import back into wire.generated.ts.
export type SchemaAttribute = {
	type?: unknown | null
	description?: string
	required?: boolean
	optional?: boolean
	computed?: boolean
	sensitive?: boolean
	deprecation_message?: string
}

export const SchemaAttributeSchema = z.object({
	type: z.unknown().nullable().optional(),
	description: z.string().optional(),
	required: z.boolean().optional(),
	optional: z.boolean().optional(),
	computed: z.boolean().optional(),
	sensitive: z.boolean().optional(),
	deprecation_message: z.string().optional(),
})

// TODO: codegen - mutually recursive with SchemaNestedBlock — requires z.lazy()
export type SchemaBlock = {
	attributes?: Record<string, SchemaAttribute>
	block_types?: Record<string, SchemaNestedBlock>
	description?: string
	deprecated?: boolean
	deprecation_message?: string
}

// TODO: codegen - mutually recursive with SchemaBlock — requires z.lazy()
export type SchemaNestedBlock = {
	nesting_mode: "single" | "list" | "set" | "map" | "group"
	block: SchemaBlock
	min_items?: number
	max_items?: number
}

export const SchemaBlockSchema: z.ZodType<SchemaBlock> = z.lazy(() =>
	z.object({
		attributes: z.record(z.string(), SchemaAttributeSchema).optional(),
		block_types: z.record(z.string(), SchemaNestedBlockSchema).optional(),
		description: z.string().optional(),
		deprecated: z.boolean().optional(),
		deprecation_message: z.string().optional(),
	}),
)

export const SchemaNestedBlockSchema: z.ZodType<SchemaNestedBlock> = z.lazy(
	() =>
		z.object({
			nesting_mode: z.enum(["single", "list", "set", "map", "group"]),
			block: SchemaBlockSchema,
			min_items: z.number().optional(),
			max_items: z.number().optional(),
		}),
)
