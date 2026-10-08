Le document collé est tronqué à la fin de T1.6. Je réécris le plan complet en intégrant tous les changements de notre conversation. C'est long — je vais tout couvrir sans rien couper.

---

````markdown
# Plan d'implémentation — WorkoutBuddy
### Document de référence — version 2.0
> Toutes les décisions sont figées. Aucun « à définir ». L'implémenteur suit ce document séquentiellement.

---

# PARTIE 1 — Décisions d'architecture

## 1.1 Nom de l'application
**WorkoutBuddy**. Slug utilisé partout : `workoutbuddy`.

## 1.2 Stack technique

| Couche | Technologie | Version exacte | Licence |
|---|---|---|---|
| Runtime serveur | Node.js | **20.x LTS** | MIT |
| Framework HTTP | Express | **4.18.3** | MIT |
| Base de données | SQLite via better-sqlite3 | **13.0.3** | MIT |
| Framework UI | Vue 3 ESM browser build (vendorisé) | **3.5.13** | MIT |
| Graphiques | Chart.js UMD (vendorisé) | **4.4.4** | MIT |
| HTTP client serveur (IA) | `fetch()` natif Node.js 20 | built-in | — |
| Tests API | supertest | **7.0.0** | MIT |
| Tests unitaires | `node:test` + `assert` | built-in Node.js 20 | — |

**Dépendances runtime** : 2 paquets (`express`, `better-sqlite3`).
**Dépendances dev** : 1 paquet (`supertest`).
**Frontend** : zéro paquet npm — Vue 3 et Chart.js sont des fichiers `.js` locaux dans `public/vendor/`.

## 1.3 Justifications

- **Pas de build frontend** : Vue 3 `esm-browser.prod.js` inclut le compilateur. Composants = objets JS purs. `npm start` = `node server.js`, rien d'autre.
- **better-sqlite3 synchrone** : Élimine async/await imbriqués. 5× plus rapide que `node-sqlite3`. Un seul fichier `.db`.
- **Express** : 10× plus d'exemples — l'implémenteur LLM trouvera de l'aide facilement.
- **fetch() natif** : Node.js 20, supporte ReadableStream pour SSE.
- **Vue 3 sans Pinia** : `reactive()` + `provide/inject` suffisent.

## 1.4 Commande de démarrage unique

```bash
npm start
```

Séquence dans `server.js` :
1. Ouvrir `data/workoutbuddy.db` (créer si absent)
2. Exécuter les migrations (`src/db/migrate.js`) — applique 001→004 séquentiellement
3. Si table `exercise` vide → lancer `src/seed/seed.js`
4. Lire `network_host` (défaut `127.0.0.1`) et `network_port` (défaut `3000`)
5. Lancer Express

## 1.5 Fichiers vendorisés

```bash
node scripts/download-vendors.js
```

| Fichier local | Source |
|---|---|
| `public/vendor/vue.esm-browser.prod.js` | `https://cdn.jsdelivr.net/npm/vue@3.5.13/dist/vue.esm-browser.prod.js` |
| `public/vendor/chart.umd.min.js` | `https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js` |

---

# PARTIE 2 — Arborescence complète

```
workoutbuddy/
│
├── server.js
├── package.json
├── package-lock.json
├── .env.example
├── README.md
├── LICENSE
├── .gitignore
├── AGENT.md
├── TASKS.md
│
├── data/
│   ├── workoutbuddy.db
│   └── backups/
│       └── workoutbuddy_YYYY-MM-DD.db
│
├── src/
│   ├── db/
│   │   ├── database.js
│   │   ├── migrate.js
│   │   └── migrations/
│   │       ├── 001_schema.sql
│   │       ├── 002_default_settings.sql
│   │       ├── 003_user_profile.sql          ← profil utilisateur + onboarding
│   │       └── 004_equipment_enhancements.sql ← nouvelles catégories équipement
│   │
│   ├── routes/
│   │   ├── exercises.js
│   │   ├── equipment.js
│   │   ├── programs.js
│   │   ├── templates.js
│   │   ├── sessions.js
│   │   ├── sets.js
│   │   ├── bodyweight.js
│   │   ├── stats.js
│   │   ├── ai.js
│   │   ├── settings.js
│   │   ├── userProfile.js                    ← GET/PUT /user-profile
│   │   └── exportImport.js
│   │
│   ├── services/
│   │   ├── equipmentCalc.js                  ← algo mis à jour (dumbbell_loadable)
│   │   ├── rmCalculator.js
│   │   ├── progressionEngine.js
│   │   ├── plateauDetector.js
│   │   ├── deloadEngine.js
│   │   ├── rotationEngine.js
│   │   ├── programGenerator.js
│   │   ├── streakCalculator.js
│   │   ├── coachingAdvisor.js                ← 5 signaux équipement + RPE
│   │   ├── adviceTextGenerator.js            ← génération LLM texte conseil
│   │   ├── systemPromptBuilder.js            ← prompt expert complet
│   │   └── aiProvider.js
│   │
│   └── seed/
│       ├── exercises.json
│       └── seed.js
│
├── public/
│   ├── index.html
│   ├── manifest.json
│   ├── sw.js
│   ├── offline.html
│   ├── vendor/
│   │   ├── vue.esm-browser.prod.js
│   │   └── chart.umd.min.js
│   ├── icons/
│   │   ├── icon-192.png
│   │   └── icon-512.png
│   ├── sounds/
│   │   └── timer-end.mp3
│   ├── locales/
│   │   ├── fr.json
│   │   └── en.json
│   ├── exercises/
│   │   └── images/
│   │       └── [ExerciseSlug]/
│   │           ├── 0.jpg
│   │           └── 1.jpg
│   └── js/
│       ├── app.js
│       ├── router.js
│       ├── store.js
│       ├── api.js
│       ├── i18n.js
│       ├── timer-worker.js
│       ├── timer-worker-singleton.js
│       ├── utils/
│       │   ├── rm.js
│       │   ├── weight.js
│       │   └── date.js
│       └── components/
│           ├── layout/
│           │   ├── AppShell.js
│           │   ├── BottomNav.js
│           │   └── PageHeader.js
│           ├── common/
│           │   ├── LoadingSpinner.js
│           │   ├── ErrorBanner.js
│           │   ├── EmptyState.js
│           │   ├── ConfirmModal.js
│           │   └── Toast.js
│           ├── exercises/
│           │   ├── ExerciseListView.js
│           │   ├── ExerciseCard.js
│           │   ├── ExerciseDetailView.js
│           │   ├── ExerciseFilter.js
│           │   └── ExerciseForm.js
│           ├── equipment/
│           │   ├── EquipmentView.js
│           │   ├── EquipmentItemRow.js
│           │   └── EquipmentForm.js
│           ├── programs/
│           │   ├── ProgramListView.js
│           │   ├── ProgramCard.js
│           │   ├── ProgramDetailView.js
│           │   ├── ProgramForm.js
│           │   ├── ProgramGenerator.js
│           │   ├── TemplateEditor.js
│           │   └── ExerciseSelector.js
│           ├── session/
│           │   ├── SessionActiveView.js
│           │   ├── ExerciseBlock.js
│           │   ├── SetRow.js
│           │   ├── RestTimer.js
│           │   ├── SessionTimer.js
│           │   ├── ExerciseHelp.js
│           │   ├── SessionHistoryView.js
│           │   └── SessionDetailView.js
│           ├── calendar/
│           │   └── CalendarView.js
│           ├── stats/
│           │   ├── StatsDashboardView.js
│           │   ├── ExerciseProgressView.js
│           │   ├── BodyWeightView.js
│           │   ├── VolumeChart.js
│           │   ├── StreakCard.js
│           │   └── PRList.js
│           ├── coach/
│           │   ├── CoachView.js
│           │   ├── ChatMessage.js
│           │   ├── ActionPreview.js
│           │   ├── AdviceCard.js
│           │   ├── UserProfileCard.js        ← nouveau
│           │   └── OnboardingBanner.js       ← nouveau
│           └── settings/
│               ├── SettingsView.js
│               ├── SettingsSection.js
│               ├── AIProviderForm.js
│               └── ExportImport.js
│
├── scripts/
│   ├── download-vendors.js
│   └── import-exercises.js
│
├── docs/
│   └── plan/
│       ├── PLAN_FULL.md           ← ce fichier
│       └── tasks/
│           ├── T1.1_scaffolding.md
│           ├── T1.2_database.md
│           ├── T1.3_seed.md
│           ├── T1.4_api_exercises.md
│           ├── T1.5_equipment_calc.md
│           ├── T1.6_frontend_scaffold.md
│           ├── T1.7_screens_exercises.md
│           ├── T1.8_pwa.md
│           ├── T1.9_equipment_enhancements.md
│           ├── T2.1_api_programs.md
│           ├── T2.2_api_sessions.md
│           ├── T2.3_screens_programs.md
│           ├── T2.4_screen_session_active.md
│           ├── T2.5_timers.md
│           ├── T3.1_progression_engine.md
│           ├── T3.2_plateau_deload.md
│           ├── T3.3_rotation.md
│           ├── T3.4_calendar.md
│           ├── T4.1_api_stats.md
│           ├── T4.2_bodyweight.md
│           ├── T4.3_screens_stats.md
│           ├── T5.1_ai_provider.md
│           ├── T5.2_user_profile.md
│           ├── T5.3_api_chat_expert.md
│           ├── T5.4_coaching_advisor.md
│           ├── T5.5_screen_coach.md
│           ├── T6.1_api_settings.md
│           ├── T6.2_screen_settings.md
│           └── T6.3_export_import.md
│
└── tests/
    ├── unit/
    │   ├── equipmentCalc.test.js
    │   ├── equipmentCalc_enhancements.test.js
    │   ├── progressionEngine.test.js
    │   ├── plateauDetector.test.js
    │   ├── deloadEngine.test.js
    │   ├── coachingAdvisor.test.js
    │   ├── rmCalculator.test.js
    │   ├── streakCalculator.test.js
    │   ├── aiProvider.test.js
    │   └── rotationEngine.test.js
    └── integration/
        ├── session.test.js
        ├── api.test.js
        ├── exercises.test.js
        ├── programs.test.js
        ├── stats.test.js
        ├── userProfile.test.js
        ├── ai.test.js
        ├── exportImport.test.js
        └── equipmentEnhancements.test.js
```

