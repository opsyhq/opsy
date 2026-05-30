DROP INDEX IF EXISTS "resource_edges_active_identity_unique";--> statement-breakpoint

DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM information_schema.columns
		WHERE table_schema = 'public'
			AND table_name = 'resource_edges'
			AND column_name = 'provenance'
	) AND NOT EXISTS (
		SELECT 1
		FROM information_schema.columns
		WHERE table_schema = 'public'
			AND table_name = 'resource_edges'
			AND column_name = 'source'
	) THEN
		ALTER TABLE "resource_edges" RENAME COLUMN "provenance" TO "source";
	END IF;
END $$;--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "resource_edges_active_identity_unique" ON "resource_edges" USING btree (
	"project_id",
	"source_resource_id",
	"target_resource_id",
	"relation",
	"source",
	"source_path",
	coalesce("target_path", '')
) WHERE "resource_edges"."status" = 'active';--> statement-breakpoint
