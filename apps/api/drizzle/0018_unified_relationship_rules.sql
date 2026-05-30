ALTER TABLE "resource_edges" DROP CONSTRAINT IF EXISTS "resource_edges_binding_rule_id_resource_field_binding_rules_id_fk";--> statement-breakpoint
DROP INDEX IF EXISTS "resource_edges_binding_rule_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "resource_edges_active_identity_unique";--> statement-breakpoint

DELETE FROM "resource_edges"
WHERE "provenance" <> 'human'
	OR NOT (
		"relation" = 'BELONGS_TO'
		AND (
			"source_path" = 'manual.parent'
			OR "metadata"->>'sourceKind' = 'manual'
		)
	);--> statement-breakpoint

ALTER TABLE "resource_edges" DROP COLUMN IF EXISTS "binding_rule_id";--> statement-breakpoint
ALTER TABLE "resource_edges" DROP COLUMN IF EXISTS "predicate";--> statement-breakpoint
ALTER TABLE "resource_edges" ADD COLUMN IF NOT EXISTS "visual_role" text DEFAULT 'edge' NOT NULL;--> statement-breakpoint

UPDATE "resource_edges"
SET
	"visual_role" = 'nest',
	"relationship_rule_id" = NULL,
	"source_path" = 'manual.parent',
	"target_path" = NULL,
	"updated_at" = now()
WHERE "provenance" = 'human'
	AND "relation" = 'BELONGS_TO';--> statement-breakpoint

ALTER TABLE "resource_relationship_rules" DROP CONSTRAINT IF EXISTS "resource_relationship_rules_edge_direction_check";--> statement-breakpoint
ALTER TABLE "resource_relationship_rules" DROP CONSTRAINT IF EXISTS "resource_relationship_rules_relation_check";--> statement-breakpoint
DROP INDEX IF EXISTS "resource_relationship_rules_identity_unique";--> statement-breakpoint

DELETE FROM "resource_relationship_rules";--> statement-breakpoint
ALTER TABLE "resource_relationship_rules" RENAME COLUMN "target_value_path" TO "target_path";--> statement-breakpoint
ALTER TABLE "resource_relationship_rules" DROP COLUMN IF EXISTS "source_value_path";--> statement-breakpoint
ALTER TABLE "resource_relationship_rules" DROP COLUMN IF EXISTS "edge_direction";--> statement-breakpoint
ALTER TABLE "resource_relationship_rules" DROP COLUMN IF EXISTS "predicate";--> statement-breakpoint
ALTER TABLE "resource_relationship_rules" ADD COLUMN "visual_role" text DEFAULT 'edge' NOT NULL;--> statement-breakpoint

DROP TABLE IF EXISTS "resource_field_binding_rules";--> statement-breakpoint

CREATE UNIQUE INDEX "resource_edges_active_identity_unique" ON "resource_edges" USING btree (
	"project_id",
	"source_resource_id",
	"target_resource_id",
	"relation",
	"provenance",
	"source_path",
	COALESCE("target_path", '')
) WHERE "resource_edges"."status" = 'active';--> statement-breakpoint

CREATE UNIQUE INDEX "resource_relationship_rules_identity_unique" ON "resource_relationship_rules" USING btree (
	"provider_source",
	"source_kind",
	"source_type",
	"schema_hash",
	"source_path",
	"target_kind",
	"target_type",
	"target_path",
	"relation"
);--> statement-breakpoint

ALTER TABLE "resource_relationship_rules" ADD CONSTRAINT "resource_relationship_rules_relation_check" CHECK ("resource_relationship_rules"."relation" IN ('BELONGS_TO', 'ATTACHED_TO', 'DEPENDS_ON', 'CONNECTS_TO', 'ASSOCIATED_WITH'));--> statement-breakpoint
ALTER TABLE "resource_relationship_rules" ADD CONSTRAINT "resource_relationship_rules_visual_role_check" CHECK ("resource_relationship_rules"."visual_role" IN ('nest', 'scope', 'component', 'attach', 'edge', 'bridge'));--> statement-breakpoint
ALTER TABLE "resource_edges" ADD CONSTRAINT "resource_edges_visual_role_check" CHECK ("resource_edges"."visual_role" IN ('nest', 'scope', 'component', 'attach', 'edge', 'bridge'));
