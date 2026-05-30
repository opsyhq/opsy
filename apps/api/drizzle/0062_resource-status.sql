CREATE TYPE "public"."resource_status" AS ENUM('creating', 'importing', 'updating', 'deleting', 'live', 'missing');--> statement-breakpoint
ALTER TABLE "resources" ADD COLUMN "status" "resource_status";--> statement-breakpoint
-- Backfill prefers in-flight lifecycle from the open mutating operation
-- (one of pending/running/awaiting_approval/canceling) so resources mid-
-- update/delete/import don't snap to 'live' on the way through. Rows with no
-- open op fall back to facts: missing → 'missing', identity present → 'live',
-- else 'creating' (a stub from a previously failed create awaiting cleanup).
UPDATE "resources" SET "status" = COALESCE(
  (
    SELECT CASE op."kind"
      WHEN 'create' THEN 'creating'::"resource_status"
      WHEN 'import' THEN 'importing'::"resource_status"
      WHEN 'update' THEN 'updating'::"resource_status"
      WHEN 'delete' THEN 'deleting'::"resource_status"
    END
    FROM "operations" op
    WHERE op."resource_id" = "resources"."id"
      AND op."status" IN ('pending', 'running', 'awaiting_approval', 'canceling')
      AND op."kind" IN ('create', 'import', 'update', 'delete')
    ORDER BY op."created_at" DESC
    LIMIT 1
  ),
  CASE
    WHEN "missing" = true THEN 'missing'::"resource_status"
    WHEN "identity" IS NOT NULL THEN 'live'::"resource_status"
    ELSE 'creating'::"resource_status"
  END
);--> statement-breakpoint
ALTER TABLE "resources" ALTER COLUMN "status" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "resources" DROP COLUMN "missing";
