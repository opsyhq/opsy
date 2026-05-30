import {
	index,
	integer,
	jsonb,
	pgTable,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core"
import { timestamps } from "./shared"
import { thinkingBlockArtifacts } from "./thinkingBlockArtifacts"

export type ThinkingBlockRunStatus =
	| "running"
	| "success"
	| "rejected"
	| "failed"

export const thinkingBlockRuns = pgTable(
	"thinking_block_runs",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		thinkingBlockArtifactId: uuid("thinking_block_artifact_id").references(
			() => thinkingBlockArtifacts.id,
			{ onDelete: "cascade" },
		),
		blockName: text("block_name").notNull(),
		status: text("status").$type<ThinkingBlockRunStatus>().notNull(),
		trigger: text("trigger"),
		rejectionReason: text("rejection_reason"),
		rejection: jsonb("rejection").$type<Record<string, unknown>>(),
		metadata: jsonb("metadata")
			.$type<Record<string, unknown>>()
			.notNull()
			.default({}),
		error: jsonb("error").$type<Record<string, unknown>>(),
		startedAt: timestamp("started_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		finishedAt: timestamp("finished_at", { withTimezone: true }),
		durationMs: integer("duration_ms"),
		...timestamps,
	},
	(t) => [
		index("thinking_block_runs_block_created_at_idx").on(
			t.blockName,
			t.createdAt,
		),
		index("thinking_block_runs_artifact_idx").on(t.thinkingBlockArtifactId),
	],
)
