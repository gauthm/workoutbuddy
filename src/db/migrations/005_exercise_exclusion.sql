-- Migration 005: exercise exclusion
-- SQLite supports ADD COLUMN without recreating the table.

ALTER TABLE exercise ADD COLUMN
  is_excluded INTEGER NOT NULL DEFAULT 0 CHECK(is_excluded IN (0,1));

ALTER TABLE exercise ADD COLUMN
  exclusion_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_exercise_excluded ON exercise(is_excluded);
