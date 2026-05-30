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
import { timestamps } from "./shared"

export type ThinkingBlockArtifactStatus =
	| "pending"
	| "running"
	| "ready"
	| "rejected"
	| "failed"
	| "superseded"

export const thinkingBlockArtifacts = pgTable(
	"thinking_block_artifacts",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		blockName: text("block_name").notNull(),
		blockVersion: text("block_version").notNull().default("v1"),
		identityKey: text("identity_key").notNull(),
		input: jsonb("input").notNull(),
		status: text("status").$type<ThinkingBlockArtifactStatus>().notNull(),
		output: jsonb("output"),
		rejection: jsonb("rejection"),
		error: jsonb("error").$type<Record<string, unknown>>(),
		phase: text("phase"),
		phaseLabel: text("phase_label"),
		phaseAt: timestamp("phase_at", { withTimezone: true }),
		supersededBy: uuid("superseded_by").references(
			(): AnyPgColumn => thinkingBlockArtifacts.id,
			{ onDelete: "set null" },
		),
		supersededAt: timestamp("superseded_at", { withTimezone: true }),
		readyAt: timestamp("ready_at", { withTimezone: true }),
		...timestamps,
	},
	(t) => [
		uniqueIndex("thinking_block_artifacts_ready_unique")
			.on(t.blockName, t.blockVersion, t.identityKey)
			.where(sql`${t.status} = 'ready'`),
		index("thinking_block_artifacts_lookup_idx").on(
			t.blockName,
			t.blockVersion,
			t.identityKey,
			t.status,
		),
		index("thinking_block_artifacts_claim_idx").on(
			t.blockName,
			t.blockVersion,
			t.status,
			t.updatedAt,
			t.createdAt,
		),
	],
)

export const thinkingBlockArtifactsRelations = relations(
	thinkingBlockArtifacts,
	({ one }) => ({
		supersededByArtifact: one(thinkingBlockArtifacts, {
			fields: [thinkingBlockArtifacts.supersededBy],
			references: [thinkingBlockArtifacts.id],
			relationName: "thinking_block_artifact_supersession",
		}),
	}),
)
