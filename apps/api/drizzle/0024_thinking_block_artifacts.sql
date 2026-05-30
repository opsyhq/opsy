CREATE TABLE "thinking_block_artifacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"block_name" text NOT NULL,
	"block_version" text NOT NULL,
	"identity_kind" text NOT NULL,
	"identity_hash" text NOT NULL,
	"identity_labels" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"input" jsonb NOT NULL,
	"status" text NOT NULL,
	"output" jsonb,
	"rejection" jsonb,
	"error" jsonb,
	"phase" text,
	"phase_label" text,
	"phase_at" timestamp with time zone,
	"superseded_by" uuid,
	"superseded_at" timestamp with time zone,
	"ready_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "thinking_block_artifacts" ADD CONSTRAINT "thinking_block_artifacts_superseded_by_thinking_block_artifacts_id_fk" FOREIGN KEY ("superseded_by") REFERENCES "public"."thinking_block_artifacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "thinking_block_artifacts_ready_unique" ON "thinking_block_artifacts" USING btree ("block_name","identity_hash") WHERE "thinking_block_artifacts"."status" = 'ready';--> statement-breakpoint
CREATE INDEX "thinking_block_artifacts_lookup_idx" ON "thinking_block_artifacts" USING btree ("block_name","identity_hash","status");--> statement-breakpoint
ALTER TABLE "resource_type_hints" ADD COLUMN "thinking_block_artifact_id" uuid;--> statement-breakpoint
ALTER TABLE "resource_type_hints" ADD CONSTRAINT "resource_type_hints_thinking_block_artifact_id_thinking_block_artifacts_id_fk" FOREIGN KEY ("thinking_block_artifact_id") REFERENCES "public"."thinking_block_artifacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_relationship_rules" ADD COLUMN "thinking_block_artifact_id" uuid;--> statement-breakpoint
ALTER TABLE "resource_relationship_rules" ADD CONSTRAINT "resource_relationship_rules_thinking_block_artifact_id_thinking_block_artifacts_id_fk" FOREIGN KEY ("thinking_block_artifact_id") REFERENCES "public"."thinking_block_artifacts"("id") ON DELETE cascade ON UPDATE no action;
