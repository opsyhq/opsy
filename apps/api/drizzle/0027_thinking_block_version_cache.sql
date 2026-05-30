DROP INDEX IF EXISTS "thinking_block_artifacts_ready_unique";--> statement-breakpoint
DROP INDEX IF EXISTS "thinking_block_artifacts_lookup_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "thinking_block_artifacts_ready_unique" ON "thinking_block_artifacts" USING btree ("block_name","block_version","identity_hash") WHERE "thinking_block_artifacts"."status" = 'ready';--> statement-breakpoint
CREATE INDEX "thinking_block_artifacts_lookup_idx" ON "thinking_block_artifacts" USING btree ("block_name","block_version","identity_hash","status");
