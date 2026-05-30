ALTER TYPE "public"."operation_kind" ADD VALUE 'scan';--> statement-breakpoint
ALTER TABLE "actions" DROP CONSTRAINT "actions_scan_run_id_scan_runs_id_fk";
--> statement-breakpoint
ALTER TABLE "operations" DROP CONSTRAINT "operations_scan_run_id_scan_runs_id_fk";
--> statement-breakpoint
DROP INDEX "actions_scan_run_id_idx";--> statement-breakpoint
DROP INDEX "operations_scan_run_idx";--> statement-breakpoint
ALTER TABLE "actions" DROP COLUMN "scan_run_id";--> statement-breakpoint
ALTER TABLE "operations" DROP COLUMN "scan_run_id";--> statement-breakpoint
ALTER TABLE "scan_runs" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "scan_runs";
