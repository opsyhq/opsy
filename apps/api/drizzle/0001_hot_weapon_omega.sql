CREATE TABLE "resource_type_hints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"kind" text NOT NULL,
	"type" text NOT NULL,
	"schema_hash" text NOT NULL,
	"provider_version" text,
	"status" text NOT NULL,
	"review_status" text DEFAULT 'unreviewed' NOT NULL,
	"hints" jsonb,
	"model_provider" text DEFAULT 'openai' NOT NULL,
	"model" text NOT NULL,
	"response_model" text,
	"prompt_version" text NOT NULL,
	"confidence" real,
	"finish_reason" text,
	"usage" jsonb,
	"request_metadata" jsonb,
	"response_metadata" jsonb,
	"provider_metadata" jsonb,
	"warnings" jsonb,
	"reasoning" text,
	"system_prompt" text,
	"user_prompt" text,
	"error" text,
	"generated_at" timestamp with time zone,
	"reviewed_at" timestamp with time zone,
	"reviewed_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "resource_type_hints_schema_unique" ON "resource_type_hints" USING btree ("provider","kind","type","schema_hash");--> statement-breakpoint
CREATE INDEX "resource_type_hints_lookup_idx" ON "resource_type_hints" USING btree ("provider","kind","type","status","review_status");--> statement-breakpoint
CREATE INDEX "resource_type_hints_ready_idx" ON "resource_type_hints" USING btree ("provider","kind","type","schema_hash") WHERE "resource_type_hints"."status" = 'ready';