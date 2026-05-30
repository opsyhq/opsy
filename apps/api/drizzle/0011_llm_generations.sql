CREATE TABLE "llm_generations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workflow" text NOT NULL,
	"workflow_version" text NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"response_model" text,
	"status" text NOT NULL,
	"artifact_type" text,
	"artifact_id" uuid,
	"metadata" jsonb NOT NULL,
	"input" jsonb NOT NULL,
	"output" jsonb,
	"error" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "llm_generations_workflow_created_at_idx" ON "llm_generations" USING btree ("workflow","created_at");
