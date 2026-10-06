
---

# Plan d'implémentation — WorkoutBuddy
### Document de référence — version 1.0
> Toutes les décisions sont figées. Aucun « à définir ». L'implémenteur suit ce document séquentiellement.

---

# PARTIE 1 — Décisions d'architecture

## 1.1 Nom de l'application
**WorkoutBuddy**. Slug utilisé partout : `WorkoutBuddy`.

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

**Dépendances runtime `package.json`** : 2 paquets uniquement (`express`, `better-sqlite3`).  
**Dépendances dev** : 1 paquet (`supertest`).  
**Frontend** : zéro paquet npm — Vue 3 et Chart.js sont des fichiers `.js` locaux dans `public/vendor/`, téléchargés une seule fois par `scripts/download-vendors.js`.

## 1.3 Justifications

- **Pas de build frontend** : Vue 3 `esm-browser.prod.js` inclut le compilateur de templates. Les composants sont des objets JS purs avec `template: \`...\`` en string. Zéro Webpack/Vite/Rollup. `npm start` = `node server.js`, rien d'autre.
- **better-sqlite3 synchrone** : L'API synchrone élimine les callbacks et les `async/await` imbriqués dans les services. 5× plus rapide que `node-sqlite3`. Un seul fichier `.db` = backup trivial.
- **Express vs Fastify** : Express a 10× plus d'exemples sur internet — l'implémenteur (LLM moyen) trouvera de l'aide plus facilement.
- **fetch() natif** : Node.js 20 le fournit nativement, supporte le streaming ReadableStream pour les SSE.
- **Vue 3 sans Pinia** : `reactive()` + `provide/inject` suffisent pour l'état d'une SPA mono-utilisateur. Évite une dépendance.

## 1.4 Commande de démarrage unique

```bash
npm start          # dans le dossier racine WorkoutBuddy/
```

Séquence d'initialisation dans `server.js` :
1. Lire `data/WorkoutBuddy.db` (créer si absent)
2. Exécuter les migrations (`src/db/migrate.js`)
3. Si table `exercise` vide → lancer `src/seed/seed.js`
4. Lire le setting `network_host` (défaut `127.0.0.1`) et `network_port` (défaut `3000`)
5. Lancer Express sur l'adresse et port lus

## 1.5 Fichiers vendorisés (téléchargement unique)

```bash
node scripts/download-vendors.js
```

Ce script télécharge depuis jsDelivr (ou npm registry) :

| Fichier local | Source | Hash SHA-256 à vérifier |
|---|---|---|
| `public/vendor/vue.esm-browser.prod.js` | `https://cdn.jsdelivr.net/npm/vue@3.5.13/dist/vue.esm-browser.prod.js` | (noté dans README après téléchargement) |
| `public/vendor/chart.umd.min.js` | `https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js` | (noté dans README après téléchargement) |

---

# PARTIE 2 — Arborescence complète

```
WorkoutBuddy/
│
├── server.js                          # Entrée. Express + migrations + seed + écoute
├── package.json                       # {name,version,main,scripts,dependencies,devDependencies}
├── package-lock.json
├── .env.example                       # PORT=3000  DB_PATH=./data/WorkoutBuddy.db
├── README.md                          # Instructions démarrage, LAN, backup, tests
│
├── data/                              # Gitignored — créé à l'exécution
│   ├── WorkoutBuddy.db                     # Base SQLite unique
│   └── backups/                       # Sauvegardes auto (7 dernières)
│       └── WorkoutBuddy_YYYY-MM-DD.db
│
├── src/
│   ├── db/
│   │   ├── database.js                # Singleton : ouvre better-sqlite3, retourne l'instance
│   │   ├── migrate.js                 # Lit migrations/*.sql, exécute les non-appliquées
│   │   └── migrations/
│   │       ├── 001_schema.sql         # Toutes les tables (schéma complet)
│   │       └── 002_default_settings.sql  # INSERT OR IGNORE des valeurs par défaut
│   │
│   ├── routes/                        # Montés dans server.js sous /api/v1/
│   │   ├── exercises.js               # CRUD exercices + historique + RM-history
│   │   ├── equipment.js               # CRUD équipement + GET /achievable-loads
│   │   ├── programs.js                # CRUD programmes + activate + generate
│   │   ├── templates.js               # CRUD workout_template + template_exercise
│   │   ├── sessions.js                # CRUD sessions + start + complete + from-template
│   │   ├── sets.js                    # CRUD set_log + session_exercise
│   │   ├── bodyweight.js              # CRUD body_weight
│   │   ├── stats.js                   # Statistiques lecture seule
│   │   ├── ai.js                      # Chat SSE + conseils + apply-action
│   │   ├── settings.js                # CRUD settings (masque ai_api_key)
│   │   └── exportImport.js            # GET /export, POST /import, GET /export/csv/:table
│   │
│   ├── services/
│   │   ├── equipmentCalc.js           # calculateAchievableLoads(), calculateMinIncrement()
│   │   ├── rmCalculator.js            # estimate1RM(), rmTable(), FORMULAS map
│   │   ├── progressionEngine.js       # computeNextState() par modèle
│   │   ├── plateauDetector.js         # detectPlateau()
│   │   ├── deloadEngine.js            # shouldDeload(), computeDeloadTargets()
│   │   ├── rotationEngine.js          # getExerciseForWeek(), findRotationCandidates()
│   │   ├── programGenerator.js        # generateProgram() — logique pure, pas de DB
│   │   ├── streakCalculator.js        # calculateStreaks()
│   │   ├── equipmentAdvisor.js        # runAllSignalChecks() → SignalResult[]
│   │   └── aiProvider.js              # normalizeBaseUrl(), streamChat(), listModels()
│   │
│   └── seed/
│       ├── exercises.json             # ~800 exercices transformés depuis free-exercise-db
│       └── seed.js                    # Insert exercises.json dans DB si table vide
│
├── public/                            # Servi statiquement par Express
│   ├── index.html                     # Shell SPA unique — charge app.js en module
│   ├── manifest.json                  # PWA manifest
│   ├── sw.js                          # Service Worker : cache static assets
│   ├── offline.html                   # Page fallback hors-ligne
│   │
│   ├── vendor/
│   │   ├── vue.esm-browser.prod.js    # Vue 3.5.13, MIT
│   │   └── chart.umd.min.js           # Chart.js 4.4.4, MIT
│   │
│   ├── icons/
│   │   ├── icon-192.png               # PWA icon 192×192
│   │   └── icon-512.png               # PWA icon 512×512
│   │
│   ├── sounds/
│   │   └── timer-end.mp3              # Son fin de repos (libre de droits, <50 KB)
│   │
│   ├── locales/
│   │   ├── fr.json                    # Toutes les chaînes — langue par défaut
│   │   └── en.json                    # Traductions EN
│   │
│   ├── exercises/
│   │   └── images/                    # Images depuis free-exercise-db (public domain)
│   │       └── [ExerciseSlug]/
│   │           ├── 0.jpg
│   │           └── 1.jpg
│   │
│   └── js/
│       ├── app.js                     # createApp, enregistre composants, mount('#app')
│       ├── router.js                  # Hash router 60 lignes — définit toutes les routes
│       ├── store.js                   # État global : reactive({}) + provide/inject
│       ├── api.js                     # Wrappers fetch() typés vers /api/v1/
│       ├── i18n.js                    # t(key, params) — locale réactive
│       ├── timer-worker.js            # Web Worker : setInterval tick + messages
│       │
│       ├── utils/
│       │   ├── rm.js                  # estimate1RM(), rmTable() (miroir client de rmCalculator)
│       │   ├── weight.js              # kgToLb(), lbToKg(), formatWeight(v, unit)
│       │   └── date.js                # isoDate(), isoWeek(), formatDate(), daysBetween()
│       │
│       └── components/
│           ├── layout/
│           │   ├── AppShell.js        # Conteneur principal : BottomNav + RouterView
│           │   ├── BottomNav.js       # 5 onglets : Accueil, Séance, Stats, Coach, Réglages
│           │   └── PageHeader.js      # Titre + bouton retour + slot actions
│           ├── common/
│           │   ├── LoadingSpinner.js
│           │   ├── ErrorBanner.js     # Affiche message + bouton retry
│           │   ├── EmptyState.js      # Icône + message + slot CTA
│           │   ├── ConfirmModal.js    # Modal générique : titre, corps, annuler/confirmer
│           │   └── Toast.js           # Notification flottante 3 sec
│           ├── exercises/
│           │   ├── ExerciseListView.js
│           │   ├── ExerciseCard.js
│           │   ├── ExerciseDetailView.js
│           │   ├── ExerciseFilter.js  # Filtres : muscle, équipement, mouvement
│           │   └── ExerciseForm.js    # Création/édition exercice custom
│           ├── equipment/
│           │   ├── EquipmentView.js
│           │   ├── EquipmentItem.js
│           │   └── EquipmentForm.js
│           ├── programs/
│           │   ├── ProgramListView.js
│           │   ├── ProgramCard.js
│           │   ├── ProgramDetailView.js
│           │   ├── ProgramForm.js     # Édition manuelle (meta + templates)
│           │   ├── ProgramGenerator.js # Formulaire → POST /programs/generate
│           │   ├── TemplateEditor.js  # Édition d'un workout_template
│           │   └── ExerciseSelector.js # Picker filtrable d'exercice
│           ├── session/
│           │   ├── SessionActiveView.js   # Écran séance en cours
│           │   ├── ExerciseBlock.js       # Un exercice : liste de SetRow
│           │   ├── SetRow.js              # Poids + reps + bouton valider + RPE optionnel
│           │   ├── RestTimer.js           # Compte à rebours cercle SVG
│           │   ├── SessionTimer.js        # Durée totale HH:MM:SS
│           │   ├── ExerciseHelp.js        # Modal : GIF/images + instructions + tableau RM
│           │   ├── SessionHistoryView.js
│           │   └── SessionDetailView.js
│           ├── calendar/
│           │   └── CalendarView.js        # Grille mensuelle
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
│           │   ├── ActionPreview.js   # Affiche l'action JSON avant confirmation
│           │   └── AdviceCard.js      # Conseil d'achat équipement
│           └── settings/
│               ├── SettingsView.js
│               ├── SettingsSection.js # Bloc accordéon
│               ├── AIProviderForm.js  # URL, clé, modèle, boutons test/list
│               └── ExportImport.js
│
├── scripts/
│   ├── download-vendors.js            # Télécharge Vue + Chart.js dans public/vendor/
│   └── import-exercises.js            # Transforme free-exercise-db → src/seed/exercises.json
│
└── tests/
    ├── unit/
    │   ├── equipmentCalc.test.js
    │   ├── progressionEngine.test.js
    │   ├── plateauDetector.test.js
    │   ├── deloadEngine.test.js
    │   ├── equipmentAdvisor.test.js
    │   ├── rmCalculator.test.js
    │   └── streakCalculator.test.js
    └── integration/
        ├── session.test.js            # Séance complète bout en bout
        └── api.test.js                # Smoke tests tous les endpoints
```

---

# PARTIE 3 — Schéma de données complet

## 3.1 Migration 001 — Schéma initial (`src/db/migrations/001_schema.sql`)

