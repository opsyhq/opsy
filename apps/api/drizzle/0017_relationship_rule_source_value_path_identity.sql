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