---

# PARTIE 3 — Schéma de données complet

## 3.1 Migration 001 — Schéma initial

```sql
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
-- NOTE : les catégories dumbbell_plate, dumbbell_loadable, bench_adjustable
-- seront ajoutées par la migration 004. Cette table est créée ici avec les
-- catégories de base ; la migration 004 la recrée avec le CHECK étendu.
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
  days_per_week               INTEGER NOT NULL CHECK(days_per_week BETWEEN 2 AND 7),
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

-- ── Conseils équipement / coaching ───────────────────────────
CREATE TABLE IF NOT EXISTS equipment_advice (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  signal_type      TEXT    NOT NULL
                   CHECK(signal_type IN (
                     'max_load_reached','min_increment_too_large',
                     'no_exercise_available','no_rotation_possible',
                     'persistent_plateau','high_fatigue'
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
```

## 3.2 Migration 002 — Paramètres par défaut

```sql
INSERT OR IGNORE INTO settings (key, value) VALUES
  ('unit',                                '"kg"'),
  ('rm_formula',                          '"epley"'),
  ('default_rest_seconds',               '90'),
  ('theme',                               '"dark"'),
  ('language',                            '"fr"'),
  ('network_host',                        '"127.0.0.1"'),
  ('network_port',                        '3000'),
  ('ai_base_url',                         '""'),
  ('ai_model',                            '""'),
  ('ai_api_key',                          '""'),
  ('progression_failure_threshold',       '2'),
  ('progression_weight_reduction_pct',    '10'),
  ('plateau_detection_sessions',          '4'),
  ('deload_auto_enabled',                 'false'),
  ('deload_frequency_weeks',              '6'),
  ('deload_load_reduction_pct',           '20'),
  ('deload_volume_reduction_pct',         '40'),
  ('deload_min_sets',                     '2'),
  ('equipment_advice_cooldown_days',      '14'),
  ('linear_increment_kg',                 '2.5'),
  ('linear_dumbbell_increment_kg',        '2.0'),
  ('bodyweight_display_days',             '90'),
  ('timer_sound_enabled',                 'true'),
  ('timer_vibration_enabled',             'true'),
  ('show_rpe_field',                      'false'),
  ('show_rir_field',                      'false'),
  ('equipment_advice_max_load_sessions',  '3'),
  ('equipment_advice_min_increment_pct',  '5'),
  ('equipment_advice_plateau_sessions',   '6'),
  ('warmup_sets_count',                   '0'),
  ('auto_next_exercise',                  'false');
```

## 3.3 Migration 003 — Profil utilisateur

```sql
-- Profil utilisateur singleton (id=1 toujours)
CREATE TABLE IF NOT EXISTS user_profile (
  id                         INTEGER PRIMARY KEY CHECK(id = 1),
  display_name               TEXT,
  age                        INTEGER,
  sex                        TEXT CHECK(sex IN ('male','female','other','prefer_not_to_say')),
  weight_kg                  REAL,
  height_cm                  REAL,
  fitness_level              TEXT CHECK(fitness_level IN (
                               'beginner','intermediate','advanced','athlete'
                             )),
  primary_goal               TEXT CHECK(primary_goal IN (
                               'strength','hypertrophy','endurance',
                               'weight_loss','general_fitness','sport_performance'
                             )),
  secondary_goals            TEXT NOT NULL DEFAULT '[]',
  target_weight_kg           REAL,
  sport_practiced            TEXT,
  sessions_per_week          INTEGER,
  session_duration_min       INTEGER,
  prefers_exercise_variation INTEGER NOT NULL DEFAULT 1 CHECK(prefers_exercise_variation IN (0,1)),
  injury_notes               TEXT,
  medical_notes              TEXT,
  onboarding_completed       INTEGER NOT NULL DEFAULT 0 CHECK(onboarding_completed IN (0,1)),
  onboarding_step            TEXT    NOT NULL DEFAULT 'not_started',
  created_at                 TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at                 TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Ligne singleton
INSERT OR IGNORE INTO user_profile (id) VALUES (1);
```

