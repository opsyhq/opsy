ALTER TABLE "projects" ADD COLUMN "relationships_refreshed_at" timestamp with time zone;--> statement-breakpoint

UPDATE "resource_edges"
SET "provenance" = CASE
	WHEN "provenance" = 'human' THEN 'manual'
	WHEN "provenance" = 'system' THEN 'declared'
	WHEN "provenance" = 'terraform_native' THEN 'observed'
	ELSE "provenance"
END;--> statement-breakpoint