```sql
-- ── Versionnage ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS schema_version (
  version    INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── Exercices ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS exercise (
  id                 TEXT    PRIMARY KEY,             -- slug ex: "bench_press_barbell"
  name_fr            TEXT    NOT NULL,
  name_en            TEXT    NOT NULL,
  category           TEXT    NOT NULL                 -- 'strength'|'cardio'|'stretching'|'plyometrics'
                     CHECK(category IN ('strength','cardio','stretching','plyometrics','olympic_weightlifting')),
  force              TEXT,                            -- 'push'|'pull'|'static'|NULL
  mechanic           TEXT,                            -- 'compound'|'isolation'|NULL
  movement_pattern   TEXT    NOT NULL                 -- voir liste ci-dessous
                     CHECK(movement_pattern IN (
                       'push_horizontal','push_vertical',
                       'pull_horizontal','pull_vertical',
                       'squat','hinge','lunge','carry','core','rotation','other'
                     )),
  primary_muscles    TEXT    NOT NULL,                -- JSON array : ["chest","triceps"]
  secondary_muscles  TEXT    NOT NULL DEFAULT '[]',   -- JSON array
  equipment_required TEXT    NOT NULL DEFAULT '[]',   -- JSON array : ["barbell","bench"]
  instructions_fr    TEXT    NOT NULL DEFAULT '[]',   -- JSON array de strings
  instructions_en    TEXT    NOT NULL DEFAULT '[]',   -- JSON array de strings
  image_paths        TEXT    NOT NULL DEFAULT '[]',   -- JSON array ex: ["bench_press_barbell/0.jpg"]
  is_custom          INTEGER NOT NULL DEFAULT 0       CHECK(is_custom IN (0,1)),
  is_unilateral      INTEGER NOT NULL DEFAULT 0       CHECK(is_unilateral IN (0,1)),
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
  name                TEXT    NOT NULL,               -- ex: "Barre olympique 20 kg"
  weight_kg           REAL,                           -- barbell/dumbbell_fixed/kettlebell weight
  count               INTEGER NOT NULL DEFAULT 1,    -- nb d'unités (plates: total, toujours pair)
  weight_min_kg       REAL,                           -- dumbbell_adjustable
  weight_max_kg       REAL,                           -- dumbbell_adjustable
  weight_step_kg      REAL,                           -- dumbbell_adjustable incrément
  resistance_min_kg   REAL,                           -- resistance_band
  resistance_max_kg   REAL,                           -- resistance_band
  notes               TEXT,
  created_at          TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ── Programmes ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS program (
  id                        INTEGER PRIMARY KEY AUTOINCREMENT,
  name                      TEXT    NOT NULL,
  description               TEXT,
  goal                      TEXT    NOT NULL
                            CHECK(goal IN ('strength','hypertrophy','endurance','weight_loss','general_fitness')),
  level                     TEXT    NOT NULL
                            CHECK(level IN ('beginner','intermediate','advanced')),
  days_per_week             INTEGER NOT NULL CHECK(days_per_week BETWEEN 2 AND 6),
  duration_weeks            INTEGER,                  -- NULL = indéfini
  is_active                 INTEGER NOT NULL DEFAULT 0 CHECK(is_active IN (0,1)),
  use_exercise_rotation     INTEGER NOT NULL DEFAULT 0 CHECK(use_exercise_rotation IN (0,1)),
  rotation_frequency_weeks  INTEGER NOT NULL DEFAULT 1,
  progression_model         TEXT    NOT NULL DEFAULT 'double_progression'
                            CHECK(progression_model IN ('linear','double_progression','rpe_based')),
  deload_auto_enabled       INTEGER NOT NULL DEFAULT 0 CHECK(deload_auto_enabled IN (0,1)),
  deload_frequency_weeks    INTEGER NOT NULL DEFAULT 6,
  deload_load_reduction_pct INTEGER NOT NULL DEFAULT 20,
  deload_volume_reduction_pct INTEGER NOT NULL DEFAULT 40,
  last_deload_date          TEXT,                     -- YYYY-MM-DD
  is_in_deload              INTEGER NOT NULL DEFAULT 0 CHECK(is_in_deload IN (0,1)),
  current_week              INTEGER NOT NULL DEFAULT 1,
  created_at                TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at                TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ── Templates de séance ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS workout_template (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  program_id       INTEGER NOT NULL REFERENCES program(id) ON DELETE CASCADE,
  name             TEXT    NOT NULL,                  -- ex: "Jour A – Push"
  day_of_week      INTEGER,                           -- 0=Lun … 6=Dim ; NULL=flottant
  order_index      INTEGER NOT NULL DEFAULT 0,
  created_at       TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_wt_program ON workout_template(program_id);

-- ── Exercices dans un template ───────────────────────────────
CREATE TABLE IF NOT EXISTS template_exercise (
  id                             INTEGER PRIMARY KEY AUTOINCREMENT,
  workout_template_id            INTEGER NOT NULL REFERENCES workout_template(id) ON DELETE CASCADE,
  exercise_id                    TEXT    NOT NULL REFERENCES exercise(id),
  order_index                    INTEGER NOT NULL DEFAULT 0,
  target_sets                    INTEGER NOT NULL DEFAULT 3,
  target_reps_min                INTEGER NOT NULL DEFAULT 8,
  target_reps_max                INTEGER NOT NULL DEFAULT 12,
  target_reps                    INTEGER,             -- pour linear (fixe)
  rest_seconds                   INTEGER NOT NULL DEFAULT 90,
  progression_model              TEXT    NOT NULL DEFAULT 'inherit'
                                 CHECK(progression_model IN ('inherit','linear','double_progression','rpe_based')),
  progression_weight_increment_kg REAL,              -- NULL = auto depuis équipement
  rir_target                     INTEGER,             -- Reps In Reserve cible
  rpe_target                     REAL,               -- RPE cible (6.0–10.0)
  rotation_group                 TEXT,               -- NULL ou slug du groupe de rotation
  current_rotation_index         INTEGER NOT NULL DEFAULT 0,
  notes                          TEXT,
  created_at                     TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_te_template ON template_exercise(workout_template_id);
CREATE INDEX IF NOT EXISTS idx_te_exercise ON template_exercise(exercise_id);

-- ── État de progression par exercice/template ────────────────
CREATE TABLE IF NOT EXISTS progression_state (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  template_exercise_id  INTEGER NOT NULL UNIQUE REFERENCES template_exercise(id) ON DELETE CASCADE,
  current_weight_kg     REAL    NOT NULL DEFAULT 0,
  current_target_reps   INTEGER,                     -- double prog : cible courante dans [min,max]
  consecutive_failures  INTEGER NOT NULL DEFAULT 0,
  last_session_id       INTEGER REFERENCES session(id),
  last_updated          TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ── Séances ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS session (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  workout_template_id INTEGER REFERENCES workout_template(id),  -- NULL si libre
  program_id          INTEGER REFERENCES program(id),
  name                TEXT    NOT NULL,
  scheduled_date      TEXT    NOT NULL,              -- YYYY-MM-DD
  started_at          TEXT,                          -- ISO datetime
  completed_at        TEXT,                          -- ISO datetime
  status              TEXT    NOT NULL DEFAULT 'planned'
                      CHECK(status IN ('planned','in_progress','completed','skipped')),
  duration_seconds    INTEGER,                       -- calculé à la complétion
  total_volume_kg     REAL,                          -- calculé à la complétion
  rpe_avg             REAL,                          -- calculé à la complétion
  is_deload           INTEGER NOT NULL DEFAULT 0    CHECK(is_deload IN (0,1)),
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
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  session_exercise_id  INTEGER NOT NULL REFERENCES session_exercise(id) ON DELETE CASCADE,
  set_number           INTEGER NOT NULL,
  weight_kg            REAL    NOT NULL DEFAULT 0,
  reps                 INTEGER NOT NULL DEFAULT 0,
  rpe                  REAL,                         -- 6.0–10.0, NULL si non renseigné
  rir                  INTEGER,                      -- 0–5, NULL si non renseigné
  is_warmup            INTEGER NOT NULL DEFAULT 0   CHECK(is_warmup IN (0,1)),
  is_completed         INTEGER NOT NULL DEFAULT 0   CHECK(is_completed IN (0,1)),
  duration_seconds     INTEGER,
  rest_seconds_after   INTEGER,                      -- repos effectif après cette série
  notes                TEXT,
  created_at           TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sl_session_exercise ON set_log(session_exercise_id);

-- ── Poids de corps ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS body_weight (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  date       TEXT    NOT NULL UNIQUE,                -- YYYY-MM-DD
  weight_kg  REAL    NOT NULL,
  notes      TEXT,
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_bw_date ON body_weight(date);

-- ── Records personnels ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS personal_record (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  exercise_id      TEXT    NOT NULL REFERENCES exercise(id),
  reps             INTEGER NOT NULL,                 -- 1RM, 3RM, 5RM…
  weight_kg        REAL    NOT NULL,
  estimated_1rm_kg REAL    NOT NULL,
  achieved_date    TEXT    NOT NULL,                 -- YYYY-MM-DD
  set_log_id       INTEGER REFERENCES set_log(id),
  created_at       TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_pr_exercise ON personal_record(exercise_id, reps, estimated_1rm_kg DESC);

-- ── Conseils d'achat équipement ───────────────────────────────
CREATE TABLE IF NOT EXISTS equipment_advice (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  signal_type         TEXT    NOT NULL
                      CHECK(signal_type IN (
                        'max_load_reached','min_increment_too_large',
                        'no_exercise_available','no_rotation_possible',
                        'persistent_plateau'
                      )),
  exercise_id         TEXT    REFERENCES exercise(id),
  muscle_group        TEXT,
  movement_pattern    TEXT,
  signal_data         TEXT    NOT NULL,              -- JSON objet structuré (voir Partie 7)
  advice_text         TEXT,                          -- Texte généré par le LLM
  status              TEXT    NOT NULL DEFAULT 'active'
                      CHECK(status IN ('active','dismissed','purchased')),
  dismissed_at        TEXT,
  purchased_at        TEXT,
  last_generated_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  created_at          TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_advice_status ON equipment_advice(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_advice_unique ON equipment_advice(signal_type, exercise_id, muscle_group)
  WHERE status = 'active';

-- ── Paramètres ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,                          -- JSON encodé
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

## 3.2 Migration 002 — Paramètres par défaut (`src/db/migrations/002_default_settings.sql`)

```sql
INSERT OR IGNORE INTO settings (key, value) VALUES
  ('unit',                               '"kg"'),
  ('rm_formula',                         '"epley"'),
  ('default_rest_seconds',               '90'),
  ('theme',                              '"dark"'),
  ('language',                           '"fr"'),
  ('network_host',                       '"127.0.0.1"'),
  ('network_port',                       '3000'),
  ('ai_base_url',                        '""'),
  ('ai_model',                           '""'),
  ('ai_api_key',                         '""'),
  ('progression_failure_threshold',      '2'),
  ('progression_weight_reduction_pct',   '10'),
  ('plateau_detection_sessions',         '4'),
  ('deload_auto_enabled',                'false'),
  ('deload_frequency_weeks',             '6'),
  ('deload_load_reduction_pct',          '20'),
  ('deload_volume_reduction_pct',        '40'),
  ('deload_min_sets',                    '2'),
  ('equipment_advice_cooldown_days',     '14'),
  ('linear_increment_kg',                '2.5'),
  ('linear_dumbbell_increment_kg',       '2.0'),
  ('bodyweight_display_days',            '90'),
  ('timer_sound_enabled',                'true'),
  ('timer_vibration_enabled',            'true'),
  ('show_rpe_field',                     'false'),
  ('show_rir_field',                     'false'),
  ('equipment_advice_max_load_sessions', '3'),
  ('equipment_advice_min_increment_pct', '5'),
  ('equipment_advice_plateau_sessions',  '6'),
  ('warmup_sets_count',                  '0'),
  ('auto_next_exercise',                 'false');
```

## 3.3 Exécuteur de migrations (`src/db/migrate.js`)

```javascript
// Signature
function migrate(db) → void
// Lit tous les fichiers src/db/migrations/*.sql triés par nom.
// Vérifie schema_version pour ne pas ré-appliquer.
// Exécute chaque migration dans une transaction.
// En cas d'erreur : throw Error avec numéro de migration + message SQL.
```

---

# PARTIE 4 — Contrats d'API

**Base URL** : `/api/v1`  
**Content-Type** : `application/json` pour toutes les requêtes/réponses sauf `/ai/chat` (SSE) et `/export` (téléchargement).  
**Codes d'erreur communs** :
- `400` — corps ou paramètres invalides → `{ "error": "MESSAGE_EXPLICITE" }`
- `404` — ressource introuvable → `{ "error": "NOT_FOUND" }`
- `409` — conflit (ex: un seul programme actif) → `{ "error": "CONFLICT", "detail": "..." }`
- `500` — erreur serveur → `{ "error": "INTERNAL_ERROR" }`

---

## 4.1 Exercices

```
GET    /exercises
  Query: muscle=chest  equipment=barbell  movement=push_horizontal  custom=0|1  q=squat
  Response 200: { exercises: Exercise[] }

GET    /exercises/:id
  Response 200: Exercise
  Response 404: { error: "EXERCISE_NOT_FOUND" }

POST   /exercises
  Body: { name_fr, name_en, category, movement_pattern, primary_muscles[], secondary_muscles[],
          equipment_required[], instructions_fr[], instructions_en[], is_unilateral? }
  Response 201: Exercise
  Erreur 400 si name_fr vide ou movement_pattern invalide.

PUT    /exercises/:id
  Seuls les exercices is_custom=1 peuvent être modifiés.
  Body: champs partiels (même structure que POST)
  Response 200: Exercise
  Erreur 403: { error: "CANNOT_EDIT_BUILTIN_EXERCISE" }

DELETE /exercises/:id
  Seuls is_custom=1 supprimables. Erreur si référencé dans template_exercise actif.
  Response 204
  Erreur 409: { error: "EXERCISE_IN_USE", detail: "Utilisé dans N templates" }

GET    /exercises/:id/history
  Query: limit=20 (défaut 20, max 100)  program_id=N (optionnel)
  Response 200: {
    exercise_id, exercise_name,
    history: [{ session_id, session_date, sets: [{ weight_kg, reps, rpe, rir, is_completed }] }]
  }

GET    /exercises/:id/rm-history
  Query: days=90 (défaut 90)
  Response 200: {
    exercise_id,
    history: [{ date: "YYYY-MM-DD", estimated_1rm_kg: float, formula: string }]
  }
```

**Type `Exercise`** :
```json
{
  "id": "bench_press_barbell",
  "name_fr": "Développé couché barre",
  "name_en": "Barbell Bench Press",
  "category": "strength",
  "force": "push",
  "mechanic": "compound",
  "movement_pattern": "push_horizontal",
  "primary_muscles": ["chest"],
  "secondary_muscles": ["triceps","front_deltoid"],
  "equipment_required": ["barbell","bench"],
  "instructions_fr": ["Allongez-vous sur le banc…"],
  "instructions_en": ["Lie flat on the bench…"],
  "image_paths": ["bench_press_barbell/0.jpg","bench_press_barbell/1.jpg"],
  "is_custom": 0,
  "is_unilateral": 0
}
```

---

## 4.2 Équipement

```
GET    /equipment
  Response 200: { items: EquipmentItem[] }

POST   /equipment
  Body: { category, name, weight_kg?, count?, weight_min_kg?, weight_max_kg?,
          weight_step_kg?, resistance_min_kg?, resistance_max_kg?, notes? }
  Validation : si category='plate', count doit être pair (≥2).
  Response 201: EquipmentItem

PUT    /equipment/:id
  Body: champs partiels
  Response 200: EquipmentItem

DELETE /equipment/:id
  Response 204

GET    /equipment/achievable-loads
  Query: exercise_id=bench_press_barbell  (obligatoire)
  Response 200: {
    exercise_id,
    is_unilateral: bool,
    loads_kg: float[],          // liste triée de toutes les charges atteignables
    min_increment_kg: float,    // plus petit incrément possible
    max_load_kg: float
  }
  Erreur 400 si exercise_id manquant ou exercise introuvable.
```

**Type `EquipmentItem`** :
```json
{
  "id": 1,
  "category": "barbell",
  "name": "Barre olympique",
  "weight_kg": 20.0,
  "count": 1,
  "weight_min_kg": null,
  "weight_max_kg": null,
  "weight_step_kg": null,
  "resistance_min_kg": null,
  "resistance_max_kg": null,
  "notes": null
}
```

---

## 4.3 Programmes

```
GET    /programs
  Query: active=1 (optionnel)
  Response 200: { programs: Program[] }

GET    /programs/:id
  Response 200: ProgramFull   // inclut workout_templates + template_exercises

POST   /programs
  Body: { name, description?, goal, level, days_per_week, duration_weeks?,
          use_exercise_rotation?, rotation_frequency_weeks?, progression_model?,
          deload_auto_enabled?, deload_frequency_weeks?,
          deload_load_reduction_pct?, deload_volume_reduction_pct? }
  Response 201: Program

PUT    /programs/:id
  Body: champs partiels (mêmes champs que POST, sauf is_active)
  Response 200: Program

DELETE /programs/:id
  Ne peut pas supprimer un programme actif avec des séances in_progress.
  Response 204
  Erreur 409 si séance en cours.

POST   /programs/:id/activate
  Désactive le programme actif précédent, active celui-ci.
  Response 200: { message: "Programme activé", program_id: N }

POST   /programs/generate
  Body: { goal, level, days_per_week, duration_weeks?, priority_muscles[], equipment_ids[] }
  Appelle programGenerator.generateProgram(), persiste en DB.
  Response 201: ProgramFull

GET    /programs/:id/next-session
  Retourne la prochaine séance suggérée (template + exercices + charges cibles).
  Response 200: NextSession
  Erreur 404 si programme sans templates.
```

**Type `Program`** :
```json
{
  "id": 1,
  "name": "PPL Force",
  "goal": "strength",
  "level": "intermediate",
  "days_per_week": 3,
  "is_active": 1,
  "progression_model": "linear",
  "current_week": 4,
  "last_deload_date": null
}
```

**Type `NextSession`** :
```json
{
  "template_id": 2,
  "template_name": "Jour A – Push",
  "suggested_date": "2025-07-10",
  "exercises": [{
    "template_exercise_id": 5,
    "exercise_id": "bench_press_barbell",
    "exercise_name_fr": "Développé couché barre",
    "target_sets": 4,
    "target_weight_kg": 80.0,
    "target_reps_min": 5,
    "target_reps_max": 5,
    "rest_seconds": 180,
    "progression_explanation": "Dernière séance : 77.5 kg × 5 × 4 (succès). +2.5 kg.",
    "achievable_loads": [77.5, 80.0, 82.5]
  }]
}
```

---

## 4.4 Templates & Template-exercises

```
GET    /templates/:id
  Response 200: WorkoutTemplate  // inclut template_exercises

POST   /programs/:programId/templates
  Body: { name, day_of_week?, order_index? }
  Response 201: WorkoutTemplate

PUT    /templates/:id
  Body: { name?, day_of_week?, order_index? }
  Response 200: WorkoutTemplate

DELETE /templates/:id
  Response 204

POST   /templates/:id/exercises
  Body: { exercise_id, order_index?, target_sets?, target_reps_min?, target_reps_max?,
          target_reps?, rest_seconds?, progression_model?, progression_weight_increment_kg?,
          rir_target?, rpe_target?, rotation_group?, notes? }
  Response 201: TemplateExercise + progression_state créé avec current_weight_kg=0