## 3.4 Migration 004 — Amélioration équipement

```sql
-- Recrée equipment_item avec les nouvelles catégories.
-- SQLite ne supporte pas ALTER COLUMN CHECK directement.

CREATE TABLE IF NOT EXISTS equipment_item_backup AS
SELECT * FROM equipment_item;

DROP TABLE IF EXISTS equipment_item;

CREATE TABLE IF NOT EXISTS equipment_item (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  category            TEXT    NOT NULL
                      CHECK(category IN (
                        'barbell',
                        'ez_bar',
                        'plate',
                        'dumbbell_plate',       -- disques spécifiques haltères
                        'dumbbell_fixed',
                        'dumbbell_adjustable',
                        'dumbbell_loadable',    -- poignée d'haltère + disques
                        'kettlebell',
                        'resistance_band',
                        'bench',                -- banc plat
                        'bench_adjustable',     -- banc réglable/inclinable
                        'rack',
                        'pullup_bar',
                        'cable_machine',
                        'smith_machine',
                        'other'
                      )),
  name                TEXT    NOT NULL,
  weight_kg           REAL,
  -- dumbbell_loadable : weight_kg = poids d'UNE poignée, count = 2 (toujours)
  -- dumbbell_plate    : weight_kg = poids du disque, count = total pair
  count               INTEGER NOT NULL DEFAULT 1,
  weight_min_kg       REAL,
  weight_max_kg       REAL,
  weight_step_kg      REAL,
  resistance_min_kg   REAL,
  resistance_max_kg   REAL,
  notes               TEXT,
  created_at          TEXT    NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO equipment_item
  (id, category, name, weight_kg, count, weight_min_kg, weight_max_kg,
   weight_step_kg, resistance_min_kg, resistance_max_kg, notes, created_at)
SELECT
  id, category, name, weight_kg, count, weight_min_kg, weight_max_kg,
  weight_step_kg, resistance_min_kg, resistance_max_kg, notes, created_at
FROM equipment_item_backup;

DROP TABLE IF EXISTS equipment_item_backup;
```

## 3.5 Exécuteur de migrations

```javascript
// src/db/migrate.js
export function migrate(db) → void
// Lit src/db/migrations/*.sql triés alphabétiquement (001, 002, 003, 004…)
// Vérifie schema_version : exécute uniquement les numéros non encore appliqués
// Chaque migration dans une transaction db.transaction(() => { db.exec(sql) })()
// En cas d'erreur : throw Error avec numéro de migration + message SQL
```

---

# PARTIE 4 — Contrats d'API

**Base URL** : `/api/v1`
**Content-Type** : `application/json` sauf SSE (`/ai/chat`) et téléchargements.
**Codes d'erreur** : 400 / 403 / 404 / 409 / 500 → `{ "error": "NOM", "detail"?: "..." }`

## 4.1 Exercices

```
GET    /exercises
  Query: muscle  equipment  movement  custom  q
  Response 200: { exercises: Exercise[] }

GET    /exercises/:id
  Response 200: Exercise | 404

POST   /exercises
  Body: { name_fr, name_en, category, movement_pattern, primary_muscles[],
          secondary_muscles[], equipment_required[], instructions_fr[],
          instructions_en[], is_unilateral? }
  Response 201: Exercise

PUT    /exercises/:id        (is_custom=1 uniquement)
  Response 200: Exercise | 403

DELETE /exercises/:id        (is_custom=1, non référencé)
  Response 204 | 403 | 409

GET    /exercises/:id/history
  Query: limit=20  program_id?
  Response 200: { exercise_id, history: [{ session_id, session_date, sets[] }] }

GET    /exercises/:id/rm-history
  Query: days=90
  Response 200: { exercise_id, history: [{ date, estimated_1rm_kg, formula }] }
```

## 4.2 Équipement

```
GET    /equipment
  Response 200: { items: EquipmentItem[] }

POST   /equipment
  Body: { category, name, weight_kg?, count?, weight_min_kg?, weight_max_kg?,
          weight_step_kg?, resistance_min_kg?, resistance_max_kg?, notes? }
  Validations :
    category='plate' ou 'dumbbell_plate' → count pair ≥ 2
    category='dumbbell_loadable'         → count forcé à 2
    category='dumbbell_adjustable'       → weight_min/max/step obligatoires
  Response 201: EquipmentItem

PUT    /equipment/:id
  Response 200: EquipmentItem | 404

DELETE /equipment/:id
  Response 204 | 404

GET    /equipment/achievable-loads?exercise_id=XXX
  Response 200: {
    exercise_id, is_unilateral,
    loads_kg: float[],
    min_increment_kg: float,
    max_load_kg: float
  }
  Erreur 400 si exercise_id absent | 404 si exercice introuvable
```

**Catégories valides** (après migration 004) :
`barbell`, `ez_bar`, `plate`, `dumbbell_plate`, `dumbbell_fixed`,
`dumbbell_adjustable`, `dumbbell_loadable`, `kettlebell`, `resistance_band`,
`bench`, `bench_adjustable`, `rack`, `pullup_bar`, `cable_machine`,
`smith_machine`, `other`

## 4.3 Profil utilisateur

```
GET    /user-profile
  Response 200: UserProfile (singleton id=1)
  secondary_goals retourné en tableau JS (désérialisé)
  prefers_exercise_variation retourné en boolean

PUT    /user-profile
  Body: champs partiels (tous optionnels)
  Champs acceptés : display_name, age, sex, weight_kg, height_cm,
    fitness_level, primary_goal, secondary_goals[], target_weight_kg,
    sport_practiced, sessions_per_week, session_duration_min,
    prefers_exercise_variation, injury_notes, medical_notes,
    onboarding_completed, onboarding_step
  Validation : plages, enums, types
  Response 200: UserProfile
  Erreur 400 si champ inconnu ou valeur hors plage
```

## 4.4 Programmes

```
GET    /programs                  Query: active=1
POST   /programs
PUT    /programs/:id
DELETE /programs/:id              Erreur 409 si séance in_progress
POST   /programs/:id/activate
POST   /programs/generate         Body: { goal, level, days_per_week, priority_muscles[], equipment_ids[] }
GET    /programs/:id/next-session
POST   /programs/:id/deload       Déclenche deload manuel
POST   /programs/:id/end-deload   Termine le deload
```

## 4.5 Templates & Template-exercises

```
GET    /templates/:id
POST   /programs/:programId/templates
PUT    /templates/:id
DELETE /templates/:id
POST   /templates/:id/exercises     → crée aussi progression_state à 0
PUT    /template-exercises/:id
DELETE /template-exercises/:id
PUT    /template-exercises/reorder  Body: { items: [{ id, order_index }] }
```

## 4.6 Séances

