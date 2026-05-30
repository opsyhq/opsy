ALTER TABLE "resource_field_binding_rules" DROP CONSTRAINT IF EXISTS "resource_field_binding_rules_relation_check";--> statement-breakpoint
ALTER TABLE "resource_relationship_rules" DROP CONSTRAINT IF EXISTS "resource_relationship_rules_relation_check";--> statement-breakpoint
ALTER TABLE "resource_edges" DROP CONSTRAINT IF EXISTS "resource_edges_relation_check";--> statement-breakpoint

UPDATE "resource_field_binding_rules"
SET "relation" = 'BELONGS_TO',
	"edge_direction" = 'source_to_target',
	"updated_at" = now()
WHERE "relation" = 'CONTAINS';--> statement-breakpoint

UPDATE "resource_relationship_rules"
SET "relation" = 'BELONGS_TO',
	"edge_direction" = 'source_to_target',
	"updated_at" = now()
WHERE "relation" = 'CONTAINS';--> statement-breakpoint

UPDATE "resource_edges"
SET
	"source_resource_id" = "target_resource_id",
	"target_resource_id" = "source_resource_id",
	"relation" = 'BELONGS_TO',
	"source_path" = CASE
		WHEN "source_path" = 'manual.contains' THEN 'manual.parent'
		ELSE "source_path"
	END,
	"updated_at" = now()
WHERE "relation" = 'CONTAINS';--> statement-breakpoint

ALTER TABLE "resource_field_binding_rules" ADD CONSTRAINT "resource_field_binding_rules_relation_check" CHECK ("resource_field_binding_rules"."relation" IN ('BELONGS_TO', 'ATTACHED_TO', 'DEPENDS_ON', 'CONNECTS_TO', 'ASSOCIATED_WITH'));--> statement-breakpoint
ALTER TABLE "resource_relationship_rules" ADD CONSTRAINT "resource_relationship_rules_relation_check" CHECK ("resource_relationship_rules"."relation" IN ('BELONGS_TO', 'ATTACHED_TO', 'DEPENDS_ON', 'CONNECTS_TO', 'ASSOCIATED_WITH'));--> statement-breakpoint
ALTER TABLE "resource_edges" ADD CONSTRAINT "resource_edges_relation_check" CHECK ("resource_edges"."relation" IN ('BELONGS_TO', 'ATTACHED_TO', 'DEPENDS_ON', 'CONNECTS_TO', 'ASSOCIATED_WITH'));--> statement-breakpoint

DROP INDEX IF EXISTS "resource_relationship_rules_identity_unique";--> statement-breakpoint
CREATE UNIQUE INDEX "resource_relationship_rules_identity_unique" ON "resource_relationship_rules" USING btree (
	"provider_source",
	"source_kind",
	"source_type",
	"schema_hash",
	"source_path",
	"source_value_path",
	"target_kind",
	"target_type",
	"target_value_path",
	"relation",
	"edge_direction"
);
