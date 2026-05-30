ALTER TABLE "thinking_block_runs" ADD COLUMN "thinking_block_artifact_id" uuid;--> statement-breakpoint
ALTER TABLE "thinking_block_runs" ADD CONSTRAINT "thinking_block_runs_thinking_block_artifact_id_thinking_block_artifacts_id_fk" FOREIGN KEY ("thinking_block_artifact_id") REFERENCES "public"."thinking_block_artifacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
DROP INDEX IF EXISTS "thinking_block_runs_input_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "thinking_block_runs_provider_type_idx";--> statement-breakpoint
CREATE INDEX "thinking_block_runs_artifact_idx" ON "thinking_block_runs" USING btree ("thinking_block_artifact_id");--> statement-breakpoint
ALTER TABLE "thinking_block_runs" DROP COLUMN "cache_status";--> statement-breakpoint
ALTER TABLE "thinking_block_runs" DROP COLUMN "input_kind";--> statement-breakpoint
ALTER TABLE "thinking_block_runs" DROP COLUMN "input_hash";--> statement-breakpoint
ALTER TABLE "thinking_block_runs" DROP COLUMN "provider";--> statement-breakpoint
ALTER TABLE "thinking_block_runs" DROP COLUMN "provider_source";--> statement-breakpoint
ALTER TABLE "thinking_block_runs" DROP COLUMN "provider_version";--> statement-breakpoint
ALTER TABLE "thinking_block_runs" DROP COLUMN "resource_kind";--> statement-breakpoint
ALTER TABLE "thinking_block_runs" DROP COLUMN "resource_type";--> statement-breakpoint
ALTER TABLE "thinking_block_runs" DROP COLUMN "schema_hash";--> statement-breakpoint
ALTER TABLE "thinking_block_runs" DROP COLUMN "artifact_type";--> statement-breakpoint
ALTER TABLE "thinking_block_runs" DROP COLUMN "artifact_id";--> statement-breakpoint
ALTER TABLE "thinking_block_runs" DROP COLUMN "output_count";--> statement-breakpoint
ALTER TABLE "thinking_block_runs" DROP COLUMN "accepted_count";--> statement-breakpoint
ALTER TABLE "thinking_block_runs" DROP COLUMN "rejected_count";--> statement-breakpoint
ALTER TABLE "thinking_block_runs" DROP COLUMN "promoted_count";
