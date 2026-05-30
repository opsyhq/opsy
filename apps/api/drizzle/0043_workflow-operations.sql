CREATE TYPE "public"."operation_kind" AS ENUM('create', 'update', 'delete', 'import', 'read', 'lookup');--> statement-breakpoint
CREATE TYPE "public"."operation_status" AS ENUM('pending', 'running', 'awaiting_approval', 'canceling', 'succeeded', 'failed', 'canceled');--> statement-breakpoint
CREATE TABLE "operations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"resource_id" uuid,
	"change_set_item_id" uuid,
	"scan_run_id" uuid,
	"retry_of_operation_id" uuid,
	"workflow_run_id" text,
	"lock_key" text,
	"kind" "operation_kind" NOT NULL,
	"status" "operation_status" DEFAULT 'pending' NOT NULL,
	"actor_type" "actor_type" NOT NULL,
	"actor_id" uuid NOT NULL,
	"request" jsonb NOT NULL,
	"result" jsonb,
	"error" jsonb,
	"approval" jsonb,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "operations" ADD CONSTRAINT "operations_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operations" ADD CONSTRAINT "operations_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operations" ADD CONSTRAINT "operations_change_set_item_id_change_set_items_id_fk" FOREIGN KEY ("change_set_item_id") REFERENCES "public"."change_set_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operations" ADD CONSTRAINT "operations_scan_run_id_scan_runs_id_fk" FOREIGN KEY ("scan_run_id") REFERENCES "public"."scan_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operations" ADD CONSTRAINT "operations_retry_of_operation_id_operations_id_fk" FOREIGN KEY ("retry_of_operation_id") REFERENCES "public"."operations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "operations_project_created_at_idx" ON "operations" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE INDEX "operations_project_status_idx" ON "operations" USING btree ("project_id","status");--> statement-breakpoint
CREATE INDEX "operations_resource_id_idx" ON "operations" USING btree ("resource_id");--> statement-breakpoint
CREATE INDEX "operations_change_set_item_idx" ON "operations" USING btree ("change_set_item_id");--> statement-breakpoint
CREATE INDEX "operations_scan_run_idx" ON "operations" USING btree ("scan_run_id");--> statement-breakpoint
CREATE INDEX "operations_retry_of_idx" ON "operations" USING btree ("retry_of_operation_id");--> statement-breakpoint
CREATE INDEX "operations_workflow_run_idx" ON "operations" USING btree ("workflow_run_id");--> statement-breakpoint
CREATE UNIQUE INDEX "operations_open_lock_unique" ON "operations" USING btree ("project_id","lock_key") WHERE "operations"."lock_key" IS NOT NULL AND "operations"."status" IN ('pending', 'running', 'awaiting_approval', 'canceling');