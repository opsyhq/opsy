DELETE FROM "resource_edges";--> statement-breakpoint
UPDATE "projects" SET "relationships_refreshed_at" = NULL;--> statement-breakpoint
UPDATE "thinking_block_artifacts"
SET "status" = 'superseded', "updated_at" = now()
WHERE "block_name" = 'resource-relationship-rules'
  AND "status" <> 'superseded';--> statement-breakpoint

ALTER TABLE "resource_edges" DROP CONSTRAINT IF EXISTS "resource_edges_role_check";--> statement-breakpoint
ALTER TABLE "resource_edges" ADD CONSTRAINT "resource_edges_role_check" CHECK ("resource_edges"."role" IN ('ATTACHMENT', 'REFERENCE', 'SCOPE', 'ASSOCIATION'));
