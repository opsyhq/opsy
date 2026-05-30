CREATE TABLE "onboarding_completions" (
	"organization_id" uuid PRIMARY KEY NOT NULL,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "onboarding_completions" ADD CONSTRAINT "onboarding_completions_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- Backfill: any org that already has a resource has, by FK chain, also
-- created a project + integration. Mark it complete so existing users
-- don't see a phantom checklist on first load after deploy.
INSERT INTO "onboarding_completions" ("organization_id")
SELECT DISTINCT p."org_id"
FROM "projects" p
JOIN "resources" r ON r."project_id" = p."id"
WHERE p."deleted_at" IS NULL AND r."deleted_at" IS NULL
ON CONFLICT ("organization_id") DO NOTHING;