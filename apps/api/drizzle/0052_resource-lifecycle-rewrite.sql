ALTER TABLE "resources" RENAME COLUMN "read_id" TO "identity";--> statement-breakpoint
DROP INDEX "change_sets_project_draft_unique";--> statement-breakpoint
ALTER TABLE "change_sets" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "change_sets" ALTER COLUMN "status" SET DEFAULT 'draft'::text;--> statement-breakpoint
UPDATE "change_sets" SET "status" = 'discarded' WHERE "status" IN ('failed', 'canceling');--> statement-breakpoint
DROP TYPE "public"."change_set_status";--> statement-breakpoint
CREATE TYPE "public"."change_set_status" AS ENUM('draft', 'validating', 'applying', 'applied', 'discarded', 'canceled');--> statement-breakpoint
ALTER TABLE "change_sets" ALTER COLUMN "status" SET DEFAULT 'draft'::"public"."change_set_status";--> statement-breakpoint
ALTER TABLE "change_sets" ALTER COLUMN "status" SET DATA TYPE "public"."change_set_status" USING "status"::"public"."change_set_status";--> statement-breakpoint
CREATE UNIQUE INDEX "change_sets_project_draft_unique" ON "change_sets" USING btree ("project_id") WHERE "status" = 'draft';--> statement-breakpoint
DROP INDEX "resources_project_status_idx";--> statement-breakpoint
ALTER TABLE "resources" ADD COLUMN "missing" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "resources" DROP COLUMN "kind";--> statement-breakpoint
ALTER TABLE "resources" DROP COLUMN "status";--> statement-breakpoint
ALTER TABLE "resources" DROP COLUMN "selector";--> statement-breakpoint
ALTER TABLE "resources" DROP COLUMN "last_inputs";--> statement-breakpoint
ALTER TABLE "resources" DROP COLUMN "last_outputs";--> statement-breakpoint
DROP TYPE "public"."resource_kind";--> statement-breakpoint
DROP TYPE "public"."resource_status";