```
GET    /sessions           Query: from, to, status, program_id, limit=50
GET    /sessions/:id
POST   /sessions
POST   /sessions/from-template/:templateId  Body: { scheduled_date, apply_rotation? }
POST   /sessions/:id/start
POST   /sessions/:id/complete       → progression + signaux + backup
POST   /sessions/:id/skip
PUT    /sessions/:id
DELETE /sessions/:id                Erreur 409 si in_progress
GET    /sessions/:id/target/:teId
```

## 4.7 Séries

```
GET    /session-exercises/:id/sets
POST   /session-exercises/:id/sets    → détection PR automatique
PUT    /sets/:id
DELETE /sets/:id
POST   /session-exercises             Body: { session_id, exercise_id, order_index? }
DELETE /session-exercises/:id
```

## 4.8 Poids de corps

```
GET    /bodyweight   Query: days
POST   /bodyweight   Erreur 409 si date doublon
PUT    /bodyweight/:id
DELETE /bodyweight/:id
```

## 4.9 Statistiques

```
GET    /stats/overview
GET    /stats/streaks
GET    /stats/volume          Query: weeks=12  group_by=week|muscle
GET    /stats/exercises/:id/progress  Query: days=180
GET    /stats/personal-records        Query: exercise_id?
```

## 4.10 Paramètres

```
GET    /settings              → tous sauf ai_api_key + ai_api_key_set: bool
PUT    /settings              → validation schéma strict (31 clés connues)
POST   /settings/test-ai
GET    /settings/ai-models
```

## 4.11 Coach IA

```
POST   /ai/chat               SSE — events: token | action | done | error
POST   /ai/apply-action       Validation schéma → 11 types d'actions
POST   /ai/apply-actions      Lot d'actions (onboarding)
GET    /ai/advice
POST   /ai/advice/:id/dismiss
POST   /ai/advice/:id/purchased
POST   /ai/generate-equipment-advice
```

## 4.12 Export / Import

```
GET    /export
POST   /import
GET    /export/csv/:table    table ∈ {sessions, set_logs, body_weights, personal_records}
POST   /backup               Déclenche backup manuel
```

---

# PARTIE 5 — Algorithmes

## 5.1 Calcul des charges atteignables (version complète avec nouvelles catégories)

```
FUNCTION calculateAchievableLoads(equipmentItems, exercise):
  eqTypes      = exercise.equipment_required
  isUnilateral = exercise.is_unilateral === 1

  IF eqTypes.length === 0:
    RETURN { loads_kg: [0], min_increment_kg: 0, max_load_kg: 0 }

  all_loads = new Set()

  // ── 1. Barres (barbell, ez_bar) + disques 'plate' ─────────
  barbells = equipmentItems.filter(i =>
    ['barbell','ez_bar'].includes(i.category) AND eqTypes.includes(i.category)
  )
  IF barbells.length > 0:
    barPlatePairs = equipmentItems
      .filter(i => i.category === 'plate')
      .map(i => { weight: i.weight_kg, max: floor(i.count / 2) })
      .filter(p => p.max > 0 AND p.weight > 0)

    perSide = dpSubsetSum(barPlatePairs)
    FOR bar IN barbells:
      FOR s IN perSide:
        all_loads.add(isUnilateral ? bar.weight_kg + s : bar.weight_kg + 2*s)

  // ── 2. Haltères à disques (dumbbell_loadable) ────────────
  // Satisfait aussi dumbbell_fixed pour la disponibilité de l'exercice
  exerciseNeedsDumbbells = eqTypes.includes('dumbbell_loadable')
    OR eqTypes.includes('dumbbell_fixed')
    OR eqTypes.includes('dumbbell_adjustable')

  IF exerciseNeedsDumbbells:
    handles = equipmentItems.filter(i => i.category === 'dumbbell_loadable' AND i.count >= 2)
    IF handles.length > 0:
      // Disques pour haltères : plate + dumbbell_plate
      dumbPlatePairs = equipmentItems
        .filter(i => ['plate','dumbbell_plate'].includes(i.category))
        .map(i => { weight: i.weight_kg, max: floor(i.count / 2) })
        .filter(p => p.max > 0 AND p.weight > 0)

      perSide = dpSubsetSum(dumbPlatePairs)
      FOR handle IN handles:
        FOR s IN perSide:
          // Charge par haltère = poignée + 2 côtés
          all_loads.add(handle.weight_kg + 2*s)

  // ── 3. Haltères fixes ─────────────────────────────────────
    equipmentItems
      .filter(i => i.category === 'dumbbell_fixed' AND i.count >= 2)
      .forEach(i => all_loads.add(i.weight_kg))

  // ── 4. Haltères réglables ─────────────────────────────────
    equipmentItems
      .filter(i => i.category === 'dumbbell_adjustable')
      .forEach(i => {
        w = i.weight_min_kg
        WHILE w <= i.weight_max_kg + 0.001:
          all_loads.add(round2(w))
          w = round2(w + i.weight_step_kg)
      })

  sorted = sort(all_loads)
  IF sorted.length === 0:
    RETURN { loads_kg: [], min_increment_kg: 0, max_load_kg: 0 }

  minInc = +Infinity
  FOR i IN 1..sorted.length-1:
    d = sorted[i] - sorted[i-1]
    IF d > 0.001: minInc = min(minInc, d)

  RETURN {
    loads_kg:         sorted,
    min_increment_kg: sorted.length <= 1 ? 0 : (minInc === Infinity ? 0 : minInc),
    max_load_kg:      sorted[sorted.length-1],
  }

FUNCTION dpSubsetSum(platePairs):
  current = Set([0])
  FOR { weight, max } IN platePairs:
    next = Set(current)
    FOR s IN current:
      FOR k IN 1..max:
        next.add(round2(s + k * weight))
    current = next
  RETURN current

FUNCTION round2(n):
  RETURN Math.round(n * 100) / 100
```

### Règles de sous-type pour `isEquipmentAvailable`

```javascript
function isEquipmentAvailable(equipmentRequired, equipmentItems) {
  if (!equipmentRequired || equipmentRequired.length === 0) return true
  const available = new Set(equipmentItems.map(i => i.category))

  // bench_adjustable satisfait bench
  if (available.has('bench_adjustable')) available.add('bench')

  // dumbbell_loadable satisfait dumbbell_fixed
  if (available.has('dumbbell_loadable')) available.add('dumbbell_fixed')

  // Toute forme d'haltère satisfait les autres
  if (available.has('dumbbell_fixed') || available.has('dumbbell_adjustable') ||
      available.has('dumbbell_loadable')) {
    available.add('dumbbell_fixed')
    available.add('dumbbell_adjustable')
    available.add('dumbbell_loadable')
  }

  return equipmentRequired.every(req => available.has(req))
}
```

### Exemples chiffrés

**Haltères à disques** :
```
Poignée 2 kg + dumbbell_plate 1 kg × 4 (2 paires/côté) + dumbbell_plate 0.5 kg × 8 (4 paires/côté)
DP côté : {0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6}
Charges  : 2+2×{0..6} = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]
Incrément : 1 kg
```

