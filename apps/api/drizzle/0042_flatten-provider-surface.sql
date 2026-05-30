DROP TABLE IF EXISTS "hook_deliveries" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "hook_subscriptions" CASCADE;--> statement-breakpoint
DELETE FROM "executions" WHERE "phase"::text IN ('execute', 'query', 'list', 'scan') OR "action_id" IN (SELECT "id" FROM "actions" WHERE "kind"::text IN ('command', 'list', 'scan', 'schema_get', 'sensor', 'reconcile'));--> statement-breakpoint
DELETE FROM "actions" WHERE "kind"::text IN ('command', 'list', 'scan', 'schema_get', 'sensor', 'reconcile');--> statement-breakpoint
ALTER TABLE "actions" ALTER COLUMN "kind" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE IF EXISTS "public"."action_kind";--> statement-breakpoint
CREATE TYPE "public"."action_kind" AS ENUM('create', 'read', 'update', 'delete', 'import', 'forget', 'track', 'untrack', 'lookup', 'pull');--> statement-breakpoint
ALTER TABLE "actions" ALTER COLUMN "kind" SET DATA TYPE "public"."action_kind" USING "kind"::"public"."action_kind";--> statement-breakpoint
ALTER TABLE "executions" ALTER COLUMN "phase" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE IF EXISTS "public"."execution_phase";--> statement-breakpoint
CREATE TYPE "public"."execution_phase" AS ENUM('plan', 'apply', 'read', 'import', 'forget', 'pull');--> statement-breakpoint
ALTER TABLE "executions" ALTER COLUMN "phase" SET DATA TYPE "public"."execution_phase" USING "phase"::"public"."execution_phase";--> statement-breakpoint
ALTER TABLE "integrations" DROP COLUMN IF EXISTS "provider_runtime";--> statement-breakpoint
ALTER TABLE "integrations" DROP COLUMN IF EXISTS "status";--> statement-breakpoint
ALTER TABLE "integrations" DROP COLUMN IF EXISTS "last_checked_at";--> statement-breakpoint
ALTER TABLE "integrations" DROP COLUMN IF EXISTS "last_error";--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN IF EXISTS "data_node_command_policy";--> statement-breakpoint
ALTER TABLE "resources" DROP COLUMN IF EXISTS "sensors";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."integration_status";