PUT    /template-exercises/:id
  Body: champs partiels
  Response 200: TemplateExercise

DELETE /template-exercises/:id
  Response 204

PUT    /template-exercises/reorder
  Body: { items: [{ id: N, order_index: N }] }
  Response 200: { updated: N }
```

---

## 4.5 Séances

```
GET    /sessions
  Query: from=YYYY-MM-DD  to=YYYY-MM-DD  status=planned|completed|...  limit=50
  Response 200: { sessions: Session[] }

GET    /sessions/:id
  Response 200: SessionFull  // inclut session_exercises + set_logs + cibles

POST   /sessions
  Body: { name, scheduled_date, workout_template_id?, program_id?, is_deload? }
  Response 201: Session

POST   /sessions/from-template/:templateId
  Body: { scheduled_date, apply_rotation?: bool }
  Crée une session et ses session_exercises depuis le template.
  Si apply_rotation=true, applique la rotation d'exercices selon current_week.
  Response 201: SessionFull

POST   /sessions/:id/start
  Passe status → 'in_progress', set started_at.
  Response 200: Session

POST   /sessions/:id/complete
  Passe status → 'completed', calcule duration_seconds, total_volume_kg, rpe_avg.
  Lance equipmentAdvisor.runAllSignalChecks().
  Si tous les exercices réussis → lance progressionEngine pour màj progression_state.
  Lance auto-backup de la DB.
  Response 200: SessionFull

PUT    /sessions/:id
  Champs modifiables : name, scheduled_date (si status='planned'), notes.
  Response 200: Session

DELETE /sessions/:id
  Ne peut pas supprimer status='in_progress'.
  Response 204

GET    /sessions/:id/target/:templateExerciseId
  Retourne la charge et les reps cibles pour cet exercice dans cette séance.
  Response 200: {
    weight_kg: float,
    reps_min: int, reps_max: int,
    explanation: string,
    achievable_loads_kg: float[]
  }
```

---

## 4.6 Séries

```
GET    /session-exercises/:id/sets
  Response 200: { sets: SetLog[] }

POST   /session-exercises/:id/sets
  Body: { set_number, weight_kg, reps, rpe?, rir?, is_warmup?, notes? }
  Response 201: SetLog
  Met à jour personal_record si 1RM estimé > record existant.

PUT    /sets/:id
  Body: { weight_kg?, reps?, rpe?, rir?, is_completed?, rest_seconds_after?, notes? }
  Response 200: SetLog

DELETE /sets/:id
  Response 204

POST   /session-exercises/:sessionId/exercises
  Body: { exercise_id, order_index?, template_exercise_id? }
  Response 201: SessionExercise

DELETE /session-exercises/:id
  Response 204
```

---

## 4.7 Poids de corps

```
GET    /bodyweight
  Query: days=90 (défaut : valeur du setting bodyweight_display_days)
  Response 200: { entries: BodyWeight[] }

POST   /bodyweight
  Body: { date: "YYYY-MM-DD", weight_kg: float, notes? }
  Erreur 409 si date déjà existante.
  Response 201: BodyWeight

PUT    /bodyweight/:id
  Body: { weight_kg?, notes? }
  Response 200: BodyWeight

DELETE /bodyweight/:id
  Response 204
```

---

## 4.8 Statistiques

```
GET    /stats/overview
  Response 200: {
    total_sessions: int,
    total_volume_kg: float,
    current_week_streak: int,
    longest_week_streak: int,
    total_weeks_trained: int,
    active_program_name: string|null,
    last_session_date: string|null,
    personal_records_count: int
  }

GET    /stats/streaks
  Response 200: {
    current_week_streak: int,
    longest_week_streak: int,
    current_session_streak: int,   // sessions consécutives sans séance prévue manquée
    total_sessions: int,
    total_weeks: int
  }

GET    /stats/volume
  Query: weeks=12 (défaut 12)  group_by=muscle|week (défaut week)
  Response 200: {
    data: [{ period: "2025-W27", muscle?: "chest", volume_kg: float, sets: int }]
  }

GET    /stats/exercises/:id/progress
  Query: days=180 (défaut 180)
  Response 200: {
    exercise_id,
    data: [{ date, weight_kg, reps, estimated_1rm_kg }]
  }

GET    /stats/personal-records
  Query: exercise_id=... (optionnel — tous si absent)
  Response 200: {
    records: [{
      exercise_id, exercise_name_fr,
      reps, weight_kg, estimated_1rm_kg, achieved_date
    }]
  }
```

---

## 4.9 Paramètres

```
GET    /settings
  Response 200: Settings  // TOUS les settings SAUF ai_api_key
                          // + champ supplémentaire : ai_api_key_set: bool

PUT    /settings
  Body: { key: value, ... }  // paires clé-valeur à mettre à jour
  Validation : types et plages pour chaque clé connue.
  Erreur 400 si clé inconnue ou valeur hors plage.
  Response 200: Settings (même format que GET)
  Note: si network_host ou network_port changé → inclure "restart_required": true

POST   /settings/test-ai
  Envoie un message "Réponds juste OK" au provider configuré.
  Response 200: { success: true, latency_ms: int, model: string }
  Erreur 400: { success: false, error: "MESSAGE" }

GET    /settings/ai-models
  Appelle GET {base_url}/models avec la clé API.
  Response 200: { models: [{ id: string, name: string }] }
  Erreur 400: { error: "AI_PROVIDER_UNREACHABLE" }
```

---

## 4.10 Coach IA

```
POST   /ai/chat
  Content-Type: application/json
  Body: {
    message: string,
    history: [{ role: "user"|"assistant", content: string }]  // max 10 derniers échanges
  }
  Response: text/event-stream (SSE)
  Events:
    data: {"type":"token","content":"mot"}
    data: {"type":"action","action":{ ... action JSON validé ... }}
    data: {"type":"done","usage":{"prompt_tokens":N,"completion_tokens":N}}
    data: {"type":"error","message":"MESSAGE_CLAIR"}
  Erreur 503 si provider non configuré : { error: "AI_NOT_CONFIGURED" }

GET    /ai/advice
  Response 200: { advice: EquipmentAdvice[] }  // status='active' uniquement

POST   /ai/advice/:id/dismiss
  Response 200: { id, status: "dismissed" }

POST   /ai/advice/:id/purchased
  Response 200: { id, status: "purchased" }
  L'app affiche ensuite une proposition de màj de l'inventaire (côté client).

POST   /ai/apply-action
  Body: { action: { action: string, data: object } }
  Valide le JSON contre le schéma (voir Partie 7).
  Response 201: { applied: true, result: object }  // l'objet créé/modifié
  Erreur 400: { error: "INVALID_ACTION_SCHEMA", details: string[] }

POST   /ai/generate-equipment-advice
  Déclenche manuellement runAllSignalChecks() + génération LLM pour les nouveaux signaux.
  Response 200: { generated: int, skipped_cooldown: int }
```

---

## 4.11 Export / Import

```
GET    /export
  Response 200: application/json
  Content-Disposition: attachment; filename="WorkoutBuddy-export-YYYY-MM-DD.json"
  Corps: ExportPayload complet (voir format Partie 3.3)

POST   /import
  Content-Type: application/json
  Body: ExportPayload
  Valide la version et la structure.
  Exécute en transaction : DELETE all tables data → INSERT all.
  Response 200: { imported: { sessions: N, exercises: N, ... } }
  Erreur 400: { error: "INVALID_IMPORT_FORMAT", detail: string }

GET    /export/csv/:table
  table ∈ {'sessions','set_logs','body_weights','personal_records'}
  Response 200: text/csv
  Content-Disposition: attachment; filename="{table}-YYYY-MM-DD.csv"
```

---

# PARTIE 5 — Algorithmes en pseudo-code avec exemples chiffrés

## 5.1 Calcul des charges atteignables et incrément minimal

### Algorithme (Bounded Subset Sum DP)

```
FUNCTION calculateAchievableLoads(equipment_items, exercise):
  is_unilateral = exercise.is_unilateral

  // 1. Identifier les barres utilisables pour cet exercice
  eq_types = exercise.equipment_required  // ex: ["barbell","bench"]
  barbells = [item for item in equipment_items
              if item.category IN ('barbell','ez_bar')
              AND item.category IN eq_types]

  // 2. Identifier les plaques disponibles
  plates = [item for item in equipment_items if item.category == 'plate']
  // plates: chaque item { weight_kg, count } — count est le nombre total (toujours pair)
  // => paires_par_côté = floor(count / 2)
  plate_pairs = [(p.weight_kg, floor(p.count / 2)) for p in plates]
  // ex: plates=[{1kg,4},{2kg,4},{5kg,2}] → plate_pairs=[(1,2),(2,2),(5,1)]

  // 3. Calculer l'ensemble des charges par côté (subset-sum borné)
  per_side_achievable = {0}   // ensemble des sommes atteignables par côté
  FOR (weight, max_count) IN plate_pairs:
    new_set = {}
    FOR s IN per_side_achievable:
      FOR k IN range(0, max_count + 1):
        new_set.add(s + k * weight)
    per_side_achievable = per_side_achievable UNION new_set

  // 4. Construire les charges totales
  all_loads = sorted set
  FOR barbell IN barbells:
    bar = barbell.weight_kg
    IF is_unilateral:
      // Charge par bras = barre + charge un côté
      FOR s IN per_side_achievable:
        all_loads.add(bar + s)
    ELSE:
      // Charge totale = barre + 2 × (charge par côté)
      FOR s IN per_side_achievable:
        all_loads.add(bar + 2 * s)

  // 5. Si haltères fixes disponibles pour exercice unilatéral
  IF is_unilateral:
    FOR item IN equipment_items WHERE category == 'dumbbell_fixed':
      IF item.count >= 2:  // une paire
        all_loads.add(item.weight_kg)

  // 6. Si haltère réglable
  FOR item IN equipment_items WHERE category == 'dumbbell_adjustable':
    w = item.weight_min_kg
    WHILE w <= item.weight_max_kg:
      all_loads.add(w)
      w = w + item.weight_step_kg

  sorted_loads = sorted(all_loads)

  // 7. Incrément minimal
  min_increment = +∞
  FOR i IN range(1, len(sorted_loads)):
    diff = sorted_loads[i] - sorted_loads[i-1]
    IF diff > 0: min_increment = min(min_increment, diff)
  IF len(sorted_loads) <= 1: min_increment = 0

  RETURN {
    loads_kg: sorted_loads,
    min_increment_kg: min_increment,
    max_load_kg: max(sorted_loads) if sorted_loads else 0
  }
```

### Exemple chiffré (spec)

**Inventaire** :
- Barre A : 1 kg, Barre B : 1 kg
- Plaques : 1 kg × 4 (2 paires), 2 kg × 4 (2 paires), 5 kg × 2 (1 paire)
- Exercice : curl barre, bilatéral (is_unilateral = 0)

**plate_pairs** = [(1, 2), (2, 2), (5, 1)]

**DP par côté** :
```
Départ           : {0}
Après plaques 1kg: {0, 1, 2}
Après plaques 2kg: {0,1,2} ∪ {2,3,4} ∪ {4,5,6} = {0,1,2,3,4,5,6}
Après plaques 5kg: {0..6} ∪ {5,6,7,8,9,10,11}  = {0,1,2,3,4,5,6,7,8,9,10,11}
```

**Charges totales bilatérales avec Barre A (1 kg)** :
`1 + 2×{0..11}` = **{1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23} kg**

**Incrément minimal** : 3 − 1 = **2 kg**  
**Charge maximale** : **23 kg**

Pour usage **unilatéral** (1 kg par bras) :
`1 + {0..11}` = **{1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12} kg**  
Incrément minimal : **1 kg**

---

## 5.2 Formules de RM estimé et tableau RM

### Formules disponibles

```
FORMULAS = {
  "epley":    (w, r) => r == 1 ? w : w * (1 + r / 30),
  "brzycki":  (w, r) => r >= 37 ? w : w * 36 / (37 - r),
  "lander":   (w, r) => 100 * w / (101.3 - 2.67123 * r),
  "oconner":  (w, r) => w * (1 + 0.025 * r),
  "lombardi": (w, r) => w * Math.pow(r, 0.10)
}

FUNCTION estimate1RM(weight_kg, reps, formula="epley"):
  IF reps <= 0 OR weight_kg <= 0: RETURN 0
  IF reps == 1: RETURN weight_kg
  fn = FORMULAS[formula]
  RETURN ROUND(fn(weight_kg, reps), 2)

FUNCTION rmTable(estimated_1rm, formula="epley"):
  // Retourne { reps: N, weight_kg: float } pour N de 1 à 15
  result = []
  FOR n IN range(1, 16):
    IF n == 1:
      weight = estimated_1rm
    ELSE:
      // Inverser la formule Epley : w = 1rm / (1 + n/30)
      // Pour les autres formules on utilise aussi l'inversion Epley (approximation conservative)
      weight = estimated_1rm / (1 + n / 30)
    result.append({ reps: n, weight_kg: ROUND(weight, 1) })
  RETURN result
```

### Exemple chiffré

**Input** : 100 kg × 3 répétitions, formule Epley

```
1RM = 100 × (1 + 3/30) = 100 × 1.1 = 110 kg

Tableau RM :
 1 rep  → 110.0 kg   (110 / 1.033)
 2 reps →  103.1 kg
 3 reps →  100.0 kg  (vérifié)
 5 reps →   94.3 kg  (110 / 1.167)
 8 reps →   86.8 kg  (110 / 1.267)
10 reps →   82.5 kg  (110 / 1.333)
12 reps →   78.6 kg  (110 / 1.400)
15 reps →   73.3 kg  (110 / 1.500)
```

---

## 5.3 Génération de programme

```
FUNCTION generateProgram(params):
  // params: { goal, level, days_per_week, duration_weeks, equipment_items, priority_muscles }

  // Étape 1 : Choisir le split
  split = selectSplit(params.days_per_week, params.goal, params.level)
  /*
    days=2          → 'full_body_2'
    days=3, beg     → 'full_body_3'
    days=3, int/adv → 'push_pull_legs'
    days=4          → 'upper_lower'
    days=5          → 'upper_lower_upper_lower_full'
    days=6          → 'push_pull_legs_x2'
  */

  // Étape 2 : Définir les templates selon le split
  template_defs = SPLIT_TEMPLATES[split]
  // ex 'push_pull_legs':
  // [ {name:"Push", muscles:["chest","front_deltoid","triceps"]},
  //   {name:"Pull", muscles:["back","rear_deltoid","biceps"]},
  //   {name:"Legs", muscles:["quads","hamstrings","glutes","calves"]} ]

  templates = []
  FOR tdef IN template_defs:
    target_muscles = tdef.muscles
    // Booster les muscles prioritaires (ajouter un exercice isolation si possible)
    FOR muscle IN params.priority_muscles:
      IF muscle IN target_muscles AND NOT already_boosted[muscle]:
        target_muscles = [muscle] + target_muscles  // mettre en premier
        already_boosted[muscle] = true

    exercises = []
    FOR muscle IN target_muscles:
      candidates = exercise_db.filter(primary_muscles CONTAINS muscle)
      feasible = [e for e in candidates if isEquipmentAvailable(e.equipment_required, params.equipment_items)]
      IF len(feasible) == 0: CONTINUE  // aucun exercice possible → skip

      // Prioriser les composés pour force, mix pour hypertrophie
      IF params.goal == 'strength': preferred_mechanic = 'compound'
      ELSE: preferred_mechanic = 'compound'  // d'abord composé, isolation après
      selected = sortByMechanic(feasible, preferred_mechanic)[0]

      sets, rep_min, rep_max = getSetsReps(params.goal, params.level, selected.mechanic)
      rest = getRest(params.goal, selected.mechanic)

      exercises.append({ exercise_id: selected.id, target_sets: sets,
                         target_reps_min: rep_min, target_reps_max: rep_max, rest_seconds: rest })

    templates.append({ name: tdef.name, exercises: exercises })

  RETURN {
    name:           "{level} {goal} {days_per_week}j — généré",
    goal:           params.goal,
    level:          params.level,
    days_per_week:  params.days_per_week,
    duration_weeks: params.duration_weeks,
    progression_model: defaultModelForGoal(params.goal),
    templates:      templates
  }

