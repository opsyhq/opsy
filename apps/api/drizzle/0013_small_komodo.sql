DROP INDEX "resource_field_bindings_identity_unique";--> statement-breakpoint
DROP INDEX "resource_relationship_extractors_identity_unique";--> statement-breakpoint
ALTER TABLE "resource_field_bindings" ADD COLUMN "edge_direction" text DEFAULT 'target_to_source' NOT NULL;--> statement-breakpoint
ALTER TABLE "resource_field_bindings" ADD COLUMN "predicate" text;--> statement-breakpoint
ALTER TABLE "resource_relationship_extractors" ADD COLUMN "edge_direction" text DEFAULT 'target_to_source' NOT NULL;--> statement-breakpoint
ALTER TABLE "resource_relationship_extractors" ADD COLUMN "predicate" text;--> statement-breakpoint
UPDATE "resource_field_bindings" SET "edge_direction" = 'source_to_target' WHERE "relation" = 'ATTACHED_TO';--> statement-breakpoint
UPDATE "resource_relationship_extractors" SET "edge_direction" = 'source_to_target' WHERE "relation" = 'ATTACHED_TO';--> statement-breakpoint
CREATE UNIQUE INDEX "resource_field_bindings_identity_unique" ON "resource_field_bindings" USING btree ("provider_source","source_kind","source_type","schema_hash","field_path","target_kind","target_type","target_value_path","relation","edge_direction");--> statement-breakpoint
CREATE UNIQUE INDEX "resource_relationship_extractors_identity_unique" ON "resource_relationship_extractors" USING btree ("provider_source","source_kind","source_type","schema_hash","source_path","target_kind","target_type","target_value_path","relation","edge_direction");--> statement-breakpoint
ALTER TABLE "resource_field_bindings" ADD CONSTRAINT "resource_field_bindings_edge_direction_check" CHECK ("resource_field_bindings"."edge_direction" IN ('source_to_target', 'target_to_source'));--> statement-breakpoint
ALTER TABLE "resource_relationship_extractors" ADD CONSTRAINT "resource_relationship_extractors_edge_direction_check" CHECK ("resource_relationship_extractors"."edge_direction" IN ('source_to_target', 'target_to_source'));
