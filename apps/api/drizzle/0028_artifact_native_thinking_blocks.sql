DROP INDEX IF EXISTS "thinking_block_artifacts_ready_unique";--> statement-breakpoint
DROP INDEX IF EXISTS "thinking_block_artifacts_lookup_idx";--> statement-breakpoint
DELETE FROM "thinking_block_validation_results";--> statement-breakpoint
DELETE FROM "thinking_block_model_calls";--> statement-breakpoint
DELETE FROM "thinking_block_runs";--> statement-breakpoint
DELETE FROM "thinking_block_artifacts";--> statement-breakpoint
ALTER TABLE "thinking_block_model_calls" DROP COLUMN IF EXISTS "block_version";--> statement-breakpoint
ALTER TABLE "thinking_block_runs" DROP COLUMN IF EXISTS "block_version";--> statement-breakpoint
ALTER TABLE "thinking_block_artifacts" DROP COLUMN IF EXISTS "block_version";--> statement-breakpoint
CREATE UNIQUE INDEX "thinking_block_artifacts_ready_unique" ON "thinking_block_artifacts" USING btree ("block_name","identity_hash") WHERE "thinking_block_artifacts"."status" = 'ready';--> statement-breakpoint
CREATE INDEX "thinking_block_artifacts_lookup_idx" ON "thinking_block_artifacts" USING btree ("block_name","identity_hash","status");--> statement-breakpoint
DROP TABLE IF EXISTS "resource_type_field_annotations";--> statement-breakpoint
DROP TABLE IF EXISTS "resource_type_meta";