**Barre + plaques** (exemple original inchangé) :
```
Barre 1kg + plaques 1kg×4, 2kg×4, 5kg×2
Charges bilatérales : [1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23]
Incrément : 2 kg
```

## 5.2 Formules RM

```
FORMULAS = {
  epley:    (w, r) => r === 1 ? w : w * (1 + r/30),
  brzycki:  (w, r) => r >= 37 ? w : w * 36/(37-r),
  lander:   (w, r) => 100*w / (101.3 - 2.67123*r),
  oconner:  (w, r) => w * (1 + 0.025*r),
  lombardi: (w, r) => w * Math.pow(r, 0.10),
}

estimate1RM(w, r, formula='epley') → float
rmTable(estimated_1rm, formula='epley') → [{ reps: 1..15, weight_kg }]
```

Exemple : 100 kg × 3 reps → Epley → 1RM = 110 kg.

## 5.3 Génération de programme

Splits selon `days_per_week` :
- 2j → `full_body_2` | 3j débutant → `full_body_3` | 3j+ → `push_pull_legs`
- 4j → `upper_lower` | 5j → `upper_lower_x5` | 6j → `ppl_x2`

Sélection exercices : composés en priorité, filtrés par équipement disponible,
booster muscles prioritaires (exercice isolation supplémentaire si hypertrophie).

## 5.4 Moteur de progression

Trois modèles : `linear`, `double_progression`, `rpe_based`.
- **Linéaire** : succès → +incrément ; N échecs → -reduction_pct%
- **Double** : toutes séries ≥ max_reps → +poids ; ≥ min_reps → +1 rep ; échec → réduction
- **RPE** : diff vs cible ±1 → ajustement ±2.5% par point d'écart

`roundDownToAchievable(target, loads)` : plus grande charge ≤ target dans la liste.

## 5.5 Détection de plateau

```
N dernières séances, comparer RM Epley estimé le plus récent vs le plus ancien.
Si delta ≤ 1% → plateau.
```

## 5.6 Deload

**Automatique** : si `deload_auto_enabled` ET semaines_depuis_dernier_deload ≥ fréquence.
**Sur plateau** : si ≥ 50% des exercices actifs en plateau sur `plateau_sessions` séances.
**Calcul** : poids × (1 - load_reduction_pct/100), séries = max(min_sets, round(sets × (1 - vol_pct/100))).

## 5.7 Rotation d'exercices

`getExerciseForWeek(te, weekNumber, allExercises, equipmentItems)` :
- Cherche candidats : même movement_pattern + overlap muscles primaires + équipement dispo
- Index = (weekNumber - 1) % len(candidates)
- Semaine 1 → exercice de base (index 0)

## 5.8 Streaks

Semaines ISO avec ≥ 1 séance complétée. Streak courant : remonter depuis aujourd'hui en semaines consécutives.

## 5.9 Signaux équipement + coaching

**5 signaux équipement** :
1. `max_load_reached` — charge max atteinte N séances + reps dépassées
2. `min_increment_too_large` — incrément > seuil% ET plateau confirmé
3. `no_exercise_available` — aucun exercice faisable pour un muscle
4. `no_rotation_possible` — pas de candidat de rotation avec l'équipement
5. `persistent_plateau` — plateau long + incrément trop grand

**1 signal coaching** :
6. `high_fatigue` — RPE moyen ≥ 8.5 sur ≥ 10 séries des 21 derniers jours

Tous avec cooldown configurable (défaut 14 jours) et `INSERT OR IGNORE` pour éviter les doublons.

---

# PARTIE 6 — Spécification des écrans

## 6.1 Routes

```javascript
const ROUTES = {
  '#/'                       : 'DashboardView',
  '#/exercises'              : 'ExerciseListView',
  '#/exercises/new'          : 'ExerciseFormView',
  '#/exercises/:id/edit'     : 'ExerciseEditView',
  '#/exercises/:id'          : 'ExerciseDetailView',
  '#/equipment'              : 'EquipmentView',
  '#/programs'               : 'ProgramListView',
  '#/programs/new'           : 'ProgramCreateView',
  '#/programs/generate'      : 'ProgramGenerateView',
  '#/programs/:id/edit'      : 'ProgramEditView',
  '#/programs/:id'           : 'ProgramDetailView',
  '#/session'                : 'SessionActiveView',
  '#/session/history'        : 'SessionHistoryView',
  '#/session/:id'            : 'SessionDetailView',
  '#/calendar'               : 'CalendarView',
  '#/stats'                  : 'StatsDashboardView',
  '#/stats/exercise/:id'     : 'ExerciseProgressView',
  '#/stats/bodyweight'       : 'BodyWeightView',
  '#/coach'                  : 'CoachView',
  '#/settings'               : 'SettingsView',
}
```

## 6.2 Dashboard (`#/`)

Données : `GET /stats/overview`, `GET /ai/advice`.
Affiche : programme actif, streak, AdviceCard si conseil actif, CTA "Démarrer".
Si profil incomplet → bannière onboarding vers `#/coach`.

## 6.3 Séance active (`#/session`)

Charge `GET /sessions?status=in_progress`. Si aucune → EmptyState vers programmes.
SetRow : pré-rempli avec charge cible. Validation → PR toast si nouveau record.
Timers via Web Worker (arrière-plan). Wake Lock pendant la séance.

## 6.4 Équipement (`#/equipment`)

Formulaire adaptatif selon la catégorie :
- `dumbbell_loadable` → champ poids (1 poignée), quantité verrouillée à 2
- `dumbbell_plate` / `plate` → quantité paire obligatoire
- `bench_adjustable` → texte "Couvre aussi les exercices banc plat"
- `bench`, `rack`, etc. → pas de champ numérique

## 6.5 Paramètres (`#/settings`)

8 sections accordéon. Section IA : URL, clé (password), modèle, test, liste modèles.
Section réseau : restart_required si changé. Section données : export/import/backup/reset.

---

# PARTIE 7 — Coach IA Expert

## 7.1 Vue d'ensemble

Le coach est un **préparateur physique certifié** (niveau NSCA-CSCS). Il peut :
- Mener l'onboarding conversationnel complet (12 questions → profil + programme + équipement)
- Répondre à TOUTES les questions fitness (technique, nutrition, récupération, matériel, programmes)
- Configurer l'application via 11 types d'actions structurées

## 7.2 Normalisation URL

```javascript
function normalizeBaseUrl(url) {
  if (!url || typeof url !== 'string') return ''
  let u = url.trim().replace(/\/+$/, '')
  if (!u.endsWith('/v1')) u = u + '/v1'
  return u
}
// "https://api.openai.com"      → "https://api.openai.com/v1"
// "https://api.openai.com/v1/"  → "https://api.openai.com/v1"
// "http://localhost:11434"      → "http://localhost:11434/v1"
```

## 7.3 Prompt système expert

Assemblé par `src/services/systemPromptBuilder.js` à chaque requête.

