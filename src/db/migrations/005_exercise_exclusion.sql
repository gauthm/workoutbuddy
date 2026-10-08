-- Migration 005 : exclusion d'exercices
-- SQLite supporte ADD COLUMN sans recréer la table.

ALTER TABLE exercise ADD COLUMN
  is_excluded INTEGER NOT NULL DEFAULT 0 CHECK(is_excluded IN (0,1));

ALTER TABLE exercise ADD COLUMN
  exclusion_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_exercise_excluded ON exercise(is_excluded);
