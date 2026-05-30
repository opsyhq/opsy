CREATE TABLE "thinking_block_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"block_name" text NOT NULL,
	"block_version" text NOT NULL,
	"status" text NOT NULL,
	"trigger" text,
	"cache_status" text,
	"input_kind" text NOT NULL,
	"input_hash" text NOT NULL,
	"provider" text,
	"provider_source" text,
	"provider_version" text,
	"resource_kind" text,
	"resource_type" text,
	"schema_hash" text,
	"artifact_type" text,
	"artifact_id" uuid,
	"output_count" integer,
	"accepted_count" integer,
	"rejected_count" integer,
	"promoted_count" integer,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"error" jsonb,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"duration_ms" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "thinking_block_runs_block_created_at_idx" ON "thinking_block_runs" USING btree ("block_name","created_at");--> statement-breakpoint
CREATE INDEX "thinking_block_runs_input_idx" ON "thinking_block_runs" USING btree ("block_name","block_version","input_hash");--> statement-breakpoint
CREATE INDEX "thinking_block_runs_provider_type_idx" ON "thinking_block_runs" USING btree ("provider","resource_kind","resource_type","schema_hash");--> statement-breakpoint
ALTER TABLE "llm_generations" ADD COLUMN "thinking_block_run_id" uuid;--> statement-breakpoint
ALTER TABLE "llm_generations" ADD CONSTRAINT "llm_generations_thinking_block_run_id_thinking_block_runs_id_fk" FOREIGN KEY ("thinking_block_run_id") REFERENCES "public"."thinking_block_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "llm_generations_thinking_block_run_idx" ON "llm_generations" USING btree ("thinking_block_run_id");