**Sections** :
1. Identité : coach certifié (NSCA-CSCS équivalent), expertise force/hypertrophie/nutrition/récupération
2. Rôle dans l'app : peut tout configurer via actions structurées
3. Profil utilisateur (depuis `user_profile`) : âge, sexe, poids, taille, IMC, niveau, objectif, dispo, limitations
4. Équipement disponible (depuis `equipment_item`) : liste complète avec poids
5. Programme actif (depuis `program` + `progression_state`) : nom, objectif, niveau, semaine, progression par exercice
6. Historique (5 dernières séances) : date, durée, volume, RPE
7. Records personnels (top 8 par 1RM estimé)
8. Signaux actifs (count)
9. **Base de connaissances coaching** : principes surcharge progressive, science hypertrophie (MEV/MAV/MRV), protocoles force, nutrition evidence-based (protéines 1.6-2.2g/kg, créatine, caféine), récupération, ordre d'achat matériel (haltères réglables → barre → banc → rack → barre traction)
10. **Cues techniques** par exercice fondamental (squat, soulevé, développé, traction, OHP, rowing)
11. 11 actions disponibles (tableau)
12. **Mode onboarding** si `onboarding_completed = false` (protocole step-by-step)
13. 10 règles impératives (personnalisation, charges réalistes, sécurité, honnêteté scientifique, langue, concision, proactivité, actions, budget, pas de marques)

## 7.4 Onboarding conversationnel

Déclenché automatiquement si `user_profile.onboarding_completed = false`.

**Protocole** (UNE question à la fois, dans l'ordre) :

| Step | Question |
|---|---|
| `not_started` | Présentation + prénom + âge |
| `asking_basics` | Sexe, poids, taille |
| `asking_goals` | Objectif principal, secondaires, sport pratiqué |
| `asking_schedule` | Séances/sem, durée/séance, préférence variation |
| `asking_health` | Blessures/limitations (peut répondre "aucune") |
| `asking_equipment` | Liste de tout l'équipement disponible |
| `completing` | Récapitulatif + 4 actions en lot |

**Actions émises en fin d'onboarding** :
1. `complete_user_profile` (toutes les données)
2. `add_equipment` (pour chaque équipement listé — peut être plusieurs)
3. `create_program` (sur mesure selon profil)
4. `activate_program`

Chaque step met à jour `user_profile.onboarding_step` via une action `complete_user_profile` partielle.

## 7.5 Les 11 actions structurées

Format d'émission dans le stream :
```
```action
{ "action": "...", "explanation": "...", "data": { ... } }
```
```

| Action | Description |
|---|---|
| `complete_user_profile` | Mise à jour partielle du profil |
| `create_program` | Créer programme + templates + exercices |
| `update_program` | Modifier un programme existant |
| `activate_program` | Activer un programme (désactive les autres) |
| `create_session` | Créer une séance ponctuelle |
| `schedule_sessions` | Planifier plusieurs séances en lot |
| `add_equipment` | Ajouter un équipement à l'inventaire |
| `swap_exercise` | Remplacer un exercice dans un template |
| `update_progression_state` | Ajuster manuellement la charge |
| `update_settings` | Modifier des paramètres applicatifs |
| `trigger_deload` | Déclencher une semaine de déload |

**Validation** (dans `validateAction`) :
- `explanation` obligatoire et non vide
- `action` ∈ liste des 11 valeurs
- Pour `create_program` : chaque `exercise_id` vérifié en DB, plages sets/reps
- Pour `activate_program` / `update_program` : program_id existant en DB
- Pour `add_equipment` : category dans VALID_CATEGORIES, count pair si plate/dumbbell_plate
- Si KO → `400 { "error": "INVALID_ACTION_SCHEMA", "details": [...] }`

**Application** (dans `applyAction`) :
- Toujours dans une `db.transaction()`
- `create_program` crée aussi les `progression_state` à 0
- `activate_program` désactive d'abord tous les programmes
- Retourne `{ type, id, name }` ou objet similaire pour la redirection

## 7.6 Signaux et génération de texte

**5 signaux équipement** (T5.4) + **1 signal fatigue** :
- Prompts LLM différents par type de signal
- Stockés dans `equipment_advice` avec `advice_text = NULL` initialement
- `generatePendingAdviceTexts()` remplit `advice_text` en arrière-plan (non bloquant)

## 7.7 Gestion d'erreurs et streaming

```javascript
const AI_TIMEOUT_MS = 30_000

// Streaming SSE via generateur async
// Compatible OpenAI delta ET Ollama message
const token =
  parsed.choices?.[0]?.delta?.content ??
  parsed.choices?.[0]?.message?.content ?? ''

// Messages d'erreur par code HTTP :
// 401 → "Clé API invalide"
// 404 → "Endpoint introuvable (/v1 manquant ?)"
// 429 → "Limite atteinte, attendez"
// AbortError → "Délai dépassé (30 s)"
```

---

# PARTIE 8 — Base d'exercices

**Source** : `github.com/yuhonas/free-exercise-db` — Licence **Public Domain** — 800+ exercices + images JPG.

**Transformation** (`scripts/import-exercises.js`) :
- `equipment`: mapping vers les nouvelles catégories (`dumbbell` → `dumbbell_fixed`)
- `primaryMuscles` / `secondaryMuscles` : mapping vers notre nomenclature
- `movement_pattern` : inféré depuis category + force + mechanic + name
- `is_unilateral` : inféré depuis le nom (alternate, single, one-arm…)
- `name_fr` = `name_en` au départ (traduction progressive acceptable)
- ID : PascalCase → snake_case, déduplication si collision

**Images** : copiées dans `public/exercises/images/[slug]/0.jpg` et `1.jpg`.

---

# PARTIE 9 — Découpage en tâches

## JALON 1 — Socle, exercices, équipement (9 tâches)

| ID | Tâche | Dépendances | Fichier |
|---|---|---|---|
| T1.1 | Scaffolding projet | — | `T1.1_scaffolding.md` |
| T1.2 | Base de données et migrations | T1.1 | `T1.2_database.md` |
| T1.3 | Seed des exercices | T1.2 | `T1.3_seed.md` |
| T1.4 | API Exercices | T1.3 | `T1.4_api_exercises.md` |
| T1.5 | Service calcul charges + API Équipement | T1.2 | `T1.5_equipment_calc.md` |
| T1.6 | Scaffold frontend Vue 3 | T1.1 | `T1.6_frontend_scaffold.md` |
| T1.7 | Écrans Exercices + Équipement | T1.4, T1.5, T1.6 | `T1.7_screens_exercises.md` |
| T1.8 | PWA (manifest + service worker) | T1.6 | `T1.8_pwa.md` |
| **T1.9** | **Haltères à disques, disques haltères, banc inclinable** | **T1.5, T1.7** | **`T1.9_equipment_enhancements.md`** |

**T1.9 — détail** :
- Créer `004_equipment_enhancements.sql` (recrée `equipment_item` avec nouvelles catégories)
- Mettre à jour `calculateAchievableLoads` (algo dumbbell_loadable + dumbbell_plate)
- Mettre à jour `isEquipmentAvailable` dans `programGenerator.js` et `rotationEngine.js`
- Mettre à jour validation `POST /equipment` (count forcé à 2 pour dumbbell_loadable, pair pour dumbbell_plate)
- Mettre à jour `EquipmentForm.js` (labels, champs conditionnels, texte explicatif bench_adjustable)
- Tests unitaires + intégration

## JALON 2 — Programmes, mode séance, timers (5 tâches)

| ID | Tâche | Dépendances | Fichier |
|---|---|---|---|
| T2.1 | API Programmes et Templates | T1.2, T1.4 | `T2.1_api_programs.md` |
| T2.2 | API Sessions et Sets | T2.1 | `T2.2_api_sessions.md` |
| T2.3 | Écrans Programmes | T2.1, T1.6 | `T2.3_screens_programs.md` |
| T2.4 | Écran séance active + validation | T2.2, T1.6 | `T2.4_screen_session_active.md` |
| T2.5 | Timers (Web Worker + sons + Wake Lock) | T2.4 | `T2.5_timers.md` |

## JALON 3 — Progression, deload, calendrier (4 tâches)

| ID | Tâche | Dépendances | Fichier |
|---|---|---|---|
| T3.1 | Moteur de progression | T1.5, T2.2 | `T3.1_progression_engine.md` |
| T3.2 | Détection de plateau + deload | T3.1 | `T3.2_plateau_deload.md` |
| T3.3 | Rotation d'exercices | T3.1, T2.2 | `T3.3_rotation.md` |
| T3.4 | Calendrier (API + écran) | T2.2, T1.6 | `T3.4_calendar.md` |

## JALON 4 — Stats et courbes (3 tâches)

| ID | Tâche | Dépendances | Fichier |
|---|---|---|---|
| T4.1 | API Stats + streaks | T2.2, T3.1 | `T4.1_api_stats.md` |
| T4.2 | Poids de corps (écran + courbe) | T1.6, T4.1 | `T4.2_bodyweight.md` |
| T4.3 | Écrans statistiques complets | T4.1, T4.2 | `T4.3_screens_stats.md` |

## JALON 5 — Coach IA expert (5 tâches)

| ID | Tâche | Dépendances | Fichier |
|---|---|---|---|
| T5.1 | Service AI Provider + Settings IA | T1.2 | `T5.1_ai_provider.md` |
| **T5.2** | **Profil utilisateur + migration 003** | **T1.2** | **`T5.2_user_profile.md`** |
| **T5.3** | **API Chat expert + 11 actions** | **T5.1, T5.2, T2.1** | **`T5.3_api_chat_expert.md`** |
| **T5.4** | **Coaching Advisor + génération conseils** | **T5.1, T5.3, T3.2** | **`T5.4_coaching_advisor.md`** |
| **T5.5** | **Interface Coach + Onboarding conversationnel** | **T5.3, T5.4, T1.6** | **`T5.5_screen_coach.md`** |

**T5.2 — détail** :
- Migration `003_user_profile.sql` (table singleton + INSERT OR IGNORE id=1)
- Route `GET/PUT /user-profile` avec validation stricte de chaque champ
- Ajouter `userProfile` dans `api.js`

**T5.3 — détail** :
- `src/services/systemPromptBuilder.js` : prompt expert 2000+ tokens avec base de connaissances
- Section onboarding dans le prompt si `onboarding_completed = false`
- `validateAction` : 11 types, vérification DB pour chaque exercise_id / program_id
- `applyAction` : 11 cas, toujours dans transaction
- `POST /ai/apply-actions` : lot d'actions (pour l'onboarding)
- Parsing du bloc ` ```action ``` ` dans le stream SSE

