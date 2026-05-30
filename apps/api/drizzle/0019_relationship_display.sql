ALTER TABLE "resource_relationship_rules" ADD COLUMN IF NOT EXISTS "display" text DEFAULT 'edge' NOT NULL;--> statement-breakpoint
ALTER TABLE "resource_edges" ADD COLUMN IF NOT EXISTS "display" text DEFAULT 'edge' NOT NULL;--> statement-breakpoint

DO $$
BEGIN
	IF EXISTS (
		SELECT 1 FROM information_schema.columns
		WHERE table_schema = 'public'
			AND table_name = 'resource_relationship_rules'
			AND column_name = 'visual_role'
	) THEN
		EXECUTE $sql$
			UPDATE "resource_relationship_rules"
			SET "display" = CASE "visual_role"
				WHEN 'nest' THEN 'nest'
				WHEN 'component' THEN 'host'
				WHEN 'attach' THEN 'label'
				WHEN 'scope' THEN 'label'
				WHEN 'bridge' THEN 'collapse'
				ELSE 'edge'
			END
			WHERE "visual_role" IS NOT NULL
		$sql$;
	ELSIF EXISTS (
		SELECT 1 FROM information_schema.columns
		WHERE table_schema = 'public'
			AND table_name = 'resource_relationship_rules'
			AND column_name = 'presentation'
	) THEN
		EXECUTE $sql$
			UPDATE "resource_relationship_rules"
			SET "display" = CASE "presentation"->>'mode'
				WHEN 'contain' THEN 'nest'
				WHEN 'host' THEN CASE
					WHEN "presentation"->>'surface' = 'boundary' THEN 'boundary'
					ELSE 'host'
				END
				WHEN 'edge' THEN 'edge'
				WHEN 'collapse' THEN 'collapse'
				WHEN 'context' THEN 'label'
				ELSE 'edge'
			END
			WHERE "presentation" IS NOT NULL
		$sql$;
	END IF;
END $$;--> statement-breakpoint

DO $$
BEGIN
	IF EXISTS (
		SELECT 1 FROM information_schema.columns
		WHERE table_schema = 'public'
			AND table_name = 'resource_edges'
			AND column_name = 'visual_role'
	) THEN
		EXECUTE $sql$
			UPDATE "resource_edges"
			SET "display" = CASE "visual_role"
				WHEN 'nest' THEN 'nest'
				WHEN 'component' THEN 'host'
				WHEN 'attach' THEN 'label'
				WHEN 'scope' THEN 'label'
				WHEN 'bridge' THEN 'collapse'
				ELSE 'edge'
			END
			WHERE "visual_role" IS NOT NULL
		$sql$;
	ELSIF EXISTS (
		SELECT 1 FROM information_schema.columns
		WHERE table_schema = 'public'
			AND table_name = 'resource_edges'
			AND column_name = 'presentation'
	) THEN
		EXECUTE $sql$
			UPDATE "resource_edges"
			SET "display" = CASE "presentation"->>'mode'
				WHEN 'contain' THEN 'nest'
				WHEN 'host' THEN CASE
					WHEN "presentation"->>'surface' = 'boundary' THEN 'boundary'
					ELSE 'host'
				END
				WHEN 'edge' THEN 'edge'
				WHEN 'collapse' THEN 'collapse'
				WHEN 'context' THEN 'label'
				ELSE 'edge'
			END
			WHERE "presentation" IS NOT NULL
		$sql$;
	END IF;
END $$;--> statement-breakpoint

ALTER TABLE "resource_relationship_rules" DROP CONSTRAINT IF EXISTS "resource_relationship_rules_visual_role_check";--> statement-breakpoint
ALTER TABLE "resource_edges" DROP CONSTRAINT IF EXISTS "resource_edges_visual_role_check";--> statement-breakpoint
ALTER TABLE "resource_relationship_rules" DROP CONSTRAINT IF EXISTS "resource_relationship_rules_display_check";--> statement-breakpoint
ALTER TABLE "resource_edges" DROP CONSTRAINT IF EXISTS "resource_edges_display_check";--> statement-breakpoint
ALTER TABLE "resource_relationship_rules" DROP CONSTRAINT IF EXISTS "resource_relationship_rules_relation_check";--> statement-breakpoint
ALTER TABLE "resource_edges" DROP CONSTRAINT IF EXISTS "resource_edges_relation_check";--> statement-breakpoint

UPDATE "resource_relationship_rules"
SET "relation" = CASE "relation"
	WHEN 'contains' THEN 'BELONGS_TO'
	WHEN 'member_of' THEN 'BELONGS_TO'
	WHEN 'connects_to' THEN 'CONNECTS_TO'
	WHEN 'depends_on' THEN 'DEPENDS_ON'
	WHEN 'applies_to' THEN 'ATTACHED_TO'
	WHEN 'associates_with' THEN 'ASSOCIATED_WITH'
	ELSE "relation"
END;--> statement-breakpoint
UPDATE "resource_edges"
SET "relation" = CASE "relation"
	WHEN 'contains' THEN 'BELONGS_TO'
	WHEN 'member_of' THEN 'BELONGS_TO'
	WHEN 'connects_to' THEN 'CONNECTS_TO'
	WHEN 'depends_on' THEN 'DEPENDS_ON'
	WHEN 'applies_to' THEN 'ATTACHED_TO'
	WHEN 'associates_with' THEN 'ASSOCIATED_WITH'
	ELSE "relation"
END;--> statement-breakpoint

ALTER TABLE "resource_relationship_rules" ADD CONSTRAINT "resource_relationship_rules_display_check" CHECK ("resource_relationship_rules"."display" IN ('edge', 'nest', 'host', 'boundary', 'label', 'collapse'));--> statement-breakpoint
ALTER TABLE "resource_edges" ADD CONSTRAINT "resource_edges_display_check" CHECK ("resource_edges"."display" IN ('edge', 'nest', 'host', 'boundary', 'label', 'collapse'));--> statement-breakpoint
ALTER TABLE "resource_relationship_rules" ADD CONSTRAINT "resource_relationship_rules_relation_check" CHECK ("resource_relationship_rules"."relation" IN ('BELONGS_TO', 'ATTACHED_TO', 'DEPENDS_ON', 'CONNECTS_TO', 'ASSOCIATED_WITH'));--> statement-breakpoint
ALTER TABLE "resource_edges" ADD CONSTRAINT "resource_edges_relation_check" CHECK ("resource_edges"."relation" IN ('BELONGS_TO', 'ATTACHED_TO', 'DEPENDS_ON', 'CONNECTS_TO', 'ASSOCIATED_WITH'));--> statement-breakpoint

ALTER TABLE "resource_relationship_rules" DROP COLUMN IF EXISTS "visual_role";--> statement-breakpoint
ALTER TABLE "resource_edges" DROP COLUMN IF EXISTS "visual_role";--> statement-breakpoint
ALTER TABLE "resource_relationship_rules" DROP COLUMN IF EXISTS "presentation";--> statement-breakpoint
ALTER TABLE "resource_edges" DROP COLUMN IF EXISTS "presentation";
