-- Existing records remain undoable; both stacks share the same 10-operation budget.
ALTER TABLE point_history ADD COLUMN redo boolean NOT NULL DEFAULT false;
