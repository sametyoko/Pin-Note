ALTER TABLE points ADD COLUMN favorite boolean NOT NULL DEFAULT false;
-- Older undo/redo snapshots predate this column; keep them restorable.
UPDATE point_history SET snapshot=jsonb_set(snapshot,'{point,favorite}','false'::jsonb)
WHERE snapshot IS NOT NULL AND NOT ((snapshot->'point') ? 'favorite');
