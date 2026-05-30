ALTER TABLE "change_set_items" DROP COLUMN "apply_status";--> statement-breakpoint
ALTER TABLE "change_set_items" DROP COLUMN "apply_error";--> statement-breakpoint
DROP TYPE "public"."change_set_item_apply_status";