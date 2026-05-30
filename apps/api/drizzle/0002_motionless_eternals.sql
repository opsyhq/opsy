ALTER TABLE "resource_type_hints" ADD COLUMN "meta" jsonb;--> statement-breakpoint
ALTER TABLE "resource_type_hints" ADD COLUMN "fields" jsonb;--> statement-breakpoint
-- Backfill split columns from the legacy combined `hints` blob so existing
-- rows survive the column split. The `hints` column stays in place for now
-- (read-only legacy data); writes go to `meta`/`fields` exclusively.
UPDATE "resource_type_hints"
SET "meta" = "hints"->'meta',
    "fields" = "hints"->'fields'
WHERE "hints" IS NOT NULL AND "meta" IS NULL AND "fields" IS NULL;
