DROP INDEX IF EXISTS "resource_type_hints_lookup_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "resource_type_hints_ready_idx";--> statement-breakpoint
CREATE INDEX "resource_type_hints_lookup_idx" ON "resource_type_hints" USING btree ("provider","kind","type");--> statement-breakpoint
ALTER TABLE "resource_type_hints" DROP COLUMN "status";--> statement-breakpoint
ALTER TABLE "resource_type_hints" DROP COLUMN "review_status";--> statement-breakpoint
ALTER TABLE "resource_type_hints" DROP COLUMN "hints";--> statement-breakpoint
ALTER TABLE "resource_type_hints" DROP COLUMN "model_provider";--> statement-breakpoint
ALTER TABLE "resource_type_hints" DROP COLUMN "model";--> statement-breakpoint
ALTER TABLE "resource_type_hints" DROP COLUMN "response_model";--> statement-breakpoint
ALTER TABLE "resource_type_hints" DROP COLUMN "prompt_version";--> statement-breakpoint
ALTER TABLE "resource_type_hints" DROP COLUMN "confidence";--> statement-breakpoint
ALTER TABLE "resource_type_hints" DROP COLUMN "finish_reason";--> statement-breakpoint
ALTER TABLE "resource_type_hints" DROP COLUMN "usage";--> statement-breakpoint
ALTER TABLE "resource_type_hints" DROP COLUMN "request_metadata";--> statement-breakpoint
ALTER TABLE "resource_type_hints" DROP COLUMN "response_metadata";--> statement-breakpoint
ALTER TABLE "resource_type_hints" DROP COLUMN "provider_metadata";--> statement-breakpoint
ALTER TABLE "resource_type_hints" DROP COLUMN "warnings";--> statement-breakpoint
ALTER TABLE "resource_type_hints" DROP COLUMN "reasoning";--> statement-breakpoint
ALTER TABLE "resource_type_hints" DROP COLUMN "system_prompt";--> statement-breakpoint
ALTER TABLE "resource_type_hints" DROP COLUMN "user_prompt";--> statement-breakpoint
ALTER TABLE "resource_type_hints" DROP COLUMN "error";--> statement-breakpoint
ALTER TABLE "resource_type_hints" DROP COLUMN "generated_at";--> statement-breakpoint
ALTER TABLE "resource_type_hints" DROP COLUMN "reviewed_at";--> statement-breakpoint
ALTER TABLE "resource_type_hints" DROP COLUMN "reviewed_by";
