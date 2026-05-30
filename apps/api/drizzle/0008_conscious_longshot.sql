ALTER TABLE "integrations" ADD COLUMN "provider_source" text;--> statement-breakpoint
ALTER TABLE "integrations" ADD COLUMN "provider_runtime" text DEFAULT 'static';--> statement-breakpoint
UPDATE "integrations" SET "provider_source" = 'hashicorp/aws' WHERE "provider" = 'aws' AND "provider_source" IS NULL;--> statement-breakpoint
UPDATE "integrations" SET "provider_runtime" = 'static' WHERE "provider_runtime" IS NULL;--> statement-breakpoint
UPDATE "integrations" SET "provider_version" = '5.94.1' WHERE "provider" = 'aws' AND "provider_version" IS NULL;
