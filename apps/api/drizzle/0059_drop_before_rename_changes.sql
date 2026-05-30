ALTER TABLE "change_set_items" RENAME COLUMN "after" TO "changes";--> statement-breakpoint
ALTER TABLE "change_set_items" DROP COLUMN "before";