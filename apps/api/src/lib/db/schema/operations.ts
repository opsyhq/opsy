import { relations, sql } from "drizzle-orm"
import {
	type AnyPgColumn,
	index,
	jsonb,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core"
import type {
	OperationApproval,
	OperationError,
} from "../../../operations/schemas"
import { changeSetItems } from "./changesets"
import { projects } from "./projects"
import { resources } from "./resources"
import {
	actorColumns,
	operationKindEnum,
	operationStatusEnum,
	timestamps,
} from "./shared"

export const operations = pgTable(
	"operations",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		projectId: uuid("project_id")
			.notNull()
			.references(() => projects.id),
		resourceId: uuid("resource_id").references(() => resources.id),
		// Operations are the audit trail of apply attempts and outlive the
		// changeset item that spawned them: removing a staged item (e.g. to
		// fix it after a failed resumable-retry apply) must not be blocked by,
		// or destroy, that history — so detach rather than restrict/cascade.
		changeSetItemId: uuid("change_set_item_id").references(
			() => changeSetItems.id,
			{ onDelete: "set null" },
		),
		retryOfOperationId: uuid("retry_of_operation_id").references(
			(): AnyPgColumn => operations.id,
		),
		workflowRunId: text("workflow_run_id"),
		lockKey: text("lock_key"),
		kind: operationKindEnum("kind").notNull(),
		status: operationStatusEnum("status").notNull().default("pending"),
		...actorColumns,
		request: jsonb("request").$type<Record<string, unknown>>().notNull(),
		result: jsonb("result").$type<Record<string, unknown> | null>(),
		error: jsonb("error").$type<OperationError | null>(),
		approval: jsonb("approval").$type<OperationApproval | null>(),
		closedAt: timestamp("closed_at", { withTimezone: true }),
		...timestamps,
	},
	(t) => [
		index("operations_project_created_at_idx").on(t.projectId, t.createdAt),
		index("operations_project_status_idx").on(t.projectId, t.status),
		index("operations_resource_id_idx").on(t.resourceId),
		index("operations_change_set_item_idx").on(t.changeSetItemId),
		index("operations_retry_of_idx").on(t.retryOfOperationId),
		index("operations_workflow_run_idx").on(t.workflowRunId),
		uniqueIndex("operations_open_lock_unique")
			.on(t.projectId, t.lockKey)
			.where(
				sql`${t.lockKey} IS NOT NULL AND ${t.status} IN ('pending', 'running', 'awaiting_approval', 'canceling')`,
			),
	],
)

export const operationsRelations = relations(operations, ({ one, many }) => ({
	project: one(projects, {
		fields: [operations.projectId],
		references: [projects.id],
	}),
	resource: one(resources, {
		fields: [operations.resourceId],
		references: [resources.id],
	}),
	changeSetItem: one(changeSetItems, {
		fields: [operations.changeSetItemId],
		references: [changeSetItems.id],
	}),
	retryOfOperation: one(operations, {
		fields: [operations.retryOfOperationId],
		references: [operations.id],
		relationName: "operation_retries",
	}),
	retries: many(operations, { relationName: "operation_retries" }),
}))