HELPER getSetsReps(goal, level, mechanic):
  TABLE = {
    ('strength',      'compound'):  (5, 3, 5),
    ('strength',      'isolation'): (3, 6, 8),
    ('hypertrophy',   'compound'):  (4, 6, 10),
    ('hypertrophy',   'isolation'): (3, 10, 15),
    ('endurance',     _):           (3, 15, 20),
    ('weight_loss',   _):           (3, 12, 15),
    ('general_fitness','compound'): (3, 8, 12),
    ('general_fitness','isolation'):(3, 10, 15),
  }
  (sets, rmin, rmax) = TABLE.get((goal, mechanic)) OR TABLE.get((goal, _))
  IF level == 'beginner': sets = max(2, sets - 1)  // -1 série pour débutants
  RETURN (sets, rmin, rmax)

HELPER defaultModelForGoal(goal):
  {'strength': 'linear', 'hypertrophy': 'double_progression',
   'endurance': 'double_progression', 'weight_loss': 'double_progression',
   'general_fitness': 'double_progression'}[goal]
```

---

## 5.4 Moteur de progression

```
FUNCTION computeNextState(state, lastSessionSets, templateExercise, achievable_loads, settings):
  // state: ProgressionState
  // lastSessionSets: SetLog[] (série de travail uniquement, is_warmup=0, is_completed=1)
  // Résout le modèle effectif
  effective_model = templateExercise.progression_model == 'inherit'
                    ? program.progression_model
                    : templateExercise.progression_model

  SWITCH effective_model:
    CASE 'linear':         RETURN linearProgression(...)
    CASE 'double_progression': RETURN doubleProgression(...)
    CASE 'rpe_based':      RETURN rpeProgression(...)

// ── Progression linéaire ──
FUNCTION linearProgression(state, sets, te, achievable, settings):
  target_reps = te.target_reps OR te.target_reps_min
  all_ok = len(sets) == te.target_sets AND all(s.reps >= target_reps for s in sets)

  IF all_ok:
    increment = te.progression_weight_increment_kg OR min_increment(achievable)
    new_w = roundDown(state.current_weight_kg + increment, achievable)
    RETURN { current_weight_kg: new_w, consecutive_failures: 0,
             explanation: "Objectif atteint. +{increment} kg → {new_w} kg" }
  ELSE:
    fails = state.consecutive_failures + 1
    IF fails >= settings.progression_failure_threshold:
      new_w = roundDown(state.current_weight_kg * (1 - settings.progression_weight_reduction_pct/100), achievable)
      RETURN { current_weight_kg: new_w, consecutive_failures: 0,
               explanation: "{fails} échecs. -${settings.progression_weight_reduction_pct}% → {new_w} kg" }
    ELSE:
      RETURN { current_weight_kg: state.current_weight_kg, consecutive_failures: fails,
               explanation: "Objectif non atteint ({fails}/{threshold}). Maintien {state.current_weight_kg} kg" }

// ── Double progression ──
FUNCTION doubleProgression(state, sets, te, achievable, settings):
  min_r = te.target_reps_min ; max_r = te.target_reps_max
  cur_target = state.current_target_reps OR min_r
  min_reps_done = min(s.reps for s in sets) IF sets ELSE 0
  all_completed = len(sets) == te.target_sets

  IF all_completed AND min_reps_done >= max_r:
    increment = te.progression_weight_increment_kg OR min_increment(achievable)
    new_w = roundDown(state.current_weight_kg + increment, achievable)
    RETURN { current_weight_kg: new_w, current_target_reps: min_r, consecutive_failures: 0,
             explanation: "Toutes séries ≥{max_r} reps. +{increment} kg → {new_w} kg. Retour à {min_r} reps." }

  ELIF all_completed AND min_reps_done >= min_r:
    new_reps = min(cur_target + 1, max_r)
    RETURN { current_weight_kg: state.current_weight_kg, current_target_reps: new_reps,
             consecutive_failures: 0,
             explanation: "Objectif atteint. Prochaine cible : {new_reps} reps à {state.current_weight_kg} kg." }

  ELSE:
    fails = state.consecutive_failures + 1
    IF fails >= settings.progression_failure_threshold:
      new_w = roundDown(state.current_weight_kg * (1 - settings.progression_weight_reduction_pct/100), achievable)
      RETURN { current_weight_kg: new_w, current_target_reps: min_r, consecutive_failures: 0,
               explanation: "{fails} échecs. Réduction à {new_w} kg, retour à {min_r} reps." }
    RETURN { current_weight_kg: state.current_weight_kg, current_target_reps: cur_target,
             consecutive_failures: fails,
             explanation: "Objectif non atteint ({fails}/{threshold}). Maintien." }

// ── RPE ──
FUNCTION rpeProgression(state, sets, te, achievable, settings):
  last = sets[-1] IF sets ELSE null
  IF NOT last OR last.rpe IS NULL: RETURN { ...state, explanation: "RPE non renseigné. Pas de changement." }
  target_rpe = te.rpe_target OR 8.0
  diff = last.rpe - target_rpe
  IF diff <= -1.0:
    pct = 0.025 * abs(diff)
    new_w = roundDown(state.current_weight_kg * (1 + pct), achievable)
    explanation = "RPE {last.rpe} < cible {target_rpe}. +{pct*100:.1f}% → {new_w} kg."
  ELIF diff >= 1.0:
    pct = 0.025 * abs(diff)
    new_w = roundDown(state.current_weight_kg * (1 - pct), achievable)
    explanation = "RPE {last.rpe} > cible {target_rpe}. -{pct*100:.1f}% → {new_w} kg."
  ELSE:
    new_w = state.current_weight_kg
    explanation = "RPE {last.rpe} ≈ cible {target_rpe}. Maintien {new_w} kg."
  RETURN { current_weight_kg: new_w, consecutive_failures: 0, explanation }

HELPER roundDown(target_weight, achievable_loads):
  // Plus grande charge ≤ target_weight
  valid = [l for l in achievable_loads if l <= target_weight]
  RETURN max(valid) IF valid ELSE min(achievable_loads)
```

### Exemple chiffré — Double progression

- Programme hypertrophie, cible 4×8–12 reps, poids actuel 80 kg
- Séance 1 : 4 séries complétées, min reps = 10 (≥ 8 mais < 12) → `new_reps = 11`, poids = 80 kg
- Séance 2 : 4 séries, min reps = 12 (≥ 12) → +2.5 kg → **82.5 kg**, retour à 8 reps
- Séance 3 : 3 séries complétées sur 4 prévues (échec 1/2) → `consecutive_failures = 1`
- Séance 4 : même résultat → `consecutive_failures = 2` ≥ threshold 2 → -10% → **74 kg** (arrondi à 75 kg si c'est la charge atteignable la plus proche)

---

## 5.5 Détection de plateau

```
FUNCTION detectPlateau(exercise_id, program_id, n, db):
  // n = settings.plateau_detection_sessions (défaut 4)
  rows = db.query(`
    SELECT s.id as session_id, s.completed_at,
           MAX(sl.weight_kg * (1 + sl.reps / 30.0)) as session_1rm
    FROM set_log sl
    JOIN session_exercise se ON sl.session_exercise_id = se.id
    JOIN session s ON se.session_id = s.id
    WHERE se.exercise_id = ?
      AND s.program_id = ?
      AND s.status = 'completed'
      AND sl.is_warmup = 0
      AND sl.is_completed = 1
    GROUP BY s.id
    ORDER BY s.completed_at DESC
    LIMIT ?
  `, [exercise_id, program_id, n])

  IF len(rows) < n:
    RETURN { is_plateau: false, reason: "Pas assez de données ({len(rows)}/{n})" }

  first_1rm = rows[n-1].session_1rm   // le plus ancien des N
  current_1rm = rows[0].session_1rm   // le plus récent

  IF current_1rm <= first_1rm * 1.01:  // tolérance 1% pour arrondis
    RETURN {
      is_plateau: true,
      sessions_checked: n,
      first_1rm: first_1rm,
      current_1rm: current_1rm,
      delta_pct: ((current_1rm - first_1rm) / first_1rm) * 100
    }
  RETURN { is_plateau: false }
```

---

## 5.6 Deload (manuel et automatique)

```
FUNCTION shouldDeload(program, settings, db):
  IF program.is_in_deload: RETURN { should: false }

  // Deload automatique basé sur le nombre de semaines
  IF program.deload_auto_enabled:
    weeks_since = weeksBetween(program.last_deload_date OR program.created_at, today())
    IF weeks_since >= program.deload_frequency_weeks:
      RETURN { should: true, reason: "scheduled", weeks_since }

  // Deload sur plateau persistent (6 séances sans progrès)
  plateau_threshold = settings.equipment_advice_plateau_sessions  // défaut 6
  active_exercises = getActiveTemplateExercises(program.id)
  plateau_count = 0
  FOR te IN active_exercises:
    result = detectPlateau(te.exercise_id, program.id, plateau_threshold, db)
    IF result.is_plateau: plateau_count++
  IF plateau_count >= ceil(len(active_exercises) * 0.5):  // ≥ 50% des exercices en plateau
    RETURN { should: true, reason: "plateau", plateau_count }

  RETURN { should: false }

FUNCTION computeDeloadTargets(template_exercise, progression_state, program):
  load_factor  = 1 - program.deload_load_reduction_pct / 100   // ex: 0.80
  vol_factor   = 1 - program.deload_volume_reduction_pct / 100  // ex: 0.60
  target_w = roundDown(progression_state.current_weight_kg * load_factor, achievable)
  target_s = max(settings.deload_min_sets, round(template_exercise.target_sets * vol_factor))
  RETURN { weight_kg: target_w, sets: target_s, reps: template_exercise.target_reps_min }
  // Exemple: 100kg×4×8-12 → 80kg×2×8 (load-20%, vol-40%, min_reps)
```

---

## 5.7 Rotation d'exercices

```
FUNCTION getExerciseForWeek(template_exercise, week_number, equipment_items, db):
  IF NOT template_exercise.rotation_group:
    RETURN template_exercise.exercise_id

  candidates = findRotationCandidates(template_exercise, equipment_items, db)
  IF len(candidates) <= 1:
    RETURN template_exercise.exercise_id  // pas assez de candidats

  idx = week_number % len(candidates)
  RETURN candidates[idx].id

FUNCTION findRotationCandidates(te, equipment_items, db):
  base_exercise = db.getExercise(te.exercise_id)
  candidates = db.query(`
    SELECT * FROM exercise
    WHERE movement_pattern = ?
      AND id != ?
      AND is_custom = 0
  `, [base_exercise.movement_pattern, te.exercise_id])

  // Filtrer par équipement disponible
  feasible = [e for e in candidates
              if isEquipmentAvailable(e.equipment_required, equipment_items)]

  // Filtrer : les muscles primaires doivent se chevaucher
  feasible = [e for e in feasible
              if hasOverlap(e.primary_muscles, base_exercise.primary_muscles)]

  // Inclure l'exercice de base en position 0
  RETURN [base_exercise] + feasible
```

---

## 5.8 Streaks

```
FUNCTION calculateStreaks(db):
  // 1. Récupérer toutes les dates de séances complétées
  rows = db.query(`
    SELECT DISTINCT date(scheduled_date) as d
    FROM session WHERE status = 'completed'
    ORDER BY d DESC
  `)
  dates = [row.d for row in rows]  // ex: ["2025-07-08","2025-07-05","2025-07-01",...]

  // 2. Semaines avec au moins une séance
  weeks_with_session = set()
  FOR d IN dates:
    weeks_with_session.add(isoWeek(d))  // ex: "2025-W27"

  // 3. Streak courant (semaines consécutives jusqu'à cette semaine)
  current_week = isoWeek(today())
  streak_weeks = 0
  w = current_week
  WHILE w IN weeks_with_session:
    streak_weeks++
    w = previousIsoWeek(w)

  // 4. Streak le plus long
  sorted_weeks = sorted(weeks_with_session)
  longest = 1 ; current = 1
  FOR i IN range(1, len(sorted_weeks)):
    IF sorted_weeks[i] == nextIsoWeek(sorted_weeks[i-1]):
      current++
      longest = max(longest, current)
    ELSE:
      current = 1

  RETURN {
    current_week_streak: streak_weeks,
    longest_week_streak: longest,
    total_sessions: len(dates),
    total_weeks: len(weeks_with_session)
  }
