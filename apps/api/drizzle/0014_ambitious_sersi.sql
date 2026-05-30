ALTER TABLE "resource_field_bindings" RENAME TO "resource_field_binding_rules";--> statement-breakpoint
ALTER TABLE "resource_relationship_extractors" RENAME TO "resource_relationship_rules";--> statement-breakpoint
ALTER TABLE "resource_edges" RENAME COLUMN "binding_id" TO "binding_rule_id";--> statement-breakpoint
ALTER TABLE "resource_edges" RENAME COLUMN "extractor_id" TO "relationship_rule_id";--> statement-breakpoint
ALTER TABLE "resource_field_binding_rules" DROP CONSTRAINT "resource_field_bindings_relation_check";--> statement-breakpoint
ALTER TABLE "resource_field_binding_rules" DROP CONSTRAINT "resource_field_bindings_edge_direction_check";--> statement-breakpoint
ALTER TABLE "resource_relationship_rules" DROP CONSTRAINT "resource_relationship_extractors_relation_check";--> statement-breakpoint
ALTER TABLE "resource_relationship_rules" DROP CONSTRAINT "resource_relationship_extractors_edge_direction_check";--> statement-breakpoint
ALTER TABLE "resource_edges" DROP CONSTRAINT "resource_edges_binding_id_resource_field_bindings_id_fk";
--> statement-breakpoint
ALTER TABLE "resource_edges" DROP CONSTRAINT "resource_edges_extractor_id_resource_relationship_extractors_id_fk";
--> statement-breakpoint
DROP INDEX "resource_edges_binding_idx";--> statement-breakpoint
DROP INDEX "resource_edges_extractor_idx";--> statement-breakpoint
DROP INDEX "resource_field_bindings_lookup_idx";--> statement-breakpoint
DROP INDEX "resource_field_bindings_schema_idx";--> statement-breakpoint
DROP INDEX "resource_field_bindings_identity_unique";--> statement-breakpoint
DROP INDEX "resource_relationship_extractors_lookup_idx";--> statement-breakpoint
DROP INDEX "resource_relationship_extractors_schema_idx";--> statement-breakpoint
DROP INDEX "resource_relationship_extractors_identity_unique";--> statement-breakpoint
ALTER TABLE "resource_edges" ADD CONSTRAINT "resource_edges_binding_rule_id_resource_field_binding_rules_id_fk" FOREIGN KEY ("binding_rule_id") REFERENCES "public"."resource_field_binding_rules"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_edges" ADD CONSTRAINT "resource_edges_relationship_rule_id_resource_relationship_rules_id_fk" FOREIGN KEY ("relationship_rule_id") REFERENCES "public"."resource_relationship_rules"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "resource_edges_binding_rule_idx" ON "resource_edges" USING btree ("binding_rule_id");--> statement-breakpoint
CREATE INDEX "resource_edges_relationship_rule_idx" ON "resource_edges" USING btree ("relationship_rule_id");--> statement-breakpoint
CREATE INDEX "resource_field_binding_rules_lookup_idx" ON "resource_field_binding_rules" USING btree ("provider_source","source_kind","source_type","status");--> statement-breakpoint
CREATE INDEX "resource_field_binding_rules_schema_idx" ON "resource_field_binding_rules" USING btree ("provider_source","source_type","schema_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "resource_field_binding_rules_identity_unique" ON "resource_field_binding_rules" USING btree ("provider_source","source_kind","source_type","schema_hash","field_path","target_kind","target_type","target_value_path","relation","edge_direction");--> statement-breakpoint
CREATE INDEX "resource_relationship_rules_lookup_idx" ON "resource_relationship_rules" USING btree ("provider_source","source_kind","source_type","status");--> statement-breakpoint
CREATE INDEX "resource_relationship_rules_schema_idx" ON "resource_relationship_rules" USING btree ("provider_source","source_type","schema_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "resource_relationship_rules_identity_unique" ON "resource_relationship_rules" USING btree ("provider_source","source_kind","source_type","schema_hash","source_path","target_kind","target_type","target_value_path","relation","edge_direction");--> statement-breakpoint
ALTER TABLE "resource_field_binding_rules" ADD CONSTRAINT "resource_field_binding_rules_relation_check" CHECK ("resource_field_binding_rules"."relation" IN ('CONTAINS', 'ATTACHED_TO', 'ASSOCIATED_WITH'));--> statement-breakpoint
ALTER TABLE "resource_field_binding_rules" ADD CONSTRAINT "resource_field_binding_rules_edge_direction_check" CHECK ("resource_field_binding_rules"."edge_direction" IN ('source_to_target', 'target_to_source'));--> statement-breakpoint
ALTER TABLE "resource_relationship_rules" ADD CONSTRAINT "resource_relationship_rules_relation_check" CHECK ("resource_relationship_rules"."relation" IN ('CONTAINS', 'ATTACHED_TO', 'ASSOCIATED_WITH'));--> statement-breakpoint
ALTER TABLE "resource_relationship_rules" ADD CONSTRAINT "resource_relationship_rules_edge_direction_check" CHECK ("resource_relationship_rules"."edge_direction" IN ('source_to_target', 'target_to_source'));