-- Convert child resource positions from absolute to parent-relative coordinates.
-- Each child's stored (x, y) was the absolute canvas position; after this UPDATE
-- it becomes (child_abs - parent_abs) so React Flow's parentId mechanism places
-- the child at the correct on-screen location without any visual jump.
--
-- One-pass UPDATE is correct for arbitrary nesting depth: a grandchild's absolute
-- position becomes (grandchild_abs - parent_abs). Its parent's absolute position
-- becomes (parent_abs - grandparent_abs). React Flow then renders the grandchild
-- at grandparent_abs + (parent_abs - grandparent_abs) + (grandchild_abs - parent_abs)
-- = grandchild_abs. ✓
UPDATE resource_layouts AS l
SET position = jsonb_build_object(
  'x', (l.position->>'x')::float - (pl.position->>'x')::float,
  'y', (l.position->>'y')::float - (pl.position->>'y')::float
)
FROM resources r
JOIN resources rp ON rp.slug = r.parent AND rp.project_id = r.project_id AND rp.deleted_at IS NULL
JOIN resource_layouts pl ON pl.resource_id = rp.id AND pl.view_id IS NULL
WHERE l.resource_id = r.id
  AND l.view_id IS NULL
  AND r.parent IS NOT NULL
  AND r.deleted_at IS NULL
  AND l.position IS NOT NULL
  AND pl.position IS NOT NULL;