```

---

## 5.9 Détection des signaux « matériel limitant »

```
FUNCTION runAllSignalChecks(db, settings) → EquipmentAdvice[]:
  equipment_items = db.getAllEquipment()
  active_program = db.getActiveProgram()
  IF NOT active_program: RETURN []

  new_advice = []
  already_active = db.getActiveAdvice()  // pour éviter les doublons

  // Signal 1 : Charge maximale atteinte
  FOR te IN getActiveTemplateExercises(active_program.id):
    loads = calculateAchievableLoads(equipment_items, te.exercise_id)
    recent = db.getRecentSetsForExercise(te.exercise_id, active_program.id,
                                          n=settings.equipment_advice_max_load_sessions)
    IF len(recent) < settings.equipment_advice_max_load_sessions: CONTINUE
    // Vérifier si toutes les séances récentes ont weight_kg ≥ max_load * 0.99
    // ET reps ≥ target_reps_max (ou au-delà)
    all_at_max = all(s.weight_kg >= loads.max_load_kg * 0.99 for s in recent)
    all_exceeded_reps = all(s.reps >= te.target_reps_max for s in recent)
    IF all_at_max AND all_exceeded_reps:
      signal = { type:'max_load_reached', exercise_id:te.exercise_id,
                 max_load_kg: loads.max_load_kg,
                 sessions_checked: settings.equipment_advice_max_load_sessions }
      IF NOT isOnCooldown(signal, already_active, settings.equipment_advice_cooldown_days):
        new_advice.append(signal)

  // Signal 2 : Incrément minimal trop grand
  FOR te IN getActiveTemplateExercises(active_program.id):
    state = db.getProgressionState(te.id)
    IF state.current_weight_kg == 0: CONTINUE
    loads = calculateAchievableLoads(equipment_items, te.exercise_id)
    pct = loads.min_increment_kg / state.current_weight_kg * 100
    IF pct > settings.equipment_advice_min_increment_pct:
      plateau = detectPlateau(te.exercise_id, active_program.id, settings.plateau_detection_sessions, db)
      IF plateau.is_plateau:
        signal = { type:'min_increment_too_large', exercise_id:te.exercise_id,
                   min_increment_kg: loads.min_increment_kg,
                   current_weight_kg: state.current_weight_kg, pct: pct }
        IF NOT isOnCooldown(signal, already_active, settings.equipment_advice_cooldown_days):
          new_advice.append(signal)

  // Signal 3 : Aucun exercice disponible pour un groupe musculaire
  ALL_MUSCLES = ['chest','back','quads','hamstrings','glutes','shoulders',
                 'biceps','triceps','calves','core','forearms']
  FOR muscle IN ALL_MUSCLES:
    candidates = db.getExercisesByMuscle(muscle)
    feasible = [e for e in candidates if isEquipmentAvailable(e.equipment_required, equipment_items)]
    IF len(feasible) == 0:
      signal = { type:'no_exercise_available', muscle_group: muscle }
      IF NOT isOnCooldown(signal, already_active, settings.equipment_advice_cooldown_days):
        new_advice.append(signal)

  // Signal 4 : Rotation impossible
  IF active_program.use_exercise_rotation:
    FOR te IN getActiveTemplateExercises(active_program.id):
      IF NOT te.rotation_group: CONTINUE
      candidates = findRotationCandidates(te, equipment_items, db)
      IF len(candidates) <= 1:
        signal = { type:'no_rotation_possible', exercise_id: te.exercise_id }
        IF NOT isOnCooldown(signal, already_active, settings.equipment_advice_cooldown_days):
          new_advice.append(signal)

  // Signal 5 : Plateau persistant (seuil plus élevé que le deload)
  FOR te IN getActiveTemplateExercises(active_program.id):
    result = detectPlateau(te.exercise_id, active_program.id,
                            settings.equipment_advice_plateau_sessions, db)
    IF result.is_plateau:
      loads = calculateAchievableLoads(equipment_items, te.exercise_id)
      state = db.getProgressionState(te.id)
      pct = loads.min_increment_kg / max(state.current_weight_kg, 0.01) * 100
      IF pct > settings.equipment_advice_min_increment_pct:
        signal = { type:'persistent_plateau', exercise_id: te.exercise_id,
                   sessions_checked: settings.equipment_advice_plateau_sessions,
                   min_increment_kg: loads.min_increment_kg }
        IF NOT isOnCooldown(signal, already_active, settings.equipment_advice_cooldown_days):
          new_advice.append(signal)

  RETURN new_advice

HELPER isOnCooldown(signal, active_advice, cooldown_days):
  FOR a IN active_advice:
    IF a.signal_type == signal.type AND a.exercise_id == signal.exercise_id:
      days_since = daysBetween(a.last_generated_at, today())
      IF days_since < cooldown_days: RETURN true
  RETURN false
```

---

# PARTIE 6 — Spécification des écrans

## 6.1 Routeur hash-based

```javascript
// router.js — toutes les routes
const ROUTES = {
  '#/'                        : 'DashboardView',
  '#/exercises'               : 'ExerciseListView',
  '#/exercises/:id'           : 'ExerciseDetailView',
  '#/equipment'               : 'EquipmentView',
  '#/programs'                : 'ProgramListView',
  '#/programs/new'            : 'ProgramCreateView',
  '#/programs/:id'            : 'ProgramDetailView',
  '#/programs/:id/edit'       : 'ProgramEditView',
  '#/session'                 : 'SessionActiveView',
  '#/session/history'         : 'SessionHistoryView',
  '#/session/:id'             : 'SessionDetailView',
  '#/calendar'                : 'CalendarView',
  '#/stats'                   : 'StatsDashboardView',
  '#/stats/exercise/:id'      : 'ExerciseProgressView',
  '#/stats/bodyweight'        : 'BodyWeightView',
  '#/coach'                   : 'CoachView',
  '#/settings'                : 'SettingsView',
}
// Route inconnue → DashboardView (pas de 404 sur SPA)
```

Express sert `index.html` pour toutes les routes non-API. Configuration :
```javascript
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api/') && !req.path.startsWith('/exercises/images/')) {
    res.sendFile(path.join(__dirname, 'public', 'index.html'))
  }
})
```

---

## 6.2 Écran : Dashboard (`#/`)

**Composant** : `StatsDashboardView` en aperçu  
**Données chargées au mount** : `GET /stats/overview`, `GET /ai/advice` (status=active)

**Layout (mobile-first)** :
```
┌────────────────────────────────────┐
│ 🏋️ WorkoutBuddy          [⚙️]           │  ← PageHeader
├────────────────────────────────────┤
│ Programme actif :                  │
│ [PPL Force – Semaine 4]   [>]      │  ← Card programme
│ Prochaine séance : Lundi           │
├────────────────────────────────────┤
│ Streak : 🔥 3 semaines             │  ← StreakCard
│ Total : 47 séances / 18 semaines   │
├────────────────────────────────────┤
│ ⚠️ CONSEIL MATÉRIEL               │  ← AdviceCard (si advice actif)
│ Votre barre plafonne à 23 kg…     │
│ [Masquer] [J'ai acheté]            │
├────────────────────────────────────┤
│ [▶ Démarrer une séance]            │  ← CTA primaire
├────────────────────────────────────┤
│ 🏠  🏋️  📊  🤖  ⚙️               │  ← BottomNav
└────────────────────────────────────┘
```

**États** :
- Chargement : `LoadingSpinner` centré
- Aucun programme : `EmptyState` → "Créer mon premier programme" → `#/programs/new`
- Erreur réseau : `ErrorBanner` avec bouton "Réessayer"
- Conseil actif : `AdviceCard` affiché en amber. Si dismiss → `POST /ai/advice/:id/dismiss` + disparaît. Si acheté → `POST /ai/advice/:id/purchased` → modale "Mettre à jour l'inventaire ?"

---

## 6.3 Écran : Séance active (`#/session`)

**Composant** : `SessionActiveView`  
**Montage** : Charge la session `status='in_progress'` via `GET /sessions?status=in_progress`. Si aucune, redirige vers `#/` ou vers un sélecteur de programme.

**Layout** :
```
┌─────────────────────────────────────┐
│ ← Push – Jour A       [00:42:17]    │  ← PageHeader + SessionTimer
│                       [Terminer]    │
├─────────────────────────────────────┤
│ 1. Développé couché barre     [?]   │  ← ExerciseBlock, [?] = aide
│ ┌────┬────────────┬──────┬──────┐  │
│ │ S1 │  80.0 kg   │  5r  │  ✓  │  │  ← SetRow validée
│ │ S2 │  80.0 kg   │  5r  │  ✓  │  │
│ │ S3 │ [80.0 kg]  │ [5r] │  ○  │  │  ← SetRow active (champs éditables)
│ │ +  │            │      │     │  │  ← Ajouter série
│ └────┴────────────┴──────┴──────┘  │
│ Cible : 80 kg × 5 × 4              │
│ RM estimé (Epley) : 89 kg          │
├─────────────────────────────────────┤
│ ⏱ Repos : 02:15 / 03:00            │  ← RestTimer (si actif, sinon caché)
│ [Démarrer repos] [Passer]          │
├─────────────────────────────────────┤
│ 2. Développé militaire  [collapsed]│
│ 3. Dips                 [collapsed]│
└─────────────────────────────────────┘
```

**Comportement des timers** :
- `SessionTimer` et `RestTimer` utilisent le même `timer-worker.js` (Web Worker)
- Le Worker tourne même si l'onglet est en arrière-plan
- `RestTimer` : au démarrage, `worker.postMessage({type:'START_REST', payload:{duration_seconds:90}})`
- À la réception de `{type:'REST_COMPLETE'}` sur le main thread :
  1. `new Audio('/sounds/timer-end.mp3').play()` (fonctionne en arrière-plan si déjà démarré)
  2. `navigator.vibrate([200, 100, 200])` si setting activé et API disponible
  3. `setWakeLockActive(true)` si l'écran s'était éteint
- **Wake Lock** : acquis à `POST /sessions/:id/start`, libéré à `POST /sessions/:id/complete` ou si l'utilisateur quitte l'écran session

**Validation d'une série** :
1. Utilisateur saisit poids + reps → tape ✓
2. `POST /session-exercises/:id/sets` avec `is_completed: 1`
3. Si RPE/RIR activés → champ supplémentaire affiché avant validation
4. Si c'est un PR → Toast "🏆 Nouveau record ! {weight} × {reps} — RM estimé : {rm} kg"
5. Timer de repos démarre automatiquement

**Modal ExerciseHelp** (bouton `[?]`) :
```
┌─────────────────────────────────────┐
│ Développé couché barre         [✕] │
├─────────────────────────────────────┤
│ [Image 0]  [Image 1]               │  ← swipeable images
│                                     │
│ INSTRUCTIONS :                      │
│ 1. Allongez-vous sur le banc…       │
│ 2. Saisissez la barre…              │
│                                     │
│ TABLEAU RM (Epley, base 80 kg×5) : │
│  1 rep → 90 kg  5 reps → 80 kg     │
│  3 reps → 85 kg 8 reps → 73 kg     │
│ 10 reps → 69 kg 12 reps → 65 kg    │
│                                     │
│ HISTORIQUE (5 dernières séances) : │
│ 07/07 : 77.5 kg × 5 × 4            │
│ 03/07 : 75 kg × 5 × 4              │
└─────────────────────────────────────┘
```

---

## 6.4 Écran : Calendrier (`#/calendar`)

**Données** : `GET /sessions?from=YYYY-MM-01&to=YYYY-MM-31`

**Layout** : Grille 7 colonnes (Lun–Dim). Chaque cellule contient un point coloré :
- 🟢 vert = complétée, 🟡 jaune = planifiée, ⚫ vide

**Interactions** :
- Tap sur une date complétée → `SessionDetailView`
- Tap sur une date planifiée → popup : "Démarrer" | "Replanifier" | "Marquer sautée"
- "Replanifier" → date picker → `PUT /sessions/:id` avec nouvelle `scheduled_date`
- Swipe gauche/droite → mois précédent/suivant
- Bouton "+" sur une date vide → `POST /sessions` avec cette date

---

## 6.5 Écran : Paramètres (`#/settings`)

Sections accordéon (repliables) :

1. **Général** : Unités (kg/lb), Langue (FR/EN), Thème (Sombre/Clair), Formule RM
2. **Entraînement** : Repos par défaut, Incrément linéaire, Incrément haltère, Séries warmup, Afficher RPE, Afficher RIR
3. **Progression** : Seuil d'échec (1–5), Réduction sur échec (5–30%), Sessions plateau (3–8)
4. **Deload** : Deload auto activé, Fréquence (semaines), Réduction charge (%), Réduction volume (%), Séries minimum
5. **Signaux matériel** : Cooldown (jours), Séances à charge max (1–5), Seuil incrément (%), Séances plateau persistant
6. **Coach IA** : Base URL, Clé API (champ password), Modèle, [Lister modèles], [Tester connexion]
7. **Réseau** : Hôte (127.0.0.1 / 0.0.0.0), Port (3000). Mention : "Nécessite un redémarrage". Affichage de l'IP locale si 0.0.0.0.
8. **Données** : [Exporter JSON], [Exporter CSV Séances], [Importer JSON], [Sauvegarder maintenant], [Réinitialiser]

La **clé API** n'est jamais affichée (champ `type="password"`) et le GET `/settings` ne la renvoie jamais. Seule l'information `ai_api_key_set: true/false` est transmise au frontend.

---

# PARTIE 7 — Coach IA

## 7.1 Normalisation de l'URL de base

```javascript
// src/services/aiProvider.js
function normalizeBaseUrl(url) {
  url = url.trim().replace(/\/+$/, '')     // supprime slashes finaux
  if (!url.endsWith('/v1')) {
    url = url + '/v1'
  }
  return url
}
// Tests :
// "https://api.openai.com"      → "https://api.openai.com/v1"
// "https://api.openai.com/"     → "https://api.openai.com/v1"
// "https://api.openai.com/v1"   → "https://api.openai.com/v1"
// "https://api.openai.com/v1/"  → "https://api.openai.com/v1"
// "http://localhost:11434"      → "http://localhost:11434/v1"  (Ollama)
```

## 7.2 Prompt système

Assemblé côté serveur à chaque requête `/ai/chat` depuis les données réelles :

```
Tu es WorkoutBuddy, un assistant coach fitness expert. Tu travailles exclusivement
avec les données d'entraînement réelles de l'utilisateur.

## Contexte utilisateur (ne pas inventer de données hors de ce contexte)

**Équipement disponible** :
{equipment_summary}
// ex: "1 barre olympique 20kg, plaques: 2×1.25kg 2×2.5kg 2×5kg 2×10kg 2×20kg,
//      haltères fixes 10kg 12.5kg 15kg, banc réglable, rack squat"

**Programme actif** : {program_name} ({goal}, {level}, {days_per_week}j/sem, semaine {current_week})

**Dernières séances** (3 dernières, du plus récent au plus ancien) :
{last_sessions_summary}
// ex: "08/07 Push 45min: DC 80kg×5×4 (PR), DM 55kg×8×3, Dips +10kg×10×3"

**État progression** :
{progression_summary}
// ex: "DC: 80kg (double prog, 5 consec succès), Squat: plateau 4 séances"

**Conseils matériel actifs** : {active_advice_count} conseil(s) en attente

## Tes capacités
1. Conseils personnalisés basés sur l'historique réel.
2. Créer ou modifier des programmes/séances via des **actions structurées JSON**.
3. Répondre aux questions sur la technique, la science, la nutrition de base.

## Règles IMPÉRATIVES
- Réponds en français sauf si l'utilisateur écrit en anglais.
- Pour toute création ou modification → inclure le bloc ```action...``` (voir format).
- N'invente JAMAIS de données hors du contexte fourni.
- Sois concis (2–4 phrases pour conseils simples, liste pour instructions).
- Pas de marques commerciales, pas de liens d'affiliation (sauf demande explicite).
- Si contexte insuffisant pour répondre → demande UNE précision.

## Format d'action structurée
Pour CRÉER ou MODIFIER, inclure EXACTEMENT :
\`\`\`action
{ "action": "...", "explanation": "...", "data": { ... } }
\`\`\`
```

## 7.3 Schéma JSON des actions

```javascript
// Schéma de validation côté serveur (src/services/aiProvider.js - validateAction)

// ── Action : create_program ──────────────────────────────────
{
  "action": "create_program",
  "explanation": "string (obligatoire, max 500 chars)",
  "data": {
    "name": "string (obligatoire)",
    "goal": "strength|hypertrophy|endurance|weight_loss|general_fitness (obligatoire)",
    "level": "beginner|intermediate|advanced (obligatoire)",
    "days_per_week": "integer 2–6 (obligatoire)",
    "duration_weeks": "integer|null",
    "progression_model": "linear|double_progression|rpe_based",
    "use_exercise_rotation": "boolean",
    "templates": [{
      "name": "string (obligatoire)",
      "day_of_week": "integer 0–6|null",
      "exercises": [{
        "exercise_id": "string — doit exister en DB (obligatoire)",
        "target_sets": "integer 1–10",
        "target_reps_min": "integer 1–30",
        "target_reps_max": "integer 1–30",
        "rest_seconds": "integer 30–600"
      }]
    }]
  }
}

// ── Action : update_program ──────────────────────────────────
{
  "action": "update_program",
  "explanation": "string (obligatoire)",
  "data": {
    "program_id": "integer (obligatoire, doit exister en DB)",
    "changes": [{
      "type": "update_program_meta|add_template_exercise|update_template_exercise|remove_template_exercise",
      "template_exercise_id": "integer (pour update/remove)",
      "workout_template_id": "integer (pour add)",
      "fields": { /* champs partiels selon type */ }
    }]
  }
}

// ── Action : create_session ──────────────────────────────────
{
  "action": "create_session",
  "explanation": "string (obligatoire)",
  "data": {
    "name": "string (obligatoire)",
    "scheduled_date": "YYYY-MM-DD (obligatoire)",
    "workout_template_id": "integer|null",
    "exercises": [{
      "exercise_id": "string",
      "target_sets": "integer",
      "target_reps_min": "integer",
      "target_reps_max": "integer"
    }]
  }
}
```

