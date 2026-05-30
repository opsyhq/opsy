import type { State } from "@opsy/provider"
import { relations } from "drizzle-orm"
import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"
import { changeSetItems } from "./changesets"
import { resourceDryRunActionEnum } from "./shared"

export const resourceDryRuns = pgTable("resource_dry_runs", {
	changeSetItemId: uuid("change_set_item_id")
		.primaryKey()
		.references(() => changeSetItems.id, { onDelete: "cascade" }),
	action: resourceDryRunActionEnum("action").notNull(),
	priorState: jsonb("prior_state").$type<State | null>(),
	plannedState: jsonb("planned_state").$type<State | null>(),
	plannedPrivate: text("planned_private"),
	requiresReplace: jsonb("requires_replace").$type<string[][] | null>(),
	error: jsonb("error").$type<{ message: string } | null>(),
	updatedAt: timestamp("updated_at", { withTimezone: true })
		.defaultNow()
		.notNull()
		.$onUpdateFn(() => new Date()),
})

export const resourceDryRunsRelations = relations(
	resourceDryRuns,
	({ one }) => ({
		changeSetItem: one(changeSetItems, {
			fields: [resourceDryRuns.changeSetItemId],
			references: [changeSetItems.id],
		}),
	}),
)
