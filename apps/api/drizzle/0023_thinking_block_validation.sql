ALTER TABLE "thinking_block_runs" ADD COLUMN "rejection_reason" text;--> statement-breakpoint
ALTER TABLE "thinking_block_runs" ADD COLUMN "rejection" jsonb;--> statement-breakpoint
ALTER TABLE "thinking_block_model_calls" ADD COLUMN "operation_id" text;--> statement-breakpoint
ALTER TABLE "thinking_block_model_calls" ADD COLUMN "attempt" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "thinking_block_model_calls" ADD COLUMN "validator_id" text;--> statement-breakpoint
ALTER TABLE "thinking_block_model_calls" ADD COLUMN "validator_type" text;--> statement-breakpoint
CREATE INDEX "thinking_block_model_calls_operation_attempt_idx" ON "thinking_block_model_calls" USING btree ("thinking_block_run_id","operation_id","attempt");--> statement-breakpoint
CREATE TABLE "thinking_block_validation_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"thinking_block_run_id" uuid,
	"operation_id" text,
	"attempt" integer DEFAULT 0 NOT NULL,
	"validator_id" text NOT NULL,
	"validator_type" text NOT NULL,
	"status" text NOT NULL,
	"feedback" jsonb,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "thinking_block_validation_results" ADD CONSTRAINT "thinking_block_validation_results_thinking_block_run_id_thinking_block_runs_id_fk" FOREIGN KEY ("thinking_block_run_id") REFERENCES "public"."thinking_block_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "thinking_block_validation_results_run_idx" ON "thinking_block_validation_results" USING btree ("thinking_block_run_id");--> statement-breakpoint
CREATE INDEX "thinking_block_validation_results_operation_attempt_idx" ON "thinking_block_validation_results" USING btree ("thinking_block_run_id","operation_id","attempt");
