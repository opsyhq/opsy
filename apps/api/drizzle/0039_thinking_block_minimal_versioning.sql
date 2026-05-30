ALTER TABLE "thinking_block_artifacts" RENAME COLUMN "identity_hash" TO "identity_key";--> statement-breakpoint
DROP INDEX IF EXISTS "thinking_block_artifacts_ready_unique";--> statement-breakpoint
DROP INDEX IF EXISTS "thinking_block_artifacts_lookup_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "thinking_block_artifacts_claim_idx";--> statement-breakpoint
ALTER TABLE "thinking_block_artifacts" ADD COLUMN "block_version" text DEFAULT 'v1' NOT NULL;--> statement-breakpoint
ALTER TABLE "thinking_block_model_calls" ADD COLUMN "instructions" text;--> statement-breakpoint
ALTER TABLE "thinking_block_model_calls" ADD COLUMN "instructions_hash" text;--> statement-breakpoint
UPDATE "thinking_block_artifacts"
SET "identity_key" = concat_ws(
	':',
	"identity_labels"->>'provider',
	"identity_labels"->>'resourceKind',
	"identity_labels"->>'resourceType',
	"identity_labels"->>'schemaHash'
)
WHERE "block_name" IN (
	'resource-type-metadata',
	'resource-field-metadata',
	'resource-relationship-rules'
)
	AND "identity_labels" ? 'provider'
	AND "identity_labels" ? 'resourceKind'
	AND "identity_labels" ? 'resourceType'
	AND "identity_labels" ? 'schemaHash';--> statement-breakpoint
UPDATE "thinking_block_artifacts"
SET "identity_key" = regexp_replace("identity_key", '^[^:]+:', '')
WHERE "block_name" IN (
	'resource-type-metadata',
	'resource-field-metadata',
	'resource-relationship-rules'
)
	AND "identity_key" ~ '^[^:]+:[^:]+:(resource|data):[^:]+:[0-9a-f]{64}$';--> statement-breakpoint
WITH ranked_ready AS (
	SELECT
		"id",
		first_value("id") OVER (
			PARTITION BY "block_name", "block_version", "identity_key"
			ORDER BY
				"ready_at" DESC NULLS LAST,
				"updated_at" DESC,
				"created_at" DESC,
				"id" DESC
		) AS "winner_id",
		row_number() OVER (
			PARTITION BY "block_name", "block_version", "identity_key"
			ORDER BY
				"ready_at" DESC NULLS LAST,
				"updated_at" DESC,
				"created_at" DESC,
				"id" DESC
		) AS "ready_rank"
	FROM "thinking_block_artifacts"
	WHERE "status" = 'ready'
)
UPDATE "thinking_block_artifacts"
SET
	"status" = 'superseded',
	"superseded_by" = ranked_ready."winner_id",
	"superseded_at" = coalesce("thinking_block_artifacts"."superseded_at", now()),
	"updated_at" = now()
FROM ranked_ready
WHERE "thinking_block_artifacts"."id" = ranked_ready."id"
	AND ranked_ready."ready_rank" > 1;--> statement-breakpoint
CREATE UNIQUE INDEX "thinking_block_artifacts_ready_unique" ON "thinking_block_artifacts" USING btree ("block_name","block_version","identity_key") WHERE "thinking_block_artifacts"."status" = 'ready';--> statement-breakpoint
CREATE INDEX "thinking_block_artifacts_lookup_idx" ON "thinking_block_artifacts" USING btree ("block_name","block_version","identity_key","status");--> statement-breakpoint
CREATE INDEX "thinking_block_artifacts_claim_idx" ON "thinking_block_artifacts" USING btree ("block_name","block_version","status","updated_at","created_at");--> statement-breakpoint
ALTER TABLE "thinking_block_artifacts" DROP COLUMN "identity_kind";--> statement-breakpoint
ALTER TABLE "thinking_block_artifacts" DROP COLUMN "identity_labels";
