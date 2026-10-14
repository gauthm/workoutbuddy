CREATE TABLE equipment_advice_previous AS SELECT * FROM equipment_advice;
DROP TABLE equipment_advice;
CREATE TABLE IF NOT EXISTS equipment_advice (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  signal_type      TEXT    NOT NULL
                   CHECK(signal_type IN (
                     'max_load_reached','min_increment_too_large',
                     'no_exercise_available','no_rotation_possible',
                     'persistent_plateau','equipment_limit_approaching','high_fatigue'
                   )),
  exercise_id      TEXT    REFERENCES exercise(id),
  muscle_group     TEXT,
  movement_pattern TEXT,
  signal_data      TEXT    NOT NULL,
  advice_text      TEXT,
  status           TEXT    NOT NULL DEFAULT 'active'
                   CHECK(status IN ('active','dismissed','purchased')),
  dismissed_at     TEXT,
  purchased_at     TEXT,
  last_generated_at TEXT   NOT NULL DEFAULT (datetime('now')),
  created_at       TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_advice_status ON equipment_advice(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_advice_unique
  ON equipment_advice(signal_type, exercise_id, muscle_group)
  WHERE status = 'active';


INSERT INTO equipment_advice SELECT * FROM equipment_advice_previous;
DROP TABLE equipment_advice_previous;
