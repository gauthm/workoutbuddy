# WorkoutBuddy — Codebase Index

## Stack
Node.js 20 / Express 4.18.3 / better-sqlite3 13 / Vue 3.5 (fichier local, pas de build) / Chart.js 4.4
PWA (Service Worker cache-first) | Tests: node:test + supertest | ES Modules partout

## Structure
```
server.js          → entrée unique (migrate + seed + listen)
src/
  db/              → database.js (singleton SQLite WAL), migrate.js, migrations/001-006*.sql
  routes/          → un fichier par domaine REST /api/v1/*
  services/        → logique métier pure (pas de DB directe, pas de res.json)
  seed/            → exercises.json + seed.js
public/
  js/
    app.js         → createApp Vue + mount
    router.js      → hash router (regex match, pas vue-router)
    store.js       → reactive() global (settings, activeSession, toast, pendingAction)
    api.js         → wrappers fetch /api/v1/*
    i18n.js        → t(key) + chargement locales JSON
    timer-worker.js → Web Worker timer repos
    utils/         → rm.js, weight.js, date.js
    components/    → layout/ | common/ | exercises/ | session/ | programs/ | stats/ | coach/ | equipment/ | settings/ | calendar/
  vendor/          → vue + chart.js (générés par scripts/download-vendors.js)
  locales/         → fr.json, en.json
  sw.js            → Service Worker PWA (cache-first, CACHE_NAME bump obligatoire)
tests/
  unit/            → services (DB :memory:)
  integration/     → routes (supertest + DB :memory:)
```

## Fichiers clés

### Server
server.js                → bootstrap: migrate + seed + scheduleWeeks + listen
src/db/database.js       → singleton better-sqlite3 (WAL, foreign_keys, busy_timeout)
src/db/migrate.js        → migrations séquentielles idempotentes (NNN_*.sql)
src/db/migrations/       → 001_schema, 002_default_settings, 003_user_profile, 004_equipment, 005_exercise_exclusion, 006_coach_history

### Routes (toutes sous /api/v1/)
routes/sessions.js (802L) → CRUD sessions + start/complete + ajustements coach
routes/ai.js (664L)       → chat SSE + validation/exec actions IA (12 types d'actions)
routes/exercises.js       → CRUD + history + rm-history + toggle-exclusion
routes/programs.js        → CRUD + génération
routes/templates.js      → workout templates + template_exercises
routes/sets.js           → set_log CRUD
routes/stats.js          → volume, PR, streaks, progression
routes/settings.js       → settings + test-ai + ai-models
routes/equipment.js      → CRUD + achievable-loads
routes/bodyweight.js     → body_weight tracking
routes/userProfile.js    → profil + onboarding
routes/exportImport.js   → export/import JSON

### Services (logique métier pure)
services/aiProvider.js         → streaming chat SSE (OpenAI-compatible: OpenAI, Groq, Mistral, Ollama, LM Studio)
services/systemPromptBuilder.js → construit le system prompt du coach IA
services/progressionEngine.js  → double/half progression + simple increment
services/programGenerator.js  → génère programme auto selon profil/objectifs
services/deloadEngine.js      → détection fatigue → décharge
services/plateauDetector.js   → détection stagnation
services/rotationEngine.js   → rotation exercices (A/B split)
services/sessionScheduler.js  → planification auto séances
services/coachingAdvisor.js   → conseils basés sur contexte
services/rmCalculator.js      → 1RM (Epley/Brzycki/Lander)
services/equipmentCalc.js    → charges atteignables selon équipement
services/streakCalculator.js  → séries de jours consécutifs
services/adviceTextGenerator.js → texte conseil pour UI
services/firstTimeSuggestion.js → suggestions premier usage

### Frontend
js/app.js              → init Vue, charge settings, applique langue + thème
js/router.js           → 19 routes hash (#/session, #/coach, #/stats, ...)
js/store.js            → état global réactif (settings, activeSession, toast, pendingAction)
js/api.js              → 12 wrappers fetch (exercises, equipment, programs, sessions, sets, stats, settings, ai, bodyweight, userProfile, templates, exportImport)
js/i18n.js             → t(key, params) + fallback fr
js/components/layout/AppShell.js → shell + nav bottom
js/components/session/SessionActiveView.js → séance en cours (sets, timer, rest)
js/components/coach/CoachView.js (470L) → chat IA + actions preview + onboarding
js/components/programs/ProgramDetailView.js → détail programme + exercices
js/components/stats/StatsDashboardView.js → volume, PR, streaks

## Patterns clés
- Pas de build frontend: Vue 3 en .js pur (template string), imports relatifs /vendor/vue.esm-browser.prod.js
- SQLite synchrone: db.prepare().get/.all/.run() — jamais async/await sur DB
- DB singleton: getDb() depuis database.js — jamais de 2e instance
- Migrations idempotentes: CREATE IF NOT EXISTS, INSERT OR IGNORE — jamais modifier un .sql existant
- Services: pas de DB directe, pas de res.json — la route gère HTTP, le service gère la logique
- API: JSON partout, erreurs `{ "error": "NOM" }`, codes HTTP stricts (200/201/204/400/404/409/500)
- Clé API IA: lue en DB côté serveur, jamais renvoyée au client (seulement `ai_api_key_set: bool`)
- i18n: t('clé') obligatoire — jamais de texte en dur dans templates
- PWA: sw.js cache-first → bump CACHE_NAME à chaque modif de public/
- Tests: DB :memory: par test, jamais data/workoutbuddy.db
- Colonnes JSON: JSON.stringify() avant INSERT, JSON.parse() après SELECT
- Coach IA: SSE streaming + 12 types d'actions validées côté serveur (create_program, schedule_sessions, swap_exercise, etc.)
