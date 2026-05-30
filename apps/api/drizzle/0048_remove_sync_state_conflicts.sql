ALTER TABLE "resources" DROP COLUMN IF EXISTS "sync_state";--> statement-breakpoint
ALTER TABLE "resources" DROP COLUMN IF EXISTS "conflict_snapshot";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."sync_state";