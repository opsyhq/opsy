CREATE TABLE "resource_layouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resource_id" uuid NOT NULL,
	"view_id" uuid,
	"position" jsonb,
	"size" jsonb,
	"collapsed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "resource_layouts" ADD CONSTRAINT "resource_layouts_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "resource_layouts_resource_view_unique" ON "resource_layouts" USING btree ("resource_id","view_id");--> statement-breakpoint
-- Backfill resource_layouts from existing resources columns
INSERT INTO resource_layouts (resource_id, position, size, collapsed)
SELECT id, position, size, false FROM resources
WHERE position IS NOT NULL OR size IS NOT NULL;
--> statement-breakpoint
ALTER TABLE "resources" DROP COLUMN "position";--> statement-breakpoint
ALTER TABLE "resources" DROP COLUMN "size";
