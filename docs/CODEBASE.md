# Code index

[Documentation home](INDEX.md) · [README](../README.md)

- [Server and data](#server-and-data)
- [API — `/api/v1`](#api--apiv1)
- [Business logic — `src/services/`](#business-logic--srcservices)
- [Frontend — `public/`](#frontend--public)
- [Tests and documentation](#tests-and-documentation)

Installation, behavior and testing: [README.md](../README.md). Development rules: [AGENTS.md](../AGENTS.md). Tracking: [TASKS.md](TASKS.md).

## Server and data

| Location | Role |
| --- | --- |
| `server.js` | Startup, routes, static files |
| `src/db/database.js` | SQLite connection |
| `src/utils/messages.js`, `src/locales/` | Backend message keys and French/English resources; French default preserves API responses and saved explanations |
| `src/db/migrate.js`, `src/db/migrations/` | Migrations |
| `src/db/backup.js`, `src/db/privateStorage.js` | Private SQLite backups and permissions |
| `src/seed/` | Source catalog, `exercises.fr.json` translations, loading and synchronization |
| `scripts/` | Library downloads and exercise imports |
| `scripts/download-exercise-images.js` | Photo installation/resumption at a pinned source revision, offline checks with `--check`, without catalog import or SQLite access |

## API — `/api/v1`

All files below are in `src/routes/`.

| Domain | File |
| --- | --- |
| Exercises, history, exclusions | `exercises.js` |
| Inventory and available weights | `equipment.js` |
| Program creation, activation, editing | `programs.js` |
| Workout templates and exercise replacement | `templates.js` |
| Workouts, targets, starting and completing | `sessions.js` |
| Sets | `sets.js` |
| Statistics and records | `stats.js` |
| Bodyweight | `bodyweight.js` |
| Preferences, batch saving, AI connection | `settings.js` |
| Profile | `userProfile.js` |
| AI Coach and conversations | `ai.js` |
| Exports, import, backups and resets | `exportImport.js` |

## Business logic — `src/services/`

| Domain | Files |
| --- | --- |
| Program creation | `programGenerator.js`, `programPlanner.js`, `programExerciseCatalog.js` |
| Scheduling and duration | `sessionScheduler.js`, `programLifecycle.js`, `programWeeklyProgress.js` |
| Progression and exercise memory | `progressionEngine.js`, `exerciseProgression.js`, `firstTimeSuggestion.js`, `sessionReset.js`, `trainingHistory.js` |
| Replacement and constraints | `exerciseReplacement.js`, `exerciseConstraints.js`, `exerciseEquipment.js` |
| Reviews, deload, plateaus | `programReview.js`, `deloadEngine.js`, `plateauDetector.js` |
| Equipment and calculations | `equipmentCalc.js`, `rmCalculator.js`, `personalRecords.js`, `streakCalculator.js` |
| AI Coach | `aiProvider.js`, `systemPromptBuilder.js`, `coachingAdvisor.js`, `adviceTextGenerator.js`, `actionStreamParser.js` |
| HTTP security | `httpSecurity.js`: headers, origins, limits and proxy configuration |
| Utilities and compatibility | `date.js`, `validation.js`, `rotationEngine.js`, `catalogueCleanup.js` |

## Frontend — `public/`

| Domain | Location |
| --- | --- |
| Initialization, navigation, state, API, translations | `js/app.js`, `js/router.js`, `js/store.js`, `js/api.js`, `js/i18n.js` |
| Version detection, input protection and return to portal after expiry | `js/appUpdates.js`, `js/api.js`, `js/components/common/AppUpdateBanner.js`, `sw.js` |
| Balanced dashboard, buttons below the active program, goal and frequency | `js/views/DashboardView.js`, `.dashboard-view` styles in `css/components.css` |
| Dashboard calendar with persistent selection, first day outside the current month, today on return and paginated workouts | `js/components/calendar/CalendarView.js`; resume/scheduled priority, full list on the separate calendar |
| Keeping the screen awake, saved preference and renewal on return | `js/utils/screenWakeLock.js`, initialization in `js/app.js`, state in `js/store.js`, General in `SettingsView.js`, migration `017_screen_wake_lock.sql` |
| Navigation and shared components | `js/components/layout/`, `js/components/common/` |
| Exercises, pain, filters | `js/components/exercises/` (`ExerciseMotion.js` for animated photos) |
| Inventory and equipment registry | `js/components/equipment/` (`EquipmentEditor.js`, `inventoryCatalog.js`) |
| Questionnaire, goal-titled card and single-active-program reminder | `js/components/programs/` |
| Workout, sets, history and rest | `js/components/session/`, `js/timer-worker*.js` |

### Screens and interactions

| Domain | Location |
| --- | --- |
| Calendar, statistics, coach, settings | `js/components/calendar/`, `stats/`, `coach/`, `settings/` under `js/components/` |
| Coach input resizable up to 120 px, Enter to send on desktop, Shift+Enter for a newline; Enter for a newline on mobile | `js/components/coach/CoachView.js`, `.coach-view__input` in `css/components.css` |
| Chat preserved during navigation, off-screen response and return to the latest message | `KeepAlive` limited to Coach in `js/components/layout/AppShell.js`, activation hooks and dimension observation in `js/components/coach/CoachView.js` |
| Animated thinking indicator, reduced motion and bubbles without avatars | `js/components/coach/ChatMessage.js`, `.chat-msg` styles in `css/components.css` |
| Single Authelia logout button with confirmation | `js/components/settings/SettingsView.js`, `js/api.js`, Caddy `/auth/logout` route |
| RM, warm-up, pain, dates, dialogs | `js/utils/` |
| Styles, translations, libraries, cache | `css/`, `locales/`, `vendor/`, `sw.js` |
| Touch zoom disabled, native scrolling and mobile fields without focus zoom | viewport in `index.html`, `css/main.css`, `css/components.css`; journeys in `tests/e2e/security.spec.js` |
| Tab and home-screen logo | `icons/workoutbuddy.svg`, `favicon.ico`, `apple-touch-icon.png`, `icons/icon-*.png`, `manifest.json`, generation through `scripts/generate-icons.js` |

## Tests and documentation

Guides are collected in [INDEX.md](INDEX.md): usage, configuration, deployment and
testing. Code paths below are relative to the repository root.

| Location | Contents |
| --- | --- |
| `scripts/test-selection.js`, `test-affected.js` | Node selection by imports and API domains, `test:affected` command, explicit files and `--list` preview |
| `scripts/e2e-selection.js`, `test-e2e-affected.js`, `pre-push.js` | Affected browser domains, explicit override after diff review, cache version alone ignored, targeted Node/browser hook; tests in `tests/unit/e2eSelection.test.js` |
| `tests/unit/`, `tests/integration/` | Business logic and API; `reliabilityStress.test.js` for duration and incident simulations |
| `tests/journeys/` | Complete journeys; [guide](TESTS_JOURNEYS.md) |
| `tests/helpers/` | Isolated request execution |
| `tests/e2e/` | Playwright journeys against isolated server and database; [guide](TESTS_E2E.md) |

### Frontend coverage

| Location | Contents |
| --- | --- |
| `tests/e2e/updates.spec.js` | Release on isolated copy: reload, draft, network failure and HTTP proxy for expired sessions, including old worker |
| `tests/unit/screenWakeLock.test.js` | Single acquisition, release, background/foreground, pending request, browser denial and unsupported platform |
| `tests/e2e/authProxy.js`, `settings.spec.js` | Saved screen-awake option, navigation/reload, disabling, denial and incompatibility; shared disposable HTTP proxy, confirmed logout and data preservation |
| `tests/e2e/theme.spec.js`, `security.spec.js` | Light theme and completed-set contrast; icon links and decoding, Apple/manifest dimensions and opacity |
| `tests/e2e/dashboard.spec.js` | Dashboard across eight sizes/safe areas, buttons below the program, enlarged areas and scrolling on short screens, portrait/landscape, six weeks, all statuses, pagination, completed week; five goals in French/English |
| `tests/e2e/coach.spec.js` | Resizable input, desktop Enter to send, Shift+Enter and mobile Enter for a newline, keyboard composition preserved, reduced-motion animation, no avatars; navigation before/during response, off-screen completion, immediate following of long responses, resizing, persistence and return to bottom after navigation/reload; local SSE provider, no external AI |
| `tests/ui/` | Additional Playwright visual scenarios |

### Deployment and operations

| Location | Contents |
| --- | --- |
| `docs/RELIABILITY_AUDIT.md` | Latest audit: fixes, coverage and limitations |
| `deploy/docker/`, `docs/DEPLOYMENT_DOCKER.md`, `.dockerignore` | Node 24 image, local/production Compose, SQLite volume, health, backup/restore and isolated test |
| `docs/DEPLOYMENT_LINUX.md`, `deploy/linux/redhat-based/`, `deploy/linux/debian-based/` | Unified Linux guide: shared configuration, Red Hat DNF 4/5 and Debian/Ubuntu APT with needrestart |
| `deploy/linux/test-deployment.py`, `deploy/linux/*/check-platform.py` | Requirement checks, private configuration rendering and shared-file parity |
| `deploy/linux/*/workoutbuddy-maintenance`, `workoutbuddy-maintenance.*` | Backup before DNF/APT updates, conditional restart between 04:00 and 06:00 Paris time |
| `deploy/linux/*/workoutbuddy-audit.*`, `test-maintenance.py` | Weekly npm audit and simulated maintenance tests without touching the server |
| `deploy/linux/*/workoutbuddy-deploy-assets` | Mandatory photo checks, atomic frontend publication and previous-version retention |
| `deploy/linux/*/workoutbuddy-sessions.*`, `authelia-sessions.conf`, `valkey-sessions.conf` | Private persistent Redis/Valkey storage for Authelia sessions over a Unix socket |
| `deploy/linux/*/test-auth-sessions.py`, `test-auth-recovery.mjs` | Disposable full-stack Caddy/Authelia/Redis/Node test: TOTP, 60-day cookie, persistence, revocation through Settings button, public icons, headers and HTTPS worker activation |

Content and Git history security:
[docs/REPOSITORY_SECURITY.md](REPOSITORY_SECURITY.md).

Shared instructions in `public/js/i18n.js` remind users to enter the weight of **one dumbbell**
for every exercise using dumbbells, in exercise details and in-workout help, in French/English.
In `public/js/components/session/ExerciseHelp.js`, the entry note is separate from instructions
(`exerciseInstructions(exercise, false)`), followed by concise starting-weight advice before
the RM table.

The entire catalog and both languages are checked in `tests/e2e/exercises.spec.js`;
in-workout help is checked in `motion.spec.js`.
