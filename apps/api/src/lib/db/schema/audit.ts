import { relations } from "drizzle-orm"
import {
	index,
	jsonb,
	pgTable,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core"
import { organization } from "./auth"
import { projects } from "./projects"
import { actorColumns } from "./shared"

export const auditEvents = pgTable(
	"audit_events",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		orgId: uuid("org_id")
			.notNull()
			.references(() => organization.id),
		projectId: uuid("project_id").references(() => projects.id),
		...actorColumns,
		action: text("action").notNull(),
		entityType: text("entity_type").notNull(),
		entityId: text("entity_id").notNull(),
		metadata: jsonb("metadata").$type<Record<string, unknown>>(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(t) => [
		index("audit_events_org_created_at_idx").on(t.orgId, t.createdAt),
		index("audit_events_project_created_at_idx").on(t.projectId, t.createdAt),
		index("audit_events_entity_idx").on(t.entityType, t.entityId),
	],
)

// Relations
export const auditEventsRelations = relations(auditEvents, ({ one }) => ({
	org: one(organization, {
		fields: [auditEvents.orgId],
		references: [organization.id],
	}),
	project: one(projects, {
		fields: [auditEvents.projectId],
		references: [projects.id],
	}),
}))
