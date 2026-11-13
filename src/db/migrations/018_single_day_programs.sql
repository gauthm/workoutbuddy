-- foreign-keys: off
-- Rebuild the program constraint while retaining IDs and dependent history.
CREATE TABLE program_new (
  id                          INTEGER PRIMARY KEY AUTOINCREMENT,
  name                        TEXT    NOT NULL,
  description                 TEXT,
  goal                        TEXT    NOT NULL
                              CHECK(goal IN ('strength','hypertrophy','endurance',
                                'weight_loss','general_fitness')),
  level                       TEXT    NOT NULL
                              CHECK(level IN ('beginner','intermediate','advanced')),
  days_per_week               INTEGER NOT NULL CHECK(days_per_week BETWEEN 1 AND 6),
  duration_weeks              INTEGER,
  is_active                   INTEGER NOT NULL DEFAULT 0 CHECK(is_active IN (0,1)),
  use_exercise_rotation       INTEGER NOT NULL DEFAULT 0 CHECK(use_exercise_rotation IN (0,1)),
  rotation_frequency_weeks    INTEGER NOT NULL DEFAULT 1,
  progression_model           TEXT    NOT NULL DEFAULT 'double_progression'
                              CHECK(progression_model IN
                                ('linear','double_progression','rpe_based')),
  deload_auto_enabled         INTEGER NOT NULL DEFAULT 0 CHECK(deload_auto_enabled IN (0,1)),
  deload_frequency_weeks      INTEGER NOT NULL DEFAULT 6,
  deload_load_reduction_pct   INTEGER NOT NULL DEFAULT 20,
  deload_volume_reduction_pct INTEGER NOT NULL DEFAULT 40,
  last_deload_date            TEXT,
  is_in_deload                INTEGER NOT NULL DEFAULT 0 CHECK(is_in_deload IN (0,1)),
  current_week                INTEGER NOT NULL DEFAULT 1,
  created_at                  TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at                  TEXT    NOT NULL DEFAULT (datetime('now')),
  started_on TEXT
);
INSERT INTO program_new SELECT * FROM program;
DROP TABLE program;
ALTER TABLE program_new RENAME TO program;
