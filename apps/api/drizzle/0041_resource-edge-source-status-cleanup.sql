DELETE FROM "resource_edges"
WHERE "source" NOT IN ('config', 'provider')
	OR "status" NOT IN ('active', 'stale');--> statement-breakpoint
UPDATE "projects" SET "relationships_refreshed_at" = NULL;--> statement-breakpoint
ALTER TABLE "resource_edges" ADD CONSTRAINT "resource_edges_status_check" CHECK ("resource_edges"."status" IN ('active', 'stale'));--> statement-breakpoint
ALTER TABLE "resource_edges" ADD CONSTRAINT "resource_edges_source_check" CHECK ("resource_edges"."source" IN ('config', 'provider'));
