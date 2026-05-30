import {
	index,
	integer,
	jsonb,
	pgTable,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core"
import { thinkingBlockRuns } from "./thinkingBlocks"

export type ThinkingBlockValidationType = "check" | "model"
export type ThinkingBlockValidationStatus = "pass" | "fail"

export const thinkingBlockValidationResults = pgTable(
	"thinking_block_validation_results",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		thinkingBlockRunId: uuid("thinking_block_run_id").references(
			() => thinkingBlockRuns.id,
			{ onDelete: "set null" },
		),
		operationId: text("operation_id"),
		attempt: integer("attempt").notNull().default(0),
		validatorId: text("validator_id").notNull(),
		validatorType: text("validator_type")
			.$type<ThinkingBlockValidationType>()
			.notNull(),
		status: text("status").$type<ThinkingBlockValidationStatus>().notNull(),
		feedback: jsonb("feedback"),
		metadata: jsonb("metadata")
			.$type<Record<string, unknown>>()
			.notNull()
			.default({}),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(t) => [
		index("thinking_block_validation_results_run_idx").on(t.thinkingBlockRunId),
		index("thinking_block_validation_results_operation_attempt_idx").on(
			t.thinkingBlockRunId,
			t.operationId,
			t.attempt,
		),
	],
)