**T5.4 — détail** :
- `src/services/coachingAdvisor.js` : 5 signaux équipement + signal `high_fatigue`
- `src/services/adviceTextGenerator.js` : prompts différents par type de signal, génération asynchrone
- Intégration dans `POST /sessions/:id/complete` (non bloquant)

**T5.5 — détail** :
- `OnboardingBanner.js` : bannière si profil incomplet
- `UserProfileCard.js` : récap profil dans le header coach
- `ActionPreview.js` : supporte les 11 types avec icônes et résumés lisibles
- `CoachView.js` : `startOnboarding()`, `applyCurrentAction()`, `POST /ai/apply-actions` pour l'onboarding
- Redirection après actions : programme créé → `#/programs/:id`

## JALON 6 — Paramètres, export/import (3 tâches)

| ID | Tâche | Dépendances | Fichier |
|---|---|---|---|
| T6.1 | API Paramètres complète | T1.2 | `T6.1_api_settings.md` |
| T6.2 | Écran Paramètres complet | T6.1, T5.1, T1.6 | `T6.2_screen_settings.md` |
| T6.3 | Export/Import + sauvegarde auto | T2.2, T6.1 | `T6.3_export_import.md` |

---

# PARTIE 10 — Stratégie de test

## 10.1 Tests unitaires obligatoires

| Fichier | Cas clés |
|---|---|
| `equipmentCalc.test.js` | Exemple spec (2 barres 1kg + plaques 1/2/5kg), unilatéral, edge cases |
| `equipmentCalc_enhancements.test.js` | dumbbell_loadable + dumbbell_plate, cohabitation, bench_adjustable |
| `progressionEngine.test.js` | 3 modèles × succès/échec/seuil, roundDownToAchievable |
| `plateauDetector.test.js` | Pas assez de données, plateau détecté, progression réelle |
| `deloadEngine.test.js` | Deload planifié, sur plateau, déjà en deload, computeDeloadTargets |
| `coachingAdvisor.test.js` | Aucun programme, signal no_exercise_available, cooldown |
| `rmCalculator.test.js` | Epley 100×3=110, reps=1, poids=0, tableau RM |
| `streakCalculator.test.js` | DB vide, gap, longest streak, isoWeek limites d'année |
| `aiProvider.test.js` | 8 cas normalizeBaseUrl (vide, slash, /v1, /v1/) |
| `rotationEngine.test.js` | Rotation cyclique, 1 seul candidat, équipement manquant |

## 10.2 Tests d'intégration

| Fichier | Scénario |
|---|---|
| `session.test.js` | Séance complète bout en bout : créer → démarrer → 4 séries → compléter → vérifier volume + PR + progression |
| `api.test.js` | Smoke test tous les endpoints (200/201/204 cas nominal, 404 sur IDs inexistants) |
| `exercises.test.js` | GET/POST/PUT/DELETE exercices, filtres, history |
| `programs.test.js` | Génération automatique, activation, séquence next-session |
| `stats.test.js` | Overview, volume, progress, personal-records |
| `userProfile.test.js` | CRUD profil, onboarding_completed, secondary_goals tableau |
| `ai.test.js` | apply-action pour les 11 types, validation, lot d'actions |
| `exportImport.test.js` | Export → Import → re-export, CSV, backup, reset |
| `equipmentEnhancements.test.js` | Nouvelles catégories API, achievable-loads avec dumbbell_loadable |

---

# PARTIE 11 — Hypothèses, risques et points ouverts

## Hypothèses

