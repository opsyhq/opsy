DROP INDEX "integrations_project_provider_slug_unique";--> statement-breakpoint
ALTER TABLE "integrations" ALTER COLUMN "slug" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "integrations" ALTER COLUMN "profile_name" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "integrations" ADD COLUMN "is_default" boolean DEFAULT false NOT NULL;--> statement-breakpoint
-- Data backfill (generator can't infer): the old model used the literal slug
-- "default" for the first integration of every provider, so slug was only
-- unique per (project, provider). The new model makes slug project-unique and
-- moves "which one is the default" to is_default. Resolve both before the new
-- unique indexes below are created.
-- 1. Retire the magic "default" slug -> the provider name, where that doesn't
--    collide with an existing slug in the same project.
UPDATE "integrations" i
SET "slug" = i."provider"
WHERE i."slug" = 'default'
  AND i."deleted_at" IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "integrations" j
    WHERE j."project_id" = i."project_id"
      AND j."slug" = i."provider"
      AND j."id" <> i."id"
      AND j."deleted_at" IS NULL
  );--> statement-breakpoint
-- 2. Any live "default" left over collided in step 1 — give it a deterministic
--    project-unique slug.
UPDATE "integrations" i
SET "slug" = i."provider" || '-' || left(i."id"::text, 8)
WHERE i."slug" = 'default' AND i."deleted_at" IS NULL;--> statement-breakpoint
-- 3. Flag exactly one default per (project, provider): the oldest live row.
UPDATE "integrations" i
SET "is_default" = true
FROM (
  SELECT DISTINCT ON ("project_id", "provider") "id"
  FROM "integrations"
  WHERE "deleted_at" IS NULL
  ORDER BY "project_id", "provider", "created_at", "id"
) d
WHERE i."id" = d."id";--> statement-breakpoint
CREATE UNIQUE INDEX "integrations_project_slug_unique" ON "integrations" USING btree ("project_id","slug") WHERE "integrations"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "integrations_project_provider_default_unique" ON "integrations" USING btree ("project_id","provider") WHERE "integrations"."is_default" AND "integrations"."deleted_at" IS NULL;
