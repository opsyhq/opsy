import { sql } from "drizzle-orm"
import { boolean, jsonb, pgTable, uniqueIndex, uuid } from "drizzle-orm/pg-core"
import { resources } from "./resources"
import { timestamps } from "./shared"

export const resourceLayouts = pgTable(
	"resource_layouts",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		resourceId: uuid("resource_id")
			.notNull()
			.references(() => resources.id, { onDelete: "cascade" }),
		viewId: uuid("view_id"),
		position: jsonb("position").$type<{ x: number; y: number } | null>(),
		size: jsonb("size").$type<{ w: number; h: number } | null>(),
		collapsed: boolean("collapsed").notNull().default(false),
		...timestamps,
	},
	(t) => [
		// Postgres treats NULL as distinct in unique indexes by default, so a
		// plain UNIQUE (resource_id, view_id) lets unlimited rows accumulate
		// when view_id IS NULL. Two partial indexes give us the right semantics
		// without depending on Drizzle's nullsNotDistinct (not available here).
		uniqueIndex("resource_layouts_resource_null_view_unique")
			.on(t.resourceId)
			.where(sql`${t.viewId} IS NULL`),
		uniqueIndex("resource_layouts_resource_view_unique")
			.on(t.resourceId, t.viewId)
			.where(sql`${t.viewId} IS NOT NULL`),
	],
)
