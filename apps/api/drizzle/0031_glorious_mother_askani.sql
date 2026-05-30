DO $$ BEGIN
	IF EXISTS (
		SELECT 1 FROM information_schema.columns
		WHERE table_schema = 'public'
			AND table_name = 'resource_edges'
			AND column_name = 'display'
	) AND NOT EXISTS (
		SELECT 1 FROM information_schema.columns
		WHERE table_schema = 'public'
			AND table_name = 'resource_edges'
			AND column_name = 'presentation'
	) THEN
		ALTER TABLE "resource_edges" RENAME COLUMN "display" TO "presentation";
	END IF;
END $$;--> statement-breakpoint
ALTER TABLE "resource_edges" DROP CONSTRAINT IF EXISTS "resource_edges_display_check";--> statement-breakpoint
ALTER TABLE "resource_edges" DROP CONSTRAINT IF EXISTS "resource_edges_presentation_check";--> statement-breakpoint
ALTER TABLE "resource_edges" DROP CONSTRAINT IF EXISTS "resource_edges_relation_check";--> statement-breakpoint
ALTER TABLE "resource_edges" DROP CONSTRAINT IF EXISTS "resource_edges_relationship_rule_id_resource_relationship_rules_id_fk";
--> statement-breakpoint
DROP INDEX IF EXISTS "resource_edges_relationship_rule_idx";--> statement-breakpoint
ALTER TABLE "resource_edges" ADD COLUMN IF NOT EXISTS "relationship_rule_key" text;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "resource_edges_relationship_rule_key_idx" ON "resource_edges" USING btree ("relationship_rule_key");--> statement-breakpoint
ALTER TABLE "resource_edges" DROP COLUMN IF EXISTS "relationship_rule_id";--> statement-breakpoint
UPDATE "resource_edges" SET "relation" = CASE
	WHEN "relation" = 'CONNECTS_TO' THEN 'FLOWS_TO'
	WHEN "relation" = 'ASSOCIATED_WITH' THEN 'DEPENDS_ON'
	ELSE "relation"
END;--> statement-breakpoint
ALTER TABLE "resource_edges" ADD CONSTRAINT "resource_edges_presentation_check" CHECK ("resource_edges"."presentation" IN ('nest', 'host', 'boundary', 'label', 'edge', 'collapse'));--> statement-breakpoint
ALTER TABLE "resource_edges" ADD CONSTRAINT "resource_edges_relation_check" CHECK ("resource_edges"."relation" IN ('BELONGS_TO', 'ATTACHED_TO', 'BINDS', 'DEPENDS_ON', 'FLOWS_TO'));--> statement-breakpoint
ALTER TABLE IF EXISTS "resource_relationship_rules" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE IF EXISTS "resource_relationship_rules" CASCADE;
