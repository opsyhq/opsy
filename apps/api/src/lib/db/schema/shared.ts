import { pgEnum, timestamp, uuid } from "drizzle-orm/pg-core"

// Enums
export const actorTypeEnum = pgEnum("actor_type", ["user", "api_key", "system"])
export const changeSetStatusEnum = pgEnum("change_set_status", [
	"draft",
	"applying",
	"applied",
	"discarded",
	"canceled",
])

export const changeSetItemKindEnum = pgEnum("change_set_item_kind", [
	"create_resource",
	"update_resource",
	"delete_resource",
	"import_resource",
])

export const changeSetItemSourceEnum = pgEnum("change_set_item_source", [
	"user",
	"llm",
	"canvas_drag_drop",
	"import",
])

export const resourceDryRunActionEnum = pgEnum("resource_dry_run_action", [
	"pending",
	"noop",
	"create",
	"update",
	"delete",
	"replace",
	"deferred",
	"error",
])

export const operationKindEnum = pgEnum("operation_kind", [
	"create",
	"update",
	"delete",
	"import",
	"read",
	"lookup",
	"scan",
])

export const resourceStatusEnum = pgEnum("resource_status", [
	"creating",
	"importing",
	"updating",
	"deleting",
	"live",
	"missing",
])

export const operationStatusEnum = pgEnum("operation_status", [
	"pending",
	"running",
	"awaiting_approval",
	"canceling",
	"succeeded",
	"failed",
	"canceled",
])

export const scanIntervalEnum = pgEnum("scan_interval", [
	"off",
	"hourly",
	"daily",
])

// Column spreads
export const timestamps = {
	createdAt: timestamp("created_at", { withTimezone: true })
		.defaultNow()
		.notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true })
		.defaultNow()
		.notNull()
		.$onUpdateFn(() => new Date()),
}

export const softDelete = {
	deletedAt: timestamp("deleted_at", { withTimezone: true }),
}

// Actor ref column spreads — named variants (no generic function, preserves TS inference)
export const createdByActor = {
	createdByType: actorTypeEnum("created_by_type").notNull(),
	createdById: uuid("created_by_id").notNull(),
}

export const approvedByActor = {
	approvedByType: actorTypeEnum("approved_by_type"),
	approvedById: uuid("approved_by_id"),
}

export const actorColumns = {
	actorType: actorTypeEnum("actor_type").notNull(),
	actorId: uuid("actor_id").notNull(),
}
