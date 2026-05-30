CREATE TABLE IF NOT EXISTS "resource_command_capabilities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_source" text NOT NULL,
	"provider_version_constraint" text,
	"source_kind" text NOT NULL,
	"source_type" text NOT NULL,
	"schema_hash" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"provenance" text DEFAULT 'llm' NOT NULL,
	"validation_result" jsonb,
	"command" text NOT NULL,
	"display_name" text,
	"effect" text NOT NULL,
	"input_schema" jsonb,
	"spec" jsonb NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"confidence" real,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "resource_edges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"source_resource_id" uuid NOT NULL,
	"target_resource_id" uuid NOT NULL,
	"relation" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"provenance" text DEFAULT 'system' NOT NULL,
	"source_path" text DEFAULT '' NOT NULL,
	"target_path" text,
	"binding_id" uuid,
	"extractor_id" uuid,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_seen_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "resource_field_bindings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_source" text NOT NULL,
	"provider_version_constraint" text,
	"source_kind" text NOT NULL,
	"source_type" text NOT NULL,
	"schema_hash" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"provenance" text DEFAULT 'llm' NOT NULL,
	"validation_result" jsonb,
	"field_path" text NOT NULL,
	"field_value_path" text,
	"target_kind" text NOT NULL,
	"target_type" text NOT NULL,
	"target_value_path" text NOT NULL,
	"relation" text NOT NULL,
	"cardinality" text NOT NULL,
	"value_mode" text NOT NULL,
	"condition" jsonb,
	"priority" integer DEFAULT 0 NOT NULL,
	"confidence" real,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "resource_list_capabilities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_source" text NOT NULL,
	"provider_version_constraint" text,
	"source_kind" text NOT NULL,
	"source_type" text NOT NULL,
	"schema_hash" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"provenance" text DEFAULT 'llm' NOT NULL,
	"validation_result" jsonb,
	"capability_kind" text NOT NULL,
	"spec" jsonb NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"confidence" real,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "resource_relationship_extractors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_source" text NOT NULL,
	"provider_version_constraint" text,
	"source_kind" text NOT NULL,
	"source_type" text NOT NULL,
	"schema_hash" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"provenance" text DEFAULT 'llm' NOT NULL,
	"validation_result" jsonb,
	"source_path" text NOT NULL,
	"source_value_path" text,
	"target_kind" text NOT NULL,
	"target_type" text NOT NULL,
	"target_value_path" text NOT NULL,
	"relation" text NOT NULL,
	"cardinality" text NOT NULL,
	"condition" jsonb,
	"priority" integer DEFAULT 0 NOT NULL,
	"confidence" real,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "resource_sensor_mappings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_source" text NOT NULL,
	"provider_version_constraint" text,
	"source_kind" text NOT NULL,
	"source_type" text NOT NULL,
	"schema_hash" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"provenance" text DEFAULT 'llm' NOT NULL,
	"validation_result" jsonb,
	"sensor_kind" text NOT NULL,
	"name" text NOT NULL,
	"display_name" text,
	"spec" jsonb NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"confidence" real,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conname = 'resource_edges_project_id_projects_id_fk'
			AND conrelid = 'public.resource_edges'::regclass
	) THEN
		ALTER TABLE "resource_edges" ADD CONSTRAINT "resource_edges_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
	END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conname = 'resource_edges_source_resource_id_resources_id_fk'
			AND conrelid = 'public.resource_edges'::regclass
	) THEN
		ALTER TABLE "resource_edges" ADD CONSTRAINT "resource_edges_source_resource_id_resources_id_fk" FOREIGN KEY ("source_resource_id") REFERENCES "public"."resources"("id") ON DELETE cascade ON UPDATE no action;
	END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conname = 'resource_edges_target_resource_id_resources_id_fk'
			AND conrelid = 'public.resource_edges'::regclass
	) THEN
		ALTER TABLE "resource_edges" ADD CONSTRAINT "resource_edges_target_resource_id_resources_id_fk" FOREIGN KEY ("target_resource_id") REFERENCES "public"."resources"("id") ON DELETE cascade ON UPDATE no action;
	END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conname = 'resource_edges_binding_id_resource_field_bindings_id_fk'
			AND conrelid = 'public.resource_edges'::regclass
	) THEN
		ALTER TABLE "resource_edges" ADD CONSTRAINT "resource_edges_binding_id_resource_field_bindings_id_fk" FOREIGN KEY ("binding_id") REFERENCES "public"."resource_field_bindings"("id") ON DELETE set null ON UPDATE no action;
	END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conname = 'resource_edges_extractor_id_resource_relationship_extractors_id'
			AND conrelid = 'public.resource_edges'::regclass
	) THEN
		ALTER TABLE "resource_edges" ADD CONSTRAINT "resource_edges_extractor_id_resource_relationship_extractors_id_fk" FOREIGN KEY ("extractor_id") REFERENCES "public"."resource_relationship_extractors"("id") ON DELETE set null ON UPDATE no action;
	END IF;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "resource_command_capabilities_lookup_idx" ON "resource_command_capabilities" USING btree ("provider_source","source_kind","source_type","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "resource_command_capabilities_schema_idx" ON "resource_command_capabilities" USING btree ("provider_source","source_type","schema_hash");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "resource_command_capabilities_identity_unique" ON "resource_command_capabilities" USING btree ("provider_source","source_kind","source_type","schema_hash","command");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "resource_edges_project_idx" ON "resource_edges" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "resource_edges_source_idx" ON "resource_edges" USING btree ("source_resource_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "resource_edges_target_idx" ON "resource_edges" USING btree ("target_resource_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "resource_edges_binding_idx" ON "resource_edges" USING btree ("binding_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "resource_edges_extractor_idx" ON "resource_edges" USING btree ("extractor_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "resource_edges_active_identity_unique" ON "resource_edges" USING btree ("project_id","source_resource_id","target_resource_id","relation","provenance","source_path") WHERE "resource_edges"."status" = 'active';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "resource_field_bindings_lookup_idx" ON "resource_field_bindings" USING btree ("provider_source","source_kind","source_type","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "resource_field_bindings_schema_idx" ON "resource_field_bindings" USING btree ("provider_source","source_type","schema_hash");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "resource_field_bindings_identity_unique" ON "resource_field_bindings" USING btree ("provider_source","source_kind","source_type","schema_hash","field_path","target_kind","target_type","target_value_path","relation");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "resource_list_capabilities_lookup_idx" ON "resource_list_capabilities" USING btree ("provider_source","source_kind","source_type","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "resource_list_capabilities_schema_idx" ON "resource_list_capabilities" USING btree ("provider_source","source_type","schema_hash");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "resource_list_capabilities_identity_unique" ON "resource_list_capabilities" USING btree ("provider_source","source_kind","source_type","schema_hash","capability_kind");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "resource_relationship_extractors_lookup_idx" ON "resource_relationship_extractors" USING btree ("provider_source","source_kind","source_type","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "resource_relationship_extractors_schema_idx" ON "resource_relationship_extractors" USING btree ("provider_source","source_type","schema_hash");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "resource_relationship_extractors_identity_unique" ON "resource_relationship_extractors" USING btree ("provider_source","source_kind","source_type","schema_hash","source_path","target_kind","target_type","target_value_path","relation");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "resource_sensor_mappings_lookup_idx" ON "resource_sensor_mappings" USING btree ("provider_source","source_kind","source_type","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "resource_sensor_mappings_schema_idx" ON "resource_sensor_mappings" USING btree ("provider_source","source_type","schema_hash");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "resource_sensor_mappings_identity_unique" ON "resource_sensor_mappings" USING btree ("provider_source","source_kind","source_type","schema_hash","sensor_kind","name");
