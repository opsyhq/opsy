ALTER TABLE "events" ADD COLUMN "project_id" uuid;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "global_seq" bigserial NOT NULL;--> statement-breakpoint
CREATE INDEX "events_org_project_global_idx" ON "events" USING btree ("org_id","project_id","global_seq");