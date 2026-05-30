-- Dedupe before installing the partial unique index. The previous index
-- treated NULL view_ids as distinct, so onConflictDoUpdate failed silently
-- and accumulated multiple layout rows per resource. Keep the most recently
-- updated row per (resource_id, view_id) and drop the rest.
DELETE FROM resource_layouts l
WHERE l.id NOT IN (
  SELECT DISTINCT ON (resource_id, view_id) id
  FROM resource_layouts
  ORDER BY resource_id, view_id, updated_at DESC, id DESC
);
--> statement-breakpoint
DROP INDEX "resource_layouts_resource_view_unique";--> statement-breakpoint
CREATE UNIQUE INDEX "resource_layouts_resource_null_view_unique" ON "resource_layouts" USING btree ("resource_id") WHERE "resource_layouts"."view_id" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "resource_layouts_resource_view_unique" ON "resource_layouts" USING btree ("resource_id","view_id") WHERE "resource_layouts"."view_id" IS NOT NULL;