**Validation côté serveur** (dans `src/routes/ai.js → POST /apply-action`) :
1. Vérifier que `action` ∈ valeurs autorisées
2. Vérifier que `explanation` est présente et non vide
3. Vérifier chaque `exercise_id` existe dans la table `exercise`
4. Vérifier chaque `program_id` / `template_exercise_id` existe et appartient bien aux données (pas d'injection d'ID arbitraire)
5. Vérifier les plages de valeurs (sets 1–10, reps 1–30, etc.)
6. Si KO → `400 { "error": "INVALID_ACTION_SCHEMA", "details": ["exercise_id 'xyz' introuvable", ...] }`
7. Si OK → appliquer dans une transaction DB, retourner l'objet créé/modifié

## 7.4 Flux de confirmation

```
Utilisateur → [message texte]
                    ↓
        POST /api/v1/ai/chat (SSE)
                    ↓
     Tokens streamés → interface chat
     Si token "```action" détecté :
       → Parser le JSON brut
       → Stocker dans store.pendingAction
       → Arrêter l'affichage des tokens du bloc action
       → Afficher APRÈS le texte : composant <ActionPreview>
                    ↓
         <ActionPreview> montre :
         - Type d'action : "Créer un programme"
         - Résumé : "PPL 3j/sem, hypertrophie, 4 templates…"
         - Détails (accordéon) : JSON formaté lisible
         - Boutons : [Annuler] [Confirmer et appliquer]
                    ↓
         Si Confirmer → POST /api/v1/ai/apply-action
                      → Toast "✓ Programme créé"
                      → Rediriger vers #/programs/:id
         Si Annuler  → store.pendingAction = null
                      → Message dans le chat : "Action annulée."
```

## 7.5 Format des conseils d'achat

Le signal détecté est un objet `signal_data` (JSON) transmis au LLM avec ce prompt :

```
Voici un signal de limitation de matériel détecté par le moteur de progression :
{signal_data_json}

Rédige un conseil d'achat CONCIS (3–5 phrases) avec :
1. Le problème précis (chiffres inclus du signal_data)
2. Le type de matériel recommandé (sans marque, sauf si demandé)
3. Ce que ça débloque concrètement
4. Un ordre de grandeur de budget en EUR
5. Une alternative gratuite ou économique si elle existe

Ne recommande PAS de marques. Ne mets PAS de liens.
```

**Exemple de signal_data** :
```json
{
  "type": "max_load_reached",
  "exercise_id": "curl_barbell",
  "exercise_name_fr": "Curl barre",
  "max_load_kg": 23.0,
  "sessions_checked": 3,
  "target_reps_max": 12,
  "actual_reps_avg": 13.5
}
```

**Exemple de conseil généré** :
> "Votre curl barre plafonne à 23 kg depuis 3 séances avec 13–14 reps (objectif 12). Votre configuration actuelle atteint sa limite de chargement. L'achat d'une paire de plaques de 2,5 kg supplémentaires (1 paire = 5 kg de plus) débloquerait la progression et l'incrément minimal passerait de 2 kg à 2 kg (inchangé). Budget indicatif : 10–20 €. Alternative gratuite : utiliser des haltères fixes de 14 kg si disponibles, ou ajouter un exercice de curl unilatéral avec les ressources actuelles."

## 7.6 Gestion d'erreurs et timeouts

```javascript
// src/services/aiProvider.js

const AI_TIMEOUT_MS = 30000  // 30 secondes

async function* streamChat(messages, settings) {
  const url = normalizeBaseUrl(settings.ai_base_url) + '/chat/completions'
  
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT_MS)
  
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.ai_api_key}`
      },
      body: JSON.stringify({
        model: settings.ai_model,
        messages,
        stream: true,
        max_tokens: 2000
      }),
      signal: controller.signal
    })
    
    if (!res.ok) {
      const body = await res.text()
      throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`)
    }
    
    // Lire le ReadableStream ligne par ligne (SSE)
    for await (const line of readLines(res.body)) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6)
        if (data === '[DONE]') return
        const parsed = JSON.parse(data)
        const token = parsed.choices?.[0]?.delta?.content || ''
        if (token) yield { type: 'token', content: token }
      }
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      yield { type: 'error', message: 'Délai dépassé (30 s). Vérifiez la connexion au provider IA.' }
    } else {
      yield { type: 'error', message: err.message }
    }
  } finally {
    clearTimeout(timeout)
  }
}
```

**Erreurs à gérer et messages affichés** :
| Cas | Message affiché |
|---|---|
| Provider non configuré | "Le coach IA n'est pas encore configuré. Allez dans Paramètres > Coach IA." |
| Timeout 30 s | "Délai dépassé. Vérifiez que votre provider IA est accessible." |
| HTTP 401 | "Clé API invalide ou expirée. Vérifiez dans Paramètres > Coach IA." |
| HTTP 404 | "Endpoint introuvable. Vérifiez l'URL de base (chemin `/v1` manquant ?)." |
| HTTP 429 | "Limite de requêtes atteinte. Attendez quelques secondes." |
| JSON invalide | "Réponse du provider illisible. Essayez un autre modèle." |
| Action invalide | "L'action proposée par le coach est invalide : {détail}. Elle n'a pas été appliquée." |

---

# PARTIE 8 — Base d'exercices

## 8.1 Source

| Source | URL | Licence | Contenu |
|---|---|---|---|
| free-exercise-db | `github.com/yuhonas/free-exercise-db` | **Public Domain** | 800+ exercices JSON + images JPG |

## 8.2 Structure d'un exercice source (free-exercise-db)

```json
{
  "id": "Alternate_Incline_Dumbbell_Curl",
  "name": "Alternate Incline Dumbbell Curl",
  "force": "pull",
  "level": "beginner",
  "mechanic": "isolation",
  "equipment": "dumbbell",
  "primaryMuscles": ["biceps"],
  "secondaryMuscles": ["forearms"],
  "instructions": ["Sit down on an incline bench…"],
  "category": "strength",
  "images": ["Alternate_Incline_Dumbbell_Curl/0.jpg", "...1.jpg"]
}
```

## 8.3 Correspondances de transformation (`scripts/import-exercises.js`)

```javascript
// Mapping equipment (free-exercise-db → notre schéma)
const EQUIPMENT_MAP = {
  'barbell':          ['barbell'],
  'dumbbell':         ['dumbbell_fixed'],      // ou dumbbell_adjustable
  'cable':            ['cable_machine'],
  'machine':          ['cable_machine'],       // approximation
  'body only':        [],
  'bands':            ['resistance_band'],
  'kettlebells':      ['kettlebell'],
  'e-z curl bar':     ['ez_bar'],
  'foam roll':        [],
  'other':            [],
  'medicine ball':    [],
}

// Mapping muscles
const MUSCLE_MAP = {
  'chest':               'chest',
  'biceps':              'biceps',
  'triceps':             'triceps',
  'shoulders':           'shoulders',
  'middle back':         'back',
  'lats':                'back',
  'lower back':          'lower_back',
  'upper back':          'back',
  'traps':               'traps',
  'quadriceps':          'quads',
  'hamstrings':          'hamstrings',
  'glutes':              'glutes',
  'calves':              'calves',
  'forearms':            'forearms',
  'abdominals':          'core',
  'neck':                'neck',
  'abductors':           'glutes',
  'adductors':           'inner_thigh',
}

// Mapping movement_pattern (inféré depuis category + force + mechanic)
function inferMovementPattern(ex) {
  if (ex.category === 'cardio') return 'other'
  if (ex.category === 'stretching') return 'other'
  if (ex.primaryMuscles.includes('quadriceps') && ex.force === 'push') return 'squat'
  if (ex.primaryMuscles.includes('hamstrings') && ex.mechanic === 'compound') return 'hinge'
  if (ex.primaryMuscles.some(m => ['chest','shoulders','triceps'].includes(MUSCLE_MAP[m]))) {
    return ex.force === 'push' && ex.name.toLowerCase().includes('press') ? 'push_horizontal' : 'push_vertical'
  }
  if (ex.primaryMuscles.some(m => ['lats','middle back','biceps'].includes(m))) {
    return ex.force === 'pull' ? 'pull_horizontal' : 'pull_vertical'
  }
  if (ex.primaryMuscles.includes('abdominals') || ex.primaryMuscles.includes('lower back')) return 'core'
  return 'other'
}

// Inférer is_unilateral
function inferUnilateral(ex) {
  const name = ex.name.toLowerCase()
  return (name.includes('alternate') || name.includes('single') ||
          name.includes('one-arm') || name.includes('one arm') ||
          name.includes('unilateral')) ? 1 : 0
}
```

## 8.4 Script d'import

```javascript
// scripts/import-exercises.js
// Usage: node scripts/import-exercises.js <path-to-free-exercise-db>
//
// Étapes :
// 1. Lire dist/exercises.json depuis free-exercise-db
// 2. Pour chaque exercice : transformer via les mappings ci-dessus
// 3. Déduplicater les IDs (convertir PascalCase → snake_case)
// 4. Générer name_fr = name_en (les traductions FR sont à faire manuellement ou via LLM)
// 5. Écrire dans src/seed/exercises.json
// 6. Copier les images dans public/exercises/images/ en renommant le dossier en snake_case
//
// Format de sortie (src/seed/exercises.json) :
// [ { id, name_fr, name_en, category, force, mechanic, movement_pattern,
//     primary_muscles, secondary_muscles, equipment_required,
//     instructions_fr, instructions_en, image_paths, is_custom, is_unilateral } ]
```

## 8.5 Note sur les traductions FR

Au premier démarrage, `name_fr` = `name_en` pour tous les exercices importés. Les traductions FR sont ajoutées progressivement via la configuration des exercices (is_custom=0 mais name_fr éditable via une migration ultérieure). Ce comportement est acceptable pour le MVP.

---

# PARTIE 9 — Découpage en tâches

## Format de chaque tâche

> **T{M}.{N}** | Titre  
> **Objectif** : Ce que cette tâche produit.  
> **Dépendances** : Liste des tâches à compléter avant.  
> **Fichiers** : À créer / à modifier.  
> **Signatures et types** : Fonctions, routes, composants à implémenter.  
> **Étapes** : 1. 2. 3. …  
> **Critères d'acceptation** : Tests verts + comportement observable.

---

## JALON 1 — Socle, exercices, équipement

---

### T1.1 — Scaffolding projet

**Objectif** : Dépôt fonctionnel, serveur démarre, page blanche accessible.  
**Dépendances** : aucune  
**Fichiers** : `package.json`, `server.js`, `public/index.html`, `.env.example`, `README.md`, `scripts/download-vendors.js`

**package.json** :
```json
{
  "name": "WorkoutBuddy", "version": "1.0.0", "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "test": "node --test tests/**/*.test.js"
  },
  "dependencies": { "express": "4.18.3", "better-sqlite3": "13.0.3" },
  "devDependencies": { "supertest": "7.0.0" }
}
```

**server.js** (signatures) :
```javascript
import express from 'express'
import { migrate } from './src/db/migrate.js'
import { getDb } from './src/db/database.js'
// ... import routes

const app = express()
app.use(express.json())
app.use(express.static('public'))

// Montage routes : app.use('/api/v1/exercises', exercisesRouter) etc.
// Fallback SPA : app.get('*', ...) → index.html

async function bootstrap() {
  const db = getDb()      // ouvre/crée data/WorkoutBuddy.db
  migrate(db)             // applique migrations
  // seed si table exercise vide
  const port = JSON.parse(db.prepare("SELECT value FROM settings WHERE key='network_port'").get()?.value || '3000')
  const host = JSON.parse(db.prepare("SELECT value FROM settings WHERE key='network_host'").get()?.value || '"127.0.0.1"')
  app.listen(port, host, () => console.log(`WorkoutBuddy → http://${host}:${port}`))
}
bootstrap()
```

**scripts/download-vendors.js** : télécharge avec `fetch()` Vue 3 et Chart.js vers `public/vendor/`. Affiche un message d'erreur clair si le réseau est absent.

**Critères** : `npm install && node scripts/download-vendors.js && npm start` → 200 sur `http://localhost:3000`  
**Tests** : `tests/integration/api.test.js` → `GET /` retourne 200

---

### T1.2 — Base de données et migrations

**Objectif** : Schéma SQLite complet créé et versionné.  
**Dépendances** : T1.1  
**Fichiers** : `src/db/database.js`, `src/db/migrate.js`, `src/db/migrations/001_schema.sql`, `src/db/migrations/002_default_settings.sql`

**Signatures** :
```javascript
// database.js
export function getDb(): Database  // Singleton better-sqlite3

// migrate.js
export function migrate(db: Database): void
// Lit migrations/*.sql triés par nom
// Pour chaque migration dont le numéro > MAX(schema_version.version) :
//   Exécute en transaction, insère dans schema_version
// Lance une Error si le SQL échoue
```

**Étapes** :
1. Implémenter `getDb()` : créer `data/` si absent, ouvrir `data/WorkoutBuddy.db`, activer WAL (`PRAGMA journal_mode=WAL`), activer FK (`PRAGMA foreign_keys=ON`), retourner l'instance.
2. Implémenter `migrate()` : lire les fichiers du dossier, trier alphabétiquement, extraire le numéro (3 premiers chars), exécuter les non-appliqués.
3. Écrire `001_schema.sql` : copier exactement le SQL de la Partie 3.
4. Écrire `002_default_settings.sql` : copier exactement les INSERT de la Partie 3.