| ID | Décision |
|---|---|
| H1 | Nom = **WorkoutBuddy**, slug `workoutbuddy` |
| H2 | Port par défaut = **3000** |
| H3 | `name_fr` = `name_en` pour les exercices importés (traduction future) |
| H4 | Un seul programme **actif** à la fois |
| H5 | Les timers ne fonctionnent pas en arrière-plan strict sur Safari iOS — disclaimer affiché |
| H6 | `fs.copyFileSync()` bloquant pour l'auto-backup — acceptable jusqu'à ~100 MB |
| H7 | Images d'exercices servies statiquement (~50 MB) — pas de lazy-loading serveur |
| H8 | SSE via `res.write()` — Express 4 sans configuration spéciale |
| H9 | Formule RM par défaut : **Epley** |
| H10 | Le texte des conseils d'achat est généré en français (instruction dans le prompt) |
| H11 | `dumbbell_plate` et `plate` sont cumulés pour les haltères à disques |
| H12 | `bench_adjustable` satisfait `bench` via la règle de sous-type |
| H13 | Le profil utilisateur est un singleton (une seule ligne en DB) |
| H14 | L'onboarding démarre automatiquement si `onboarding_completed = false` |
| H15 | Le coach peut émettre plusieurs blocs action consécutifs ; `POST /ai/apply-actions` les applique en lot |

## Risques

| Risque | Probabilité | Mitigation |
|---|---|---|
| better-sqlite3 compilation native (node-gyp) | Moyen | README : `xcode-select --install` |
| Ollama SSE format légèrement différent | Moyen | Tester avec Ollama en T5.1, double-parsed (`delta.content ?? message.content`) |
| free-exercise-db : champ `equipment: null` | Haut | Traiter null comme `[]` dans import-exercises.js |
| Wake Lock non disponible (Firefox, iOS) | Haut | Catch silencieux, re-acquérir sur `visibilitychange` |
| Import JSON corrompu | Moyen | Validation stricte + backup auto avant import |
| Chart.js `type:'time'` sans adaptateur | Moyen | Fallback `type:'category'` si l'axe ne s'affiche pas |
| Migration 004 : DROP TABLE avec données | Faible | Backup dans `equipment_item_backup` avant DROP, restauré après CREATE |
| Onboarding LLM mal guidé (modèle faible) | Moyen | Protocole très explicite dans le prompt, étape courante indiquée |

## Points ouverts non bloquants

1. **Traductions FR** : 800 exercices à traduire. Solution recommandée : appel LLM batch hors-ligne.
2. **Son timer iOS** : non déclenchable en arrière-plan strict sur Safari. Notification Web Push nécessiterait HTTPS.
3. **LAN macOS** : le firewall peut bloquer le port 3000. Note dans README.
4. **Export CSV** : BOM UTF-8 (`\uFEFF`) pour Excel France, séparateur `;`.
5. **Unités lb** : tout stocké en kg, conversion à l'affichage uniquement.
6. **`dumbbell_plate` dans import-exercises.js** : les exercices de free-exercise-db utilisent `dumbbell` → mappé vers `dumbbell_fixed`. Si l'utilisateur possède des poignées à disques, il les saisit manuellement.
7. **Thème clair** : variables CSS `[data-theme="light"]` à créer dans `themes.css` (non prioritaire MVP).

---

# GLOSSAIRE

| Terme | Définition |
|---|---|
| `workout_template` | Modèle de séance attaché à un programme (ex : "Push A") |
| `session` | Instance concrète d'une séance, planifiée ou réalisée |
| `template_exercise` | Exercice dans un template avec paramètres de progression |
| `session_exercise` | Exercice dans une session concrète |
| `set_log` | Une série individuelle (poids, reps, RPE) |
| `progression_state` | État courant de la progression pour un `template_exercise` |
| 1RM / RM estimé | Maximum estimé pour 1 répétition, calculé depuis une série |
| Double progression | Augmenter d'abord les reps, puis le poids |
| Deload | Semaine à charge et volume réduits |
| Plateau | Stagnation du RM estimé sur N séances consécutives |
| Rotation | Alternance hebdomadaire d'exercices équivalents |
| Signal équipement | Condition déterministe détectant un besoin de matériel |
| RIR | Reps In Reserve — répétitions restantes avant l'échec |
| RPE | Rate of Perceived Exertion — intensité perçue (6–10) |
| `dumbbell_loadable` | Poignée d'haltère à disques (poids poignée + disques par côté) |
| `dumbbell_plate` | Disque spécifique aux haltères (ne va pas sur une barre) |
| `bench_adjustable` | Banc réglable/inclinable — satisfait aussi `bench` |
| `user_profile` | Table singleton (id=1) — profil + données onboarding |
| Onboarding | Processus conversationnel de collecte du profil utilisateur |
| Action structurée | Bloc JSON émis par le LLM pour configurer l'application |
| Vendorisé | Dépendance front copiée localement dans `public/vendor/` |
| SSE | Server-Sent Events — flux unidirectionnel serveur → client |
| PWA | Progressive Web App — installable depuis le navigateur |
| LAN | Réseau local — accès depuis un téléphone |
| MEV/MAV/MRV | Minimum/Maximum Adaptive/Maximum Recoverable Volume |

---

# RÉCAPITULATIF

## Chiffres clés

| Élément | Nombre |
|---|---|
| Jalons | **6** |
| Tâches | **29** (T1.1→T1.9, T2.1→T2.5, T3.1→T3.4, T4.1→T4.3, T5.1→T5.5, T6.1→T6.3) |
| Migrations DB | **4** (001→004) |
| Endpoints API | **60+** |
| Tables SQL | **13** (+ user_profile) |
| Services métier | **12** |
| Types d'actions coach | **11** |
| Signaux équipement/coaching | **6** |
| Catégories équipement | **16** |

## Ordre d'exécution recommandé

```
T1.1 → T1.2 → T1.3 → T1.4 → T1.5 → T1.6 → T1.7 → T1.8 → T1.9
                                                                   ↓
T2.1 → T2.2 → T2.3 → T2.4 → T2.5
                                   ↓
T3.1 → T3.2 → T3.3 → T3.4
                           ↓
T4.1 → T4.2 → T4.3
                   ↓
T5.1 → T5.2 → T5.3 → T5.4 → T5.5
                                   ↓
T6.1 → T6.2 → T6.3
```

## Critères d'acceptation du produit final

| Critère | Tâche validante |
|---|---|
| Démarrage en une commande ; séance complète sans erreur sur mobile | T2.4, T2.5 |
| Progression propose des charges réalisables avec le matériel configuré | T1.5, T1.9, T3.1 |
| Haltères à disques calculés correctement | T1.9 |
| Banc inclinable satisfait les exercices de banc | T1.9 |
| Coach mène l'onboarding complet et crée le programme | T5.2, T5.3, T5.5 |
| Coach répond aux questions fitness avec expertise | T5.3 |
| Coach signale un besoin matériel sans spam | T5.4 |
| Aucune dépendance à licence commerciale | T1.1 |
| Données survivent au redémarrage + export/import | T1.2, T6.3 |
````