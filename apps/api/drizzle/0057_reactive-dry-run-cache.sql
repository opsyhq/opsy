CREATE TYPE "public"."resource_dry_run_action" AS ENUM('pending', 'noop', 'create', 'update', 'delete', 'replace', 'deferred');--> statement-breakpoint
CREATE TABLE "resource_dry_runs" (
	"change_set_item_id" uuid PRIMARY KEY NOT NULL,
	"action" "resource_dry_run_action" NOT NULL,
	"prior_state" jsonb,
	"planned_state" jsonb,
	"planned_private" text,
	"requires_replace" jsonb,
	"error" jsonb,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "change_sets_project_draft_unique";--> statement-breakpoint
ALTER TABLE "change_sets" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "change_sets" ALTER COLUMN "status" SET DEFAULT 'draft'::text;--> statement-breakpoint
UPDATE "change_sets" SET "status" = 'draft' WHERE "status" NOT IN ('draft', 'applying', 'applied', 'discarded', 'canceled');--> statement-breakpoint
DROP TYPE "public"."change_set_status";--> statement-breakpoint
CREATE TYPE "public"."change_set_status" AS ENUM('draft', 'applying', 'applied', 'discarded', 'canceled');--> statement-breakpoint
ALTER TABLE "change_sets" ALTER COLUMN "status" SET DEFAULT 'draft'::"public"."change_set_status";--> statement-breakpoint
ALTER TABLE "change_sets" ALTER COLUMN "status" SET DATA TYPE "public"."change_set_status" USING "status"::"public"."change_set_status";--> statement-breakpoint
CREATE UNIQUE INDEX "change_sets_project_draft_unique" ON "change_sets" USING btree ("project_id") WHERE "status" = 'draft';--> statement-breakpoint
ALTER TABLE "change_set_items" ADD COLUMN "depends_on" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "resource_dry_runs" ADD CONSTRAINT "resource_dry_runs_change_set_item_id_change_set_items_id_fk" FOREIGN KEY ("change_set_item_id") REFERENCES "public"."change_set_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "change_set_items_depends_on_gin" ON "change_set_items" USING gin ("depends_on");--> statement-breakpoint
ALTER TABLE "change_set_items" DROP COLUMN "validation_status";--> statement-breakpoint
ALTER TABLE "change_set_items" DROP COLUMN "validation_result";--> statement-breakpoint
DROP TYPE "public"."change_set_item_validation_status";