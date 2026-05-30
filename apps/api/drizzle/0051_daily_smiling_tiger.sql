ALTER TABLE "operations" DROP CONSTRAINT "operations_change_set_item_id_change_set_items_id_fk";
--> statement-breakpoint
ALTER TABLE "operations" ADD CONSTRAINT "operations_change_set_item_id_change_set_items_id_fk" FOREIGN KEY ("change_set_item_id") REFERENCES "public"."change_set_items"("id") ON DELETE set null ON UPDATE no action;