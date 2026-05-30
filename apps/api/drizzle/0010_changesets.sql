DO $$ BEGIN
	CREATE TYPE "public"."change_set_item_kind" AS ENUM('create_resource', 'update_resource', 'delete_resource', 'import_resource');
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	CREATE TYPE "public"."change_set_item_source" AS ENUM('user', 'llm', 'canvas_drag_drop', 'import');
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	CREATE TYPE "public"."change_set_item_validation_status" AS ENUM('unknown', 'valid', 'invalid');
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	CREATE TYPE "public"."change_set_status" AS ENUM('draft', 'validating', 'applying', 'applied', 'discarded', 'failed');
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "change_set_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"change_set_id" uuid NOT NULL,
	"kind" "change_set_item_kind" NOT NULL,
	"target_resource_id" uuid,
	"target_resource_slug" text,
	"integration_id" uuid,
	"resource_type" text,
	"before" jsonb,
	"after" jsonb NOT NULL,
	"validation_status" "change_set_item_validation_status" DEFAULT 'unknown' NOT NULL,
	"validation_result" jsonb,
	"source" "change_set_item_source" DEFAULT 'user' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "change_sets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"status" "change_set_status" DEFAULT 'draft' NOT NULL,
	"title" text,
	"actor_type" "actor_type" NOT NULL,
	"actor_id" uuid NOT NULL,
	"applied_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conname = 'change_set_items_change_set_id_change_sets_id_fk'
			AND conrelid = 'public.change_set_items'::regclass
	) THEN
		ALTER TABLE "change_set_items" ADD CONSTRAINT "change_set_items_change_set_id_change_sets_id_fk" FOREIGN KEY ("change_set_id") REFERENCES "public"."change_sets"("id") ON DELETE no action ON UPDATE no action;
	END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conname = 'change_set_items_target_resource_id_resources_id_fk'
			AND conrelid = 'public.change_set_items'::regclass
	) THEN
		ALTER TABLE "change_set_items" ADD CONSTRAINT "change_set_items_target_resource_id_resources_id_fk" FOREIGN KEY ("target_resource_id") REFERENCES "public"."resources"("id") ON DELETE no action ON UPDATE no action;
	END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conname = 'change_set_items_integration_id_integrations_id_fk'
			AND conrelid = 'public.change_set_items'::regclass
	) THEN
		ALTER TABLE "change_set_items" ADD CONSTRAINT "change_set_items_integration_id_integrations_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."integrations"("id") ON DELETE no action ON UPDATE no action;
	END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conname = 'change_sets_project_id_projects_id_fk'
			AND conrelid = 'public.change_sets'::regclass
	) THEN
		ALTER TABLE "change_sets" ADD CONSTRAINT "change_sets_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;
	END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "change_set_items_change_set_idx" ON "change_set_items" USING btree ("change_set_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "change_set_items_target_resource_idx" ON "change_set_items" USING btree ("target_resource_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "change_sets_project_status_idx" ON "change_sets" USING btree ("project_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "change_sets_project_created_at_idx" ON "change_sets" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "change_sets_project_draft_unique" ON "change_sets" USING btree ("project_id") WHERE "change_sets"."status" = 'draft';
