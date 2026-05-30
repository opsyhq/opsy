DELETE FROM "resource_edges";--> statement-breakpoint
UPDATE "projects" SET "relationships_refreshed_at" = NULL;--> statement-breakpoint

DROP INDEX IF EXISTS "resource_edges_active_identity_unique";--> statement-breakpoint
ALTER TABLE "resource_edges" DROP CONSTRAINT IF EXISTS "resource_edges_relation_check";--> statement-breakpoint
ALTER TABLE "resource_edges" DROP CONSTRAINT IF EXISTS "resource_edges_presentation_check";--> statement-breakpoint
ALTER TABLE "resource_edges" DROP CONSTRAINT IF EXISTS "resource_edges_role_check";--> statement-breakpoint
ALTER TABLE "resource_edges" DROP COLUMN IF EXISTS "relation";--> statement-breakpoint
ALTER TABLE "resource_edges" DROP COLUMN IF EXISTS "presentation";--> statement-breakpoint
ALTER TABLE "resource_edges" ADD COLUMN "role" text;--> statement-breakpoint
ALTER TABLE "resource_edges" ALTER COLUMN "role" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "resource_edges" ADD CONSTRAINT "resource_edges_role_check" CHECK ("resource_edges"."role" IN ('CONTAINED_BY', 'COMPONENT_OF', 'ATTACHED_TO', 'REFERENCES', 'BINDS', 'FLOWS_TO'));--> statement-breakpoint

CREATE UNIQUE INDEX "resource_edges_active_identity_unique" ON "resource_edges" USING btree (
	"project_id",
	"source_resource_id",
	"target_resource_id",
	"role",
	"source",
	"source_path",
	coalesce("target_path", '')
) WHERE "resource_edges"."status" = 'active';