**Critères** : `data/WorkoutBuddy.db` créé, toutes les tables présentes, `schema_version` contient les lignes 1 et 2.  
**Tests** : `tests/unit/migrate.test.js` → re-exécuter `migrate()` est idempotent (ne génère pas d'erreur)

---

### T1.3 — Seed des exercices

**Objectif** : La table `exercise` contient ~800 exercices au premier démarrage.  
**Dépendances** : T1.2  
**Fichiers** : `scripts/import-exercises.js`, `src/seed/exercises.json`, `src/seed/seed.js`

**Signatures** :
```javascript
// seed.js
export function seedExercises(db: Database): void
// Si COUNT(*) FROM exercise == 0 :
//   Lire src/seed/exercises.json
//   INSERT OR IGNORE chaque exercice
//   console.log(`${n} exercices importés`)
```

**Étapes** :
1. Cloner `free-exercise-db`, lancer `make dist/exercises.json`.
2. Exécuter `node scripts/import-exercises.js <path>` → génère `src/seed/exercises.json`.
3. Copier les images dans `public/exercises/images/`.
4. Implémenter `seed.js` qui appelle `db.prepare('INSERT OR IGNORE INTO exercise VALUES (...)').run(...)` pour chaque exercice.
5. Appeler `seedExercises(db)` dans `server.js::bootstrap()` après les migrations.

**Critères** : `SELECT COUNT(*) FROM exercise` > 750  
**Tests** : T1.3 n'a pas de test unitaire. Critère vérifiable manuellement.

---

### T1.4 — API Exercices

**Objectif** : Tous les endpoints `/exercises` fonctionnels.  
**Dépendances** : T1.3  
**Fichiers** : `src/routes/exercises.js`

**Implémentation** des 7 endpoints décrits en Partie 4.1. Points critiques :
- `GET /exercises` avec filtres : utiliser `WHERE` dynamique avec des paramètres SQL sûrs (JAMAIS de concaténation).
- `primary_muscles` et `secondary_muscles` sont stockés en JSON text → filtrer avec `json_each()` SQLite ou LIKE `%"muscle"%`.
- `DELETE /exercises/:id` : vérifier d'abord que `is_custom=1`, sinon 403. Puis vérifier qu'aucun `template_exercise` ne le référence.

**Critères** : Chaque endpoint retourne le bon code HTTP et la bonne structure.  
**Tests** : `tests/integration/api.test.js` → GET/POST/PUT/DELETE exercices

---

### T1.5 — Service calcul charges + API Équipement

**Objectif** : `equipmentCalc.js` fonctionnel + tous les endpoints `/equipment`.  
**Dépendances** : T1.2  
**Fichiers** : `src/services/equipmentCalc.js`, `src/routes/equipment.js`

**Signatures** :
```javascript
// equipmentCalc.js
export function calculateAchievableLoads(
  equipmentItems: EquipmentItem[],
  exercise: Exercise
): { loads_kg: number[], min_increment_kg: number, max_load_kg: number }

export function calculateMinIncrement(
  equipmentItems: EquipmentItem[],
  exercise: Exercise
): number
```

**Étapes** :
1. Implémenter le DP bounded subset sum décrit en Partie 5.1.
2. Gérer les cas particuliers : aucune barre disponible (retourne `[]`), exercice `equipment_required=[]` (retourne `[0]`).
3. Implémenter les 5 endpoints `/equipment` + `GET /equipment/achievable-loads`.

**Critères** : Avec l'exemple de la spec (2 barres 1 kg, plaques 1/2/5 kg), `calculateAchievableLoads` retourne `{loads_kg:[1,3,5,...,23], min_increment_kg:2, max_load_kg:23}`.  
**Tests** : `tests/unit/equipmentCalc.test.js` — voir Partie 10

---

### T1.6 — Scaffold frontend Vue 3

**Objectif** : SPA montée, router fonctionnel, store global, i18n.  
**Dépendances** : T1.1  
**Fichiers** : `public/index.html`, `public/js/app.js`, `public/js/router.js`, `public/js/store.js`, `public/js/i18n.js`, `public/js/api.js`, `public/locales/fr.json`, `public/locales/en.json`, `public/css/main.css`, `public/css/themes.css`

**index.html** (structure) :
```html
<!DOCTYPE html>
<html lang="fr" data-theme="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <meta name="theme-color" content="#1a1a1a">
  <link rel="manifest" href="/manifest.json">
  <link rel="stylesheet" href="/css/main.css">
  <link rel="stylesheet" href="/css/components.css">
  <link rel="stylesheet" href="/css/themes.css">
  <title>WorkoutBuddy</title>
</head>
<body>
  <div id="app"></div>
  <script type="module" src="/js/app.js"></script>
</body>
</html>
```

**app.js** (signatures) :
```javascript
import { createApp } from '/vendor/vue.esm-browser.prod.js'
import { router } from './router.js'
import { store } from './store.js'
import AppShell from './components/layout/AppShell.js'
// importer tous les composants...

const app = createApp(AppShell)
app.provide('store', store)
app.provide('router', router)
// app.component('LoadingSpinner', LoadingSpinner) etc.
app.mount('#app')
```

**router.js** (signatures) :
```javascript
// Hash router. Écoute 'hashchange' + 'load'.
// Expose : router.push(hash), router.currentRoute (reactive ref)
// Gère les paramètres (:id) via regex
export const router = {
  currentRoute: reactive({ path: '', params: {} }),
  push(hash) { window.location.hash = hash },
  // init() : window.addEventListener('hashchange', ...)
}
```

**store.js** (structure) :
```javascript
import { reactive } from '/vendor/vue.esm-browser.prod.js'
export const store = reactive({
  settings: null,        // chargé au démarrage
  activeSession: null,   // séance en cours
  pendingAction: null,   // action IA en attente de confirmation
  toast: null,           // { message, type:'success'|'error'|'info', id }
  // Méthodes :
  showToast(message, type='info', duration=3000) { ... },
  setActiveSession(session) { ... },
})
```

**Critères** : `npm start` → `#/` → "Dashboard" visible. `#/exercises` → "Exercices" visible. Toast fonctionne.  
**Tests** : pas de test automatisé sur le frontend pour le MVP.

---

### T1.7 — Écrans Exercices + Équipement

**Objectif** : Pages exercices et équipement navigables.  
**Dépendances** : T1.4, T1.5, T1.6  
**Fichiers** : Composants dans `public/js/components/exercises/` et `public/js/components/equipment/`

**Étapes** :
1. `ExerciseListView` : charge `GET /exercises`, affiche `ExerciseCard[]`, filtre par muscle/équipement.
2. `ExerciseDetailView` : charge `GET /exercises/:id` + `GET /exercises/:id/history?limit=5`.
3. `EquipmentView` : charge/modifie l'inventaire. Bouton "Calculer charges" → `GET /equipment/achievable-loads?exercise_id=X` → affiche la liste et l'incrément.
4. États chargement/vide/erreur sur chaque vue (utiliser `LoadingSpinner`, `EmptyState`, `ErrorBanner`).

**Critères** : L'inventaire peut être créé/modifié/supprimé. Les charges atteignables s'affichent correctement.

---

### T1.8 — PWA (manifest + service worker)

**Objectif** : App installable, fonctionne hors-ligne pour les assets statiques.  
**Dépendances** : T1.6  
**Fichiers** : `public/manifest.json`, `public/sw.js`, `public/icons/`

**manifest.json** :
```json
{
  "name": "WorkoutBuddy",
  "short_name": "WorkoutBuddy",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#1a1a1a",
  "theme_color": "#1a1a1a",
  "orientation": "portrait",
  "icons": [
    {"src":"/icons/icon-192.png","sizes":"192x192","type":"image/png"},
    {"src":"/icons/icon-512.png","sizes":"512x512","type":"image/png"}
  ]
}
```

**sw.js** : Cache First pour les assets `public/` (JS, CSS, HTML, vendor). Network First pour `/api/`. Cache `offline.html` comme fallback.

**Critères** : Chrome DevTools → "Install" visible. F12 → Application → Service Worker → actif.

---

## JALON 2 — Programmes, mode séance, timers

---

### T2.1 — API Programmes et Templates

**Objectif** : CRUD complet programmes et templates, endpoint `generate`.  
**Dépendances** : T1.2, T1.4  
**Fichiers** : `src/routes/programs.js`, `src/routes/templates.js`, `src/services/programGenerator.js`

**programGenerator.js** :
```javascript
export function generateProgram(params: GenerateParams): ProgramDraft
// ProgramDraft = { meta, templates[] } — pas de DB, objet pur
// L'appelant (route programs.js) persiste ensuite le draft en DB
```

**Points critiques** :
- `POST /programs/:id/activate` : UPDATE program SET is_active=0 WHERE is_active=1, puis UPDATE … SET is_active=1 WHERE id=?. Dans une transaction.
- `GET /programs/:id/next-session` : Appelle `progressionEngine.computeNextState()` pour chaque template_exercise → retourne le `NextSession` décrit en Partie 4.3.

**Critères** : POST /programs/generate crée un programme avec templates et template_exercises en DB.

---

### T2.2 — API Sessions et Sets

**Objectif** : CRUD complet sessions, session_exercises, set_logs.  
**Dépendances** : T2.1  
**Fichiers** : `src/routes/sessions.js`, `src/routes/sets.js`

**Points critiques** :
- `POST /sessions/:id/complete` : transaction → calculer `total_volume_kg = SUM(weight_kg * reps WHERE is_completed=1 AND is_warmup=0)`, `rpe_avg = AVG(rpe WHERE rpe IS NOT NULL)`, `duration_seconds = strftime('%s', completed_at) - strftime('%s', started_at)`.
- `GET /sessions/:id/target/:templateExerciseId` : appelle `progressionEngine.computeNextState()` et retourne la `NextSession` pour un seul exercice.
- `POST /sets/:id` → après PUT si `is_completed=1` : vérifier si PR battu (1RM estimé > MAX(estimated_1rm_kg) pour cet exercice/reps), si oui INSERT dans `personal_record`.

---

### T2.3 — Écrans Programmes (liste + détail + création)

**Objectif** : Navigation et édition des programmes depuis le frontend.  
**Dépendances** : T2.1, T1.6  
**Fichiers** : composants dans `programs/`

**Points critiques** :
- `ProgramForm` : doit inclure la gestion des templates et de leurs exercices (via `ExerciseSelector`).
- `ProgramGenerator` : formulaire → `POST /programs/generate` → redirection vers `ProgramDetailView` du nouveau programme.
- Activer un programme : bouton "Définir comme actif" → `POST /programs/:id/activate` → Toast.

---

### T2.4 — Écran séance active + validation des séries

**Objectif** : `SessionActiveView` fonctionnel avec validation série par série.  
**Dépendances** : T2.2, T1.6  
**Fichiers** : composants dans `session/`

**Comportement SetRow** :
- État initial : champs pré-remplis avec `target.weight_kg` et `target.target_reps_min`.
- Sur ✓ : `POST /session-exercises/:id/sets` avec `is_completed: 1` → afficher la série comme validée (fond vert).
- Sur modification post-validation : `PUT /sets/:id` (on peut modifier une série déjà validée).
- Ajouter série : append une SetRow vierge copiée depuis les valeurs de la dernière série.

---

### T2.5 — Timers (Web Worker + sons + vibration + Wake Lock)

**Objectif** : Timers fonctionnels en arrière-plan.  
**Dépendances** : T2.4  
**Fichiers** : `public/js/timer-worker.js`, `public/js/components/session/RestTimer.js`, `public/js/components/session/SessionTimer.js`, `public/sounds/timer-end.mp3`

**timer-worker.js** : implémentation exacte du pseudo-code de la Partie 6.3 (START_REST, START_SESSION, STOP, RESET).

**RestTimer.js** :
- Cercle SVG progress : `stroke-dashoffset = circumference * (1 - elapsed/total)`
- Couleur : vert (> 50% restant) → orange (20-50%) → rouge (< 20%)
- Message REST_COMPLETE → main thread → audio + vibration.

**timer-end.mp3** : fichier audio libre de droits, < 50 KB, inclus dans le repo. Source suggérée : Freesound.org (licence CC0).

**Critères** : Démarrer le timer de repos, passer l'onglet en arrière-plan, attendre la fin → le son se déclenche.

---

## JALON 3 — Progression, deload, calendrier

---

### T3.1 — Moteur de progression

**Objectif** : `progressionEngine.js` avec les 3 modèles.  
**Dépendances** : T1.5, T2.2  
**Fichiers** : `src/services/progressionEngine.js`, `src/services/rmCalculator.js`

**Signatures complètes** :
```javascript
// rmCalculator.js
export function estimate1RM(weight_kg: number, reps: number, formula: string): number
export function rmTable(estimated_1rm: number, formula: string): { reps: number, weight_kg: number }[]
export const FORMULAS: Record<string, (w: number, r: number) => number>

// progressionEngine.js
export function computeNextState(
  state: ProgressionState,
  lastSessionSets: SetLog[],
  templateExercise: TemplateExercise,
  achievableLoads: number[],
  settings: Settings
): { current_weight_kg: number, current_target_reps?: number, consecutive_failures: number, explanation: string }

export function resolveProgressionModel(
  templateExercise: TemplateExercise,
  program: Program
): 'linear' | 'double_progression' | 'rpe_based'
```

**Critères** : Tests unitaires verts (voir Partie 10).

---

### T3.2 — Détection de plateau + deload

**Objectif** : `plateauDetector.js` et `deloadEngine.js` fonctionnels + intégration dans sessions.  
**Dépendances** : T3.1  
**Fichiers** : `src/services/plateauDetector.js`, `src/services/deloadEngine.js`

**Intégration** : `POST /sessions/:id/complete` appelle `deloadEngine.shouldDeload()`. Si retourne `{ should: true }` → mettre `program.is_in_deload=1` + créer une `equipment_advice` de type `persistent_plateau` si applicable. Retourner dans la réponse `{ deload_triggered: true, reason }`.

**Démarrage de deload côté frontend** : Toast "Semaine de deload recommandée. Objectifs réduits pour la prochaine séance."

---

### T3.3 — Rotation d'exercices

**Objectif** : `rotationEngine.js` + application lors de `POST /sessions/from-template/:id`.  
**Dépendances** : T3.1, T2.2  
**Fichiers** : `src/services/rotationEngine.js`

**Critères** : Si un programme a `use_exercise_rotation=1` et 2 exercices dans le même `rotation_group`, l'exercice change bien chaque semaine.

---

### T3.4 — Calendrier (API + écran)

**Objectif** : Vue calendrier mensuelle avec séances planifiées/réalisées.  
**Dépendances** : T2.2, T1.6  
**Fichiers** : `public/js/components/calendar/CalendarView.js`

**Critères** : Navigation mois, dots colorés, tap → détail ou popup action.

---

## JALON 4 — Stats et courbes

---

### T4.1 — API Stats + streaks

**Objectif** : Tous les endpoints `/stats` fonctionnels.  
**Dépendances** : T2.2, T3.1  
**Fichiers** : `src/routes/stats.js`, `src/services/streakCalculator.js`

**Critères** : Tests unitaires streaks verts (voir Partie 10).

---

### T4.2 — Poids de corps

**Objectif** : CRUD poids + courbe.  
**Dépendances** : T1.6, T4.1  
**Fichiers** : `src/routes/bodyweight.js`, composants `stats/BodyWeightView.js`

**BodyWeightChart.js** : Chart.js line chart. Axe X = dates. Axe Y = poids. Affiche la moyenne mobile sur 7 jours (calculée client).

---

### T4.3 — Écrans statistiques

**Objectif** : Dashboard stats complet avec graphiques.  
**Dépendances** : T4.1, T4.2  
**Fichiers** : composants dans `stats/`

**VolumeChart.js** : Chart.js bar chart. Axe X = semaines ISO. Axe Y = volume en kg. Stacké par groupe musculaire.  
**ExerciseProgressView.js** : Ligne Chart.js pour le RM estimé dans le temps. Boutons pour changer la formule.

---

## JALON 5 — Coach IA et conseils d'achat

---

### T5.1 — Service AI provider

**Objectif** : `aiProvider.js` avec streaming, normalisation URL, gestion d'erreurs.  
**Dépendances** : T1.2  
**Fichiers** : `src/services/aiProvider.js`

**Signatures** :
```javascript
export function normalizeBaseUrl(url: string): string
export async function* streamChat(messages: Message[], settings: AiSettings): AsyncGenerator<StreamEvent>
export async function listModels(settings: AiSettings): Promise<{ id: string, name: string }[]>
export async function testConnection(settings: AiSettings): Promise<{ success: boolean, latency_ms: number }>
```

**Critères** : `normalizeBaseUrl` — 5 cas de tests verts. Timeout de 30 s géré. Erreurs HTTP mappées vers messages clairs.

---

### T5.2 — Détecteur de signaux équipement

**Objectif** : `equipmentAdvisor.js` avec les 5 signaux.  
**Dépendances** : T1.5, T3.2  
**Fichiers** : `src/services/equipmentAdvisor.js`

**Critères** : Tests unitaires avec fixture DB verts (voir Partie 10).

---

### T5.3 — API Chat IA (SSE) + apply-action

**Objectif** : `/ai/chat` streaming + `/ai/apply-action` avec validation.  
**Dépendances** : T5.1, T5.2, T2.1  
**Fichiers** : `src/routes/ai.js`

**Points critiques** :
- Assembler le context (equipment, programme, sessions) depuis DB.
- Injecter dans le system prompt.
- Parser le bloc ```action``` dans le stream : détecter `\`\`\`action` → bufferiser jusqu'à `\`\`\`` → émettre event `{type:'action', action:{...}}`.
- La clé AI est lue depuis `settings` en DB, jamais passée en paramètre HTTP.

---

### T5.4 — Génération et affichage des conseils d'achat

**Objectif** : `runAllSignalChecks()` intégré + génération LLM du texte de conseil.  
**Dépendances** : T5.1, T5.2, T5.3  
**Fichiers** : `src/routes/ai.js` (endpoints /advice), composants `coach/AdviceCard.js`

**Flux** :
1. `POST /sessions/:id/complete` → appelle `runAllSignalChecks(db, settings)`.
2. Pour chaque signal retourné → créer une `equipment_advice` avec `status='active'`, `advice_text=null`.
3. Appeler `aiProvider.streamChat()` avec le prompt de conseil → stocker le texte final dans `advice_text`.
4. Le conseil s'affiche dans le Dashboard.

**Anti-spam** : `isOnCooldown()` vérifié dans `runAllSignalChecks()`. Un conseil par signal unique (index unique en DB).

---

### T5.5 — Interface Coach Chat

**Objectif** : Chat UI avec streaming + confirmation d'action.  
**Dépendances** : T5.3, T1.6  
**Fichiers** : composants dans `coach/`

**Comportement streaming** :
```javascript
// CoachView.js
async function sendMessage(text) {
  store.pendingAction = null
  const response = await fetch('/api/v1/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: text, history: chatHistory.slice(-10) })
  })
  const reader = response.body.getReader()
  let buffer = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const chunk = new TextDecoder().decode(value)
    // Parser les lignes SSE "data: {...}"
    for (const line of chunk.split('\n')) {
      if (line.startsWith('data: ')) {
        const event = JSON.parse(line.slice(6))
        if (event.type === 'token') buffer += event.content
        if (event.type === 'action') store.pendingAction = event.action
        if (event.type === 'error') showError(event.message)
      }
    }
    currentAssistantMessage.value = buffer
  }
}
```

---

## JALON 6 — Paramètres, export/import

---

### T6.1 — API Paramètres complète

**Objectif** : GET/PUT settings avec masquage clé API.  
**Dépendances** : T1.2  
**Fichiers** : `src/routes/settings.js`

**GET /settings** : retourner tous les settings sauf `ai_api_key`. Ajouter `ai_api_key_set: value !== ''`.  
**PUT /settings** : valider chaque clé connue (liste exhaustive = les 32 settings définis en Partie 3.2). Types et plages stricts.

---

### T6.2 — Écran Paramètres complet

**Objectif** : Toutes les sections de paramètres navigables et fonctionnelles.  
**Dépendances** : T6.1, T5.1, T1.6  
**Fichiers** : composants dans `settings/`

**AIProviderForm** :
- Bouton "Lister les modèles" → `GET /settings/ai-models` → dropdown.
- Bouton "Tester la connexion" → `POST /settings/test-ai` → Toast succès/échec.
- Champ clé API : `type="password"`, `autocomplete="off"`. Valeur affichée = `"••••••••"` si `ai_api_key_set=true`.

---

### T6.3 — Export/Import + sauvegarde auto

**Objectif** : Export JSON complet + Import + backup auto après séance.  
**Dépendances** : T2.2, T6.1  
**Fichiers** : `src/routes/exportImport.js`

**GET /export** : requête SELECT sur toutes les tables → sérialiser → téléchargement.  
**POST /import** : vérifier `data.version === 1`, transaction DELETE+INSERT, retourner résumé.  
**Backup auto** : Dans `POST /sessions/:id/complete` → copier `data/WorkoutBuddy.db` vers `data/backups/WorkoutBuddy_YYYY-MM-DD.db` avec `fs.copyFileSync()`. Purger si > 7 fichiers dans le dossier.

---

# PARTIE 10 — Stratégie de test

## 10.1 Tests unitaires obligatoires

**`tests/unit/equipmentCalc.test.js`** :
```javascript
test('spec example: 2 bars 1kg + plates 1/2/5kg', () => {
  const items = [
    {category:'barbell', weight_kg:1, count:1},
    {category:'barbell', weight_kg:1, count:1},
    {category:'plate', weight_kg:1, count:4},
    {category:'plate', weight_kg:2, count:4},
    {category:'plate', weight_kg:5, count:2},
  ]
  const exercise = { is_unilateral:0, equipment_required:['barbell'] }
  const result = calculateAchievableLoads(items, exercise)
  assert.deepEqual(result.loads_kg, [1,3,5,7,9,11,13,15,17,19,21,23])
  assert.equal(result.min_increment_kg, 2)
  assert.equal(result.max_load_kg, 23)
})
test('no plates: only bar weight achievable', () => { ... })
test('unilateral: loads = bar + per_side, not 2x', () => { ... })
test('adjustable dumbbell: full range by step', () => { ... })
```

**`tests/unit/rmCalculator.test.js`** :
```javascript
test('epley: 100kg×3 → 110kg', () => { assert.equal(estimate1RM(100,3,'epley'), 110) })
test('epley: 1 rep → weight itself', () => { assert.equal(estimate1RM(80,1,'epley'), 80) })
test('rmTable: 3 reps back-calculates to original weight', () => {
  const table = rmTable(110, 'epley')
  assert.ok(Math.abs(table.find(r=>r.reps===3).weight_kg - 100) < 0.5)
})
```

**`tests/unit/progressionEngine.test.js`** :
```javascript
test('linear: success → weight+increment', () => { ... })
test('linear: 2 failures → weight reduction', () => { ... })
test('double: reps at max → weight+increment, reps reset to min', () => { ... })
test('double: reps in range → reps increase, weight same', () => { ... })
test('double: 2 failures → weight reduction', () => { ... })
test('rpe: below target → weight increase', () => { ... })
test('rpe: above target → weight decrease', () => { ... })
test('roundDown: rounds to nearest achievable without exceeding', () => { ... })
```

**`tests/unit/plateauDetector.test.js`** :
```javascript
test('no plateau if fewer than N sessions', () => { ... })
test('plateau detected if 4 sessions with same 1RM', () => { ... })
test('no plateau if 1RM improved', () => { ... })
```

**`tests/unit/deloadEngine.test.js`** :
```javascript
test('scheduled deload after 6 weeks', () => { ... })
test('no deload if auto disabled', () => { ... })
test('plateau deload if ≥50% exercises in plateau', () => { ... })
test('computeDeloadTargets: weight -20%, sets reduced', () => { ... })
```

**`tests/unit/equipmentAdvisor.test.js`** :
```javascript
test('signal max_load if 3 sessions at max load with reps exceeded', () => { ... })
test('no signal if not at max load', () => { ... })
test('signal min_increment if increment >5% of weight AND plateau', () => { ... })
test('no_exercise_available signal for muscle with no equipment', () => { ... })
test('cooldown: no duplicate signal within cooldown period', () => { ... })
```

**`tests/unit/streakCalculator.test.js`** :
```javascript
test('streak=0 if no sessions this week', () => { ... })
test('streak=2 if 2 consecutive weeks', () => { ... })
test('streak resets on gap', () => { ... })
test('longest streak computed correctly', () => { ... })
```

## 10.2 Tests d'intégration

**`tests/integration/session.test.js`** — Scénario séance complète :
```javascript
// Prépare DB en mémoire (better-sqlite3 ':memory:')
// 1. POST /equipment : créer barre + plaques
// 2. POST /programs : créer programme linéaire
// 3. POST /programs/:id/activate
// 4. POST /sessions/from-template/:id : créer séance
// 5. POST /sessions/:id/start
// 6. POST /session-exercises/:id/sets (x4) : valider 4 séries
// 7. POST /sessions/:id/complete
// 8. Vérifier : session.status='completed', total_volume_kg correct
// 9. GET /programs/:id/next-session : vérifier que la charge cible a augmenté
// 10. Vérifier progression_state.current_weight_kg = initial + increment
```

**`tests/integration/api.test.js`** :
- Smoke test chaque endpoint (200/201/204 sur cas nominal).
- Test erreur 404 pour IDs inexistants.
- Test validation 400 pour corps manquants.

---

# PARTIE 11 — Hypothèses, risques et points ouverts

## Hypothèses (décisions prises unilatéralement)

| ID | Décision | Impact si contestée |
|---|---|---|
| H1 | Le port par défaut est **3000** | Modifier `002_default_settings.sql` |
| H2 | `name_fr` = `name_en` pour les exercices importés (pas de traduction FR automatique au départ) | Prévoir une migration de traduction + éditeur dans l'interface |
| H3 | Un seul programme **actif** à la fois | Si l'utilisateur veut 2 programmes simultanés, refactorer la contrainte d'activation |
| H4 | Les timers ne fonctionnent pas sur écran verrouillé iOS (Safari bloque les Web Workers en arrière-plan strict). Sur Android/Chrome et macOS ils fonctionnent. | Afficher un disclaimer sur iOS |
| H5 | L'auto-backup utilise `fs.copyFileSync()` — bloquant, donc potentiellement lent sur une très grande DB. | Acceptable jusqu'à ~100 MB |
| H6 | Les images d'exercices sont servies statiquement depuis `public/exercises/images/` — pas de lazy-loading serveur | Acceptable pour ~800 images, ~50 MB total |
| H7 | Le streaming SSE utilise `text/event-stream` côté serveur avec `res.write()`. Express 4 ne nécessite pas de configuration spéciale. | Tester avec un provider Ollama local en priorité |
| H8 | La formule RM par défaut pour les calculs de progression est **Epley** | Changer le setting `rm_formula` |
| H9 | Les conseils matériel en français sont dans `fr.json` ; le texte généré par le LLM est en français par défaut (instruction dans le prompt) | Si l'interface passe en EN, le conseil devrait aussi changer de langue |

## Risques

| Risque | Probabilité | Impact | Mitigation |
|---|---|---|---|
| better-sqlite3 nécessite une compilation native (node-gyp) au premier `npm install` | Moyen | Bloquant sur macOS sans Xcode CLI tools | README : "Installer Xcode Command Line Tools : `xcode-select --install`" |
| Provider IA local (Ollama) retourne des formats SSE légèrement différents | Moyen | Chat cassé | Tester avec Ollama en T5.1, adapter le parser SSE |
| free-exercise-db : certains exercices ont `equipment: null` | Haut | Filtre d'équipement cassé | Traiter null comme `[]` dans le script d'import |
| Wake Lock API non disponible sur tous les navigateurs | Haut | L'écran s'éteint pendant la séance | Catch silencieux, disclaimer dans l'aide |
| Import d'un fichier JSON corrompu ou d'une version future | Moyen | Crash ou données corrompues | Validation stricte + transaction, rollback si erreur |
| Chart.js 4 UMD dans un contexte ESM | Faible | Import échoue | Chart.js est accessible via `window.Chart` en UMD — utiliser `Chart` globalement dans les composants |

## Points ouverts (non bloquants pour le MVP)

1. **Traductions FR des exercices** : 800 exercices à traduire. Solution recommandée : appel LLM batch hors-ligne, stocker dans `name_fr`.
2. **Son du timer sur iOS** : le son ne se déclenche pas si l'onglet est en arrière-plan sur Safari. Envisager une notification Web Push (nécessite HTTPS).
3. **LAN sur macOS** : le firewall macOS peut bloquer le port 3000. Ajouter une note dans le README.
4. **Export CSV** : les caractères spéciaux (accents) doivent être encodés UTF-8 avec BOM pour Excel. Ajouter `\uFEFF` en début de fichier CSV.
5. **Unités lb** : toutes les valeurs sont stockées en kg en DB. La conversion est appliquée à l'affichage uniquement (côté client, via `weight.js`). Les exports sont toujours en kg.

---

# GLOSSAIRE

| Terme | Définition dans ce plan |
|---|---|
| **Template** / `workout_template` | Modèle de séance attaché à un programme (ex : "Push A") |
| **Session** | Instance concrète d'une séance, planifiée ou réalisée |
| **TemplateExercise** | Exercice dans un template avec ses paramètres de progression |
| **SessionExercise** | Exercice dans une session concrète |
| **SetLog** | Une série individuelle (poids, reps, RPE) |
| **ProgressionState** | État courant de la progression pour un TemplateExercise |
| **1RM** / **RM estimé** | Maximum estimé pour 1 répétition, calculé depuis une série effectuée |
| **Double progression** | Augmenter d'abord les reps (dans une fourchette), puis le poids |
| **Deload** | Semaine à charge et/ou volume réduits pour la récupération |
| **Plateau** | Stagnation du RM estimé sur N séances consécutives |
| **Rotation** | Alternance hebdomadaire d'exercices équivalents |
| **Signal équipement** | Condition déterministe détectant un besoin de matériel |
| **RIR** | Reps In Reserve — nombre de répétitions restantes avant l'échec |
| **RPE** | Rate of Perceived Exertion — intensité perçue de 6 à 10 |
| **Vendorisé** | Dépendance front copiée localement dans `public/vendor/` |
| **SSE** | Server-Sent Events — flux unidirectionnel serveur → client |
| **PWA** | Progressive Web App — application installable depuis le navigateur |
| **LAN** | Local Area Network — réseau local, pour accès depuis un téléphone |

---

# RÉCAPITULATIF

## Chiffres clés

| Élément | Nombre |
|---|---|
| Jalons | **6** |
| Tâches | **32** (T1.1→T1.8, T2.1→T2.5, T3.1→T3.4, T4.1→T4.3, T5.1→T5.5, T6.1→T6.3) |
| Endpoints API | **56** |
| Tables SQL | **12** |
| Services métier | **10** |
| Fichiers de test obligatoires | **9** |

## Ordre d'exécution recommandé (séquence minimale risque)

```
T1.1 → T1.2 → T1.3 → T1.4 → T1.5
                                  ↓
                             T1.6 → T1.7 → T1.8
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

## Critères d'acceptation du produit final — récapitulatif

| Critère | Tâche qui le valide |
|---|---|
| Démarrage en une commande, séance complète sans erreur sur mobile | T2.4, T2.5 |
| Progression propose des charges réalisables avec le matériel | T1.5, T3.1 |
| Coach signale un besoin matériel sans spam | T5.2, T5.4 |
| Aucune dépendance à licence commerciale | T1.1 (package.json vérifié) |
| Données survivent au redémarrage + export/import | T1.2, T6.3 |