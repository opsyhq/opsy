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

export type ThinkingBlockModelCallStatus = "success" | "error"

export type ThinkingBlockModelCallRole = "generate" | "judge"

export type ThinkingBlockModelCallValidatorType = "check" | "model"

export const thinkingBlockModelCalls = pgTable(
	"thinking_block_model_calls",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		thinkingBlockRunId: uuid("thinking_block_run_id").references(
			() => thinkingBlockRuns.id,
			{ onDelete: "set null" },
		),
		operationId: text("operation_id"),
		attempt: integer("attempt").notNull().default(0),
		stepIndex: integer("step_index").notNull().default(0),
		role: text("role")
			.$type<ThinkingBlockModelCallRole>()
			.notNull()
			.default("generate"),
		blockName: text("block_name").notNull(),
		provider: text("provider").notNull(),
		model: text("model").notNull(),
		responseModel: text("response_model"),
		status: text("status").$type<ThinkingBlockModelCallStatus>().notNull(),
		artifactType: text("artifact_type"),
		artifactId: uuid("artifact_id"),
		metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull(),
		input: jsonb("input").$type<Record<string, unknown>>().notNull(),
		instructions: text("instructions"),
		instructionsHash: text("instructions_hash"),
		output: jsonb("output").$type<Record<string, unknown>>(),
		error: jsonb("error").$type<Record<string, unknown>>(),
		validatorId: text("validator_id"),
		validatorType:
			text("validator_type").$type<ThinkingBlockModelCallValidatorType>(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(t) => [
		index("thinking_block_model_calls_block_created_at_idx").on(
			t.blockName,
			t.createdAt,
		),
		index("thinking_block_model_calls_run_step_idx").on(
			t.thinkingBlockRunId,
			t.stepIndex,
		),
		index("thinking_block_model_calls_role_created_at_idx").on(
			t.role,
			t.createdAt,
		),
		index("thinking_block_model_calls_operation_attempt_idx").on(
			t.thinkingBlockRunId,
			t.operationId,
			t.attempt,
		),
	],
)
