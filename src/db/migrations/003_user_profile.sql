-- Singleton user profile (always id=1)
CREATE TABLE IF NOT EXISTS user_profile (
  id                        INTEGER PRIMARY KEY CHECK(id = 1),
  -- Personal data
  display_name              TEXT,                        -- optional first name or nickname
  age                       INTEGER,
  sex                       TEXT CHECK(sex IN ('male','female','other','prefer_not_to_say')),
  weight_kg                 REAL,                        -- current weight
  height_cm                 REAL,                        -- height in cm
  -- Level and goals
  fitness_level             TEXT CHECK(fitness_level IN (
                              'beginner','intermediate','advanced','athlete'
                            )),
  primary_goal              TEXT CHECK(primary_goal IN (
                              'strength','hypertrophy','endurance',
                              'weight_loss','general_fitness','sport_performance'
                            )),
  secondary_goals           TEXT NOT NULL DEFAULT '[]',  -- JSON array of primary_goal values
  target_weight_kg          REAL,                        -- target weight (optional)
  sport_practiced           TEXT,                        -- sport practiced (optional)
  -- Training constraints
  sessions_per_week         INTEGER,
  session_duration_min      INTEGER,                     -- target session duration in minutes
  prefers_exercise_variation INTEGER NOT NULL DEFAULT 1, -- 1=yes, vary exercises
  -- Health and limitations
  injury_notes              TEXT,                        -- injuries/pain to note
  medical_notes             TEXT,                        -- medical contraindications
  -- Onboarding
  onboarding_completed      INTEGER NOT NULL DEFAULT 0  CHECK(onboarding_completed IN (0,1)),
  onboarding_step           TEXT    NOT NULL DEFAULT 'not_started',
  -- Timestamps
  created_at                TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at                TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Insert the singleton row if missing
INSERT OR IGNORE INTO user_profile (id) VALUES (1);
