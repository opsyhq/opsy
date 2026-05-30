UPDATE "resource_edges"
SET "source" = CASE
	WHEN "source" = 'manual' THEN 'user'
	WHEN "source" = 'declared' THEN 'config'
	WHEN "source" = 'observed' THEN 'provider'
	WHEN "source" = 'human' THEN 'user'
	WHEN "source" = 'system' THEN 'config'
	WHEN "source" = 'terraform_native' THEN 'provider'
	ELSE "source"
END;--> statement-breakpoint

ALTER TABLE "resource_edges" ALTER COLUMN "source" SET DEFAULT 'config';
