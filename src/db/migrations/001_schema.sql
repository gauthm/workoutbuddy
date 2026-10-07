-- ── Versionnage ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS schema_version (
  version    INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── Exercices ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS exercise (
  id                 TEXT    PRIMARY KEY,
  name_fr            TEXT    NOT NULL,
  name_en            TEXT    NOT NULL,
  category           TEXT    NOT NULL
                     CHECK(category IN ('strength','cardio','stretching',
                       'plyometrics','olympic_weightlifting')),
  force              TEXT,
  mechanic           TEXT,
  movement_pattern   TEXT    NOT NULL
                     CHECK(movement_pattern IN (
                       'push_horizontal','push_vertical',
                       'pull_horizontal','pull_vertical',
                       'squat','hinge','lunge','carry','core','rotation','other'
                     )),
  primary_muscles    TEXT    NOT NULL,
  secondary_muscles  TEXT    NOT NULL DEFAULT '[]',
  equipment_required TEXT    NOT NULL DEFAULT '[]',
  instructions_fr    TEXT    NOT NULL DEFAULT '[]',
  instructions_en    TEXT    NOT NULL DEFAULT '[]',
  image_paths        TEXT    NOT NULL DEFAULT '[]',
  is_custom          INTEGER NOT NULL DEFAULT 0 CHECK(is_custom IN (0,1)),
  is_unilateral      INTEGER NOT NULL DEFAULT 0 CHECK(is_unilateral IN (0,1)),
  created_at         TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_exercise_movement  ON exercise(movement_pattern);
CREATE INDEX IF NOT EXISTS idx_exercise_category  ON exercise(category);
CREATE INDEX IF NOT EXISTS idx_exercise_is_custom ON exercise(is_custom);

-- ── Équipement ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS equipment_item (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  category            TEXT    NOT NULL
                      CHECK(category IN (
                        'barbell','ez_bar','plate','dumbbell_fixed',
                        'dumbbell_adjustable','kettlebell','resistance_band',
                        'bench','rack','pullup_bar','cable_machine',
                        'smith_machine','other'
                      )),
  name                TEXT    NOT NULL,
  weight_kg           REAL,
  count               INTEGER NOT NULL DEFAULT 1,
  weight_min_kg       REAL,
  weight_max_kg       REAL,
  weight_step_kg      REAL,
  resistance_min_kg   REAL,
  resistance_max_kg   REAL,
  notes               TEXT,
  created_at          TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ── Programmes ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS program (
  id                          INTEGER PRIMARY KEY AUTOINCREMENT,
  name                        TEXT    NOT NULL,
  description                 TEXT,
  goal                        TEXT    NOT NULL
                              CHECK(goal IN ('strength','hypertrophy','endurance',
                                'weight_loss','general_fitness')),
  level                       TEXT    NOT NULL
                              CHECK(level IN ('beginner','intermediate','advanced')),
  days_per_week               INTEGER NOT NULL CHECK(days_per_week BETWEEN 2 AND 6),
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
  updated_at                  TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ── Templates de séance ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS workout_template (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  program_id       INTEGER NOT NULL REFERENCES program(id) ON DELETE CASCADE,
  name             TEXT    NOT NULL,
  day_of_week      INTEGER,
  order_index      INTEGER NOT NULL DEFAULT 0,
  created_at       TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_wt_program ON workout_template(program_id);

-- ── Exercices dans un template ────────────────────────────────
CREATE TABLE IF NOT EXISTS template_exercise (
  id                              INTEGER PRIMARY KEY AUTOINCREMENT,
  workout_template_id             INTEGER NOT NULL
                                  REFERENCES workout_template(id) ON DELETE CASCADE,
  exercise_id                     TEXT    NOT NULL REFERENCES exercise(id),
  order_index                     INTEGER NOT NULL DEFAULT 0,
  target_sets                     INTEGER NOT NULL DEFAULT 3,
  target_reps_min                 INTEGER NOT NULL DEFAULT 8,
  target_reps_max                 INTEGER NOT NULL DEFAULT 12,
  target_reps                     INTEGER,
  rest_seconds                    INTEGER NOT NULL DEFAULT 90,
  progression_model               TEXT    NOT NULL DEFAULT 'inherit'
                                  CHECK(progression_model IN
                                    ('inherit','linear','double_progression','rpe_based')),
  progression_weight_increment_kg REAL,
  rir_target                      INTEGER,
  rpe_target                      REAL,
  rotation_group                  TEXT,
  current_rotation_index          INTEGER NOT NULL DEFAULT 0,
  notes                           TEXT,
  created_at                      TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_te_template ON template_exercise(workout_template_id);
CREATE INDEX IF NOT EXISTS idx_te_exercise ON template_exercise(exercise_id);

-- ── État de progression ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS progression_state (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  template_exercise_id INTEGER NOT NULL UNIQUE
                       REFERENCES template_exercise(id) ON DELETE CASCADE,
  current_weight_kg    REAL    NOT NULL DEFAULT 0,
  current_target_reps  INTEGER,
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  last_session_id      INTEGER,
  last_updated         TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ── Séances ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS session (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  workout_template_id INTEGER REFERENCES workout_template(id),
  program_id          INTEGER REFERENCES program(id),
  name                TEXT    NOT NULL,
  scheduled_date      TEXT    NOT NULL,
  started_at          TEXT,
  completed_at        TEXT,
  status              TEXT    NOT NULL DEFAULT 'planned'
                      CHECK(status IN
                        ('planned','in_progress','completed','skipped')),
  duration_seconds    INTEGER,
  total_volume_kg     REAL,
  rpe_avg             REAL,
  is_deload           INTEGER NOT NULL DEFAULT 0 CHECK(is_deload IN (0,1)),
  notes               TEXT,
  created_at          TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_session_date    ON session(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_session_status  ON session(status);
CREATE INDEX IF NOT EXISTS idx_session_program ON session(program_id);

-- ── Exercices dans une séance ─────────────────────────────────
CREATE TABLE IF NOT EXISTS session_exercise (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id           INTEGER NOT NULL REFERENCES session(id) ON DELETE CASCADE,
  exercise_id          TEXT    NOT NULL REFERENCES exercise(id),
  template_exercise_id INTEGER REFERENCES template_exercise(id),
  order_index          INTEGER NOT NULL DEFAULT 0,
  notes                TEXT,
  created_at           TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_se_session  ON session_exercise(session_id);
CREATE INDEX IF NOT EXISTS idx_se_exercise ON session_exercise(exercise_id);

-- ── Séries ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS set_log (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  session_exercise_id INTEGER NOT NULL
                      REFERENCES session_exercise(id) ON DELETE CASCADE,
  set_number          INTEGER NOT NULL,
  weight_kg           REAL    NOT NULL DEFAULT 0,
  reps                INTEGER NOT NULL DEFAULT 0,
  rpe                 REAL,
  rir                 INTEGER,
  is_warmup           INTEGER NOT NULL DEFAULT 0 CHECK(is_warmup IN (0,1)),
  is_completed        INTEGER NOT NULL DEFAULT 0 CHECK(is_completed IN (0,1)),
  duration_seconds    INTEGER,
  rest_seconds_after  INTEGER,
  notes               TEXT,
  created_at          TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sl_session_exercise ON set_log(session_exercise_id);

-- ── Poids de corps ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS body_weight (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  date       TEXT    NOT NULL UNIQUE,
  weight_kg  REAL    NOT NULL,
  notes      TEXT,
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_bw_date ON body_weight(date);

-- ── Records personnels ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS personal_record (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  exercise_id      TEXT    NOT NULL REFERENCES exercise(id),
  reps             INTEGER NOT NULL,
  weight_kg        REAL    NOT NULL,
  estimated_1rm_kg REAL    NOT NULL,
  achieved_date    TEXT    NOT NULL,
  set_log_id       INTEGER REFERENCES set_log(id),
  created_at       TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_pr_exercise
  ON personal_record(exercise_id, reps, estimated_1rm_kg DESC);

-- ── Conseils d'achat équipement ───────────────────────────────
CREATE TABLE IF NOT EXISTS equipment_advice (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  signal_type      TEXT    NOT NULL
                   CHECK(signal_type IN (
                     'max_load_reached','min_increment_too_large',
                     'no_exercise_available','no_rotation_possible',
                     'persistent_plateau'
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

-- ── Paramètres ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
