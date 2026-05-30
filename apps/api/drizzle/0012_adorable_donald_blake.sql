ALTER TABLE "resource_edges" ADD COLUMN "predicate" text;--> statement-breakpoint
DELETE FROM "resource_edges" old
USING "resource_edges" existing
WHERE old."relation" = 'USES'
	AND existing."relation" = 'ASSOCIATED_WITH'
	AND old."status" = 'active'
	AND existing."status" = 'active'
	AND old."project_id" = existing."project_id"
	AND old."source_resource_id" = existing."source_resource_id"
	AND old."target_resource_id" = existing."target_resource_id"
	AND old."provenance" = existing."provenance"
	AND old."source_path" = existing."source_path";--> statement-breakpoint
DELETE FROM "resource_edges" old
USING "resource_edges" existing
WHERE old."relation" = 'BELONGS_TO'
	AND existing."relation" = 'CONTAINS'
	AND old."status" = 'active'
	AND existing."status" = 'active'
	AND old."project_id" = existing."project_id"
	AND old."source_resource_id" = existing."source_resource_id"
	AND old."target_resource_id" = existing."target_resource_id"
	AND old."provenance" = existing."provenance"
	AND old."source_path" = existing."source_path";--> statement-breakpoint
DELETE FROM "resource_field_bindings" old
USING "resource_field_bindings" existing
WHERE old."relation" = 'USES'
	AND existing."relation" = 'ASSOCIATED_WITH'
	AND old."provider_source" = existing."provider_source"
	AND old."source_kind" = existing."source_kind"
	AND old."source_type" = existing."source_type"
	AND old."schema_hash" = existing."schema_hash"
	AND old."field_path" = existing."field_path"
	AND old."target_kind" = existing."target_kind"
	AND old."target_type" = existing."target_type"
	AND old."target_value_path" = existing."target_value_path";--> statement-breakpoint
DELETE FROM "resource_field_bindings" old
USING "resource_field_bindings" existing
WHERE old."relation" = 'BELONGS_TO'
	AND existing."relation" = 'CONTAINS'
	AND old."provider_source" = existing."provider_source"
	AND old."source_kind" = existing."source_kind"
	AND old."source_type" = existing."source_type"
	AND old."schema_hash" = existing."schema_hash"
	AND old."field_path" = existing."field_path"
	AND old."target_kind" = existing."target_kind"
	AND old."target_type" = existing."target_type"
	AND old."target_value_path" = existing."target_value_path";--> statement-breakpoint
DELETE FROM "resource_relationship_extractors" old
USING "resource_relationship_extractors" existing
WHERE old."relation" = 'USES'
	AND existing."relation" = 'ASSOCIATED_WITH'
	AND old."provider_source" = existing."provider_source"
	AND old."source_kind" = existing."source_kind"
	AND old."source_type" = existing."source_type"
	AND old."schema_hash" = existing."schema_hash"
	AND old."source_path" = existing."source_path"
	AND old."target_kind" = existing."target_kind"
	AND old."target_type" = existing."target_type"
	AND old."target_value_path" = existing."target_value_path";--> statement-breakpoint
DELETE FROM "resource_relationship_extractors" old
USING "resource_relationship_extractors" existing
WHERE old."relation" = 'BELONGS_TO'
	AND existing."relation" = 'CONTAINS'
	AND old."provider_source" = existing."provider_source"
	AND old."source_kind" = existing."source_kind"
	AND old."source_type" = existing."source_type"
	AND old."schema_hash" = existing."schema_hash"
	AND old."source_path" = existing."source_path"
	AND old."target_kind" = existing."target_kind"
	AND old."target_type" = existing."target_type"
	AND old."target_value_path" = existing."target_value_path";--> statement-breakpoint
UPDATE "resource_edges" SET "relation" = 'ASSOCIATED_WITH' WHERE "relation" = 'USES';--> statement-breakpoint
UPDATE "resource_edges" SET "relation" = 'CONTAINS' WHERE "relation" = 'BELONGS_TO';--> statement-breakpoint
UPDATE "resource_field_bindings" SET "relation" = 'ASSOCIATED_WITH' WHERE "relation" = 'USES';--> statement-breakpoint
UPDATE "resource_field_bindings" SET "relation" = 'CONTAINS' WHERE "relation" = 'BELONGS_TO';--> statement-breakpoint
UPDATE "resource_relationship_extractors" SET "relation" = 'ASSOCIATED_WITH' WHERE "relation" = 'USES';--> statement-breakpoint
UPDATE "resource_relationship_extractors" SET "relation" = 'CONTAINS' WHERE "relation" = 'BELONGS_TO';--> statement-breakpoint
ALTER TABLE "resource_edges" ADD CONSTRAINT "resource_edges_relation_check" CHECK ("resource_edges"."relation" IN ('CONTAINS', 'ATTACHED_TO', 'ASSOCIATED_WITH'));--> statement-breakpoint
ALTER TABLE "resource_field_bindings" ADD CONSTRAINT "resource_field_bindings_relation_check" CHECK ("resource_field_bindings"."relation" IN ('CONTAINS', 'ATTACHED_TO', 'ASSOCIATED_WITH'));--> statement-breakpoint
ALTER TABLE "resource_relationship_extractors" ADD CONSTRAINT "resource_relationship_extractors_relation_check" CHECK ("resource_relationship_extractors"."relation" IN ('CONTAINS', 'ATTACHED_TO', 'ASSOCIATED_WITH'));
