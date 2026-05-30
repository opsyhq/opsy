CREATE TYPE "public"."change_set_item_apply_status" AS ENUM('pending', 'succeeded', 'failed');--> statement-breakpoint
ALTER TABLE "change_set_items" ADD COLUMN "apply_status" "change_set_item_apply_status" DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "change_set_items" ADD COLUMN "apply_error" jsonb;