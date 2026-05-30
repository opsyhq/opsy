DELETE FROM "resource_edges";--> statement-breakpoint
UPDATE "projects" SET "relationships_refreshed_at" = NULL;--> statement-breakpoint

ALTER TABLE "resource_edges" DROP CONSTRAINT IF EXISTS "resource_edges_role_check";--> statement-breakpoint
ALTER TABLE "resource_edges" ADD CONSTRAINT "resource_edges_role_check" CHECK ("resource_edges"."role" IN ('CONTAINED', 'COMPONENT', 'ATTACHMENT', 'REFERENCE', 'BIND', 'FLOW'));
