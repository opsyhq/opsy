ALTER TABLE "llm_generations" RENAME TO "thinking_block_model_calls";--> statement-breakpoint
ALTER TABLE "thinking_block_model_calls" RENAME CONSTRAINT "llm_generations_pkey" TO "thinking_block_model_calls_pkey";--> statement-breakpoint
ALTER TABLE "thinking_block_model_calls" RENAME CONSTRAINT "llm_generations_thinking_block_run_id_thinking_block_runs_id_fk" TO "thinking_block_model_calls_thinking_block_run_id_thinking_block_runs_id_fk";--> statement-breakpoint
ALTER INDEX "llm_generations_workflow_created_at_idx" RENAME TO "thinking_block_model_calls_block_created_at_idx";--> statement-breakpoint
DROP INDEX "llm_generations_thinking_block_run_idx";--> statement-breakpoint
ALTER TABLE "thinking_block_model_calls" RENAME COLUMN "workflow" TO "block_name";--> statement-breakpoint
ALTER TABLE "thinking_block_model_calls" RENAME COLUMN "workflow_version" TO "block_version";--> statement-breakpoint
ALTER TABLE "thinking_block_model_calls" ADD COLUMN "step_index" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "thinking_block_model_calls" ADD COLUMN "role" text DEFAULT 'generate' NOT NULL;--> statement-breakpoint
CREATE INDEX "thinking_block_model_calls_run_step_idx" ON "thinking_block_model_calls" USING btree ("thinking_block_run_id","step_index");--> statement-breakpoint
CREATE INDEX "thinking_block_model_calls_role_created_at_idx" ON "thinking_block_model_calls" USING btree ("role","created_at");
