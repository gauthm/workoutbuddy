-- Profil utilisateur singleton (id=1 toujours)
CREATE TABLE IF NOT EXISTS user_profile (
  id                        INTEGER PRIMARY KEY CHECK(id = 1),
  -- Données personnelles
  display_name              TEXT,                        -- prénom ou pseudo optionnel
  age                       INTEGER,
  sex                       TEXT CHECK(sex IN ('male','female','other','prefer_not_to_say')),
  weight_kg                 REAL,                        -- poids actuel
  height_cm                 REAL,                        -- taille en cm
  -- Niveau et objectifs
  fitness_level             TEXT CHECK(fitness_level IN (
                              'beginner','intermediate','advanced','athlete'
                            )),
  primary_goal              TEXT CHECK(primary_goal IN (
                              'strength','hypertrophy','endurance',
                              'weight_loss','general_fitness','sport_performance'
                            )),
  secondary_goals           TEXT NOT NULL DEFAULT '[]',  -- JSON array de primary_goal values
  target_weight_kg          REAL,                        -- objectif poids (optionnel)
  sport_practiced           TEXT,                        -- sport pratiqué (optionnel)
  -- Contraintes d'entraînement
  sessions_per_week         INTEGER,
  session_duration_min      INTEGER,                     -- durée cible par séance en minutes
  prefers_exercise_variation INTEGER NOT NULL DEFAULT 1, -- 1=oui, varier les exos
  -- Santé et limitations
  injury_notes              TEXT,                        -- blessures/douleurs à noter
  medical_notes             TEXT,                        -- contre-indications médicales
  -- Onboarding
  onboarding_completed      INTEGER NOT NULL DEFAULT 0  CHECK(onboarding_completed IN (0,1)),
  onboarding_step           TEXT    NOT NULL DEFAULT 'not_started',
  -- Timestamps
  created_at                TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at                TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Insérer la ligne singleton si absente
INSERT OR IGNORE INTO user_profile (id) VALUES (1);
