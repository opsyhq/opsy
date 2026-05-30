import { type AnyColumn, relations, sql, type SQL } from "drizzle-orm"
import {
	index,
	jsonb,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core"
import type { ChangeSetItemChanges } from "@/changesets/schemas"
import { operations } from "./operations"
import { integrations, projects } from "./projects"
import { resourceDryRuns } from "./resource-dry-runs"
import { resources } from "./resources"
import {
	actorColumns,
	changeSetItemKindEnum,
	changeSetItemSourceEnum,
	changeSetStatusEnum,
	timestamps,
} from "./shared"

export const changeSets = pgTable(
	"change_sets",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		projectId: uuid("project_id")
			.notNull()
			.references(() => projects.id),
		status: changeSetStatusEnum("status").notNull().default("draft"),
		title: text("title"),
		...actorColumns,
		appliedAt: timestamp("applied_at", { withTimezone: true }),
		...timestamps,
	},
	(t) => [
		index("change_sets_project_status_idx").on(t.projectId, t.status),
		index("change_sets_project_created_at_idx").on(t.projectId, t.createdAt),
		uniqueIndex("change_sets_project_draft_unique")
			.on(t.projectId)
			.where(sql`${t.status} = 'draft'`),
	],
)

// `changes` is jsonb with a discriminated union $type. Drizzle can't express a
// per-variant projection of the union, so reads that pivot on the embedded
// `slug` (only present on create_resource / import_resource) go through this
// accessor. Single call site keeps the SQL snippet from drifting across
// callers; the typed return reflects that the field is absent on update /
// delete variants.
export const changeSetItemSlugFromChanges = (
	column: AnyColumn,
): SQL<string | null> => sql<string | null>`${column}->>'slug'`

export const changeSetItems = pgTable(
	"change_set_items",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		changeSetId: uuid("change_set_id")
			.notNull()
			.references(() => changeSets.id),
		kind: changeSetItemKindEnum("kind").notNull(),
		targetResourceId: uuid("target_resource_id").references(() => resources.id),
		targetResourceSlug: text("target_resource_slug"),
		integrationId: uuid("integration_id").references(() => integrations.id),
		resourceType: text("resource_type"),
		changes: jsonb("changes").$type<ChangeSetItemChanges>().notNull(),
		source: changeSetItemSourceEnum("source").notNull().default("user"),
		dependsOn: text("depends_on").array().notNull().default(sql`'{}'`),
		...timestamps,
	},
	(t) => [
		index("change_set_items_change_set_idx").on(t.changeSetId),
		index("change_set_items_target_resource_idx").on(t.targetResourceId),
		index("change_set_items_depends_on_gin").using("gin", t.dependsOn),
	],
)

export const changeSetsRelations = relations(changeSets, ({ one, many }) => ({
	project: one(projects, {
		fields: [changeSets.projectId],
		references: [projects.id],
	}),
	items: many(changeSetItems),
}))

export const changeSetItemsRelations = relations(
	changeSetItems,
	({ one, many }) => ({
		changeSet: one(changeSets, {
			fields: [changeSetItems.changeSetId],
			references: [changeSets.id],
		}),
		targetResource: one(resources, {
			fields: [changeSetItems.targetResourceId],
			references: [resources.id],
		}),
		integration: one(integrations, {
			fields: [changeSetItems.integrationId],
			references: [integrations.id],
		}),
		operations: many(operations),
		dryRun: one(resourceDryRuns, {
			fields: [changeSetItems.id],
			references: [resourceDryRuns.changeSetItemId],
		}),
	}),
)
