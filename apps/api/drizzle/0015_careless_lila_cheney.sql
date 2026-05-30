INSERT INTO "resource_edges" (
	"project_id",
	"source_resource_id",
	"target_resource_id",
	"relation",
	"status",
	"provenance",
	"predicate",
	"source_path",
	"target_path",
	"metadata",
	"last_seen_at",
	"created_at",
	"updated_at"
)
SELECT
	child."project_id",
	parent."id",
	child."id",
	'CONTAINS',
	'active',
	'human',
	NULL,
	'manual.contains',
	NULL,
	'{"sourceKind":"manual"}'::jsonb,
	now(),
	now(),
	now()
FROM "resources" child
JOIN "resources" parent
	ON parent."project_id" = child."project_id"
	AND parent."slug" = child."parent"
	AND parent."deleted_at" IS NULL
WHERE child."parent" IS NOT NULL
	AND child."deleted_at" IS NULL
ON CONFLICT DO NOTHING;--> statement-breakpoint
UPDATE "resource_edges"
SET "status" = 'stale', "updated_at" = now()
WHERE "status" = 'active'
	AND "provenance" = 'system'
	AND "relation" = 'CONTAINS'
	AND "metadata"->>'sourceKind' = 'parent';--> statement-breakpoint
DROP INDEX "resources_project_parent_idx";--> statement-breakpoint
ALTER TABLE "resources" DROP COLUMN "parent";
