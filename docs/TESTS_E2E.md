# Isolated browser journeys

[Documentation home](INDEX.md) · [README](../README.md)

- [Requirements](#requirements)
- [Commands](#commands)
- [Choosing the right domain](#choosing-the-right-domain)
- [Pre-push checks](#pre-push-checks)
- [Results and diagnosis](#results-and-diagnosis)
- [Explicit limitations](#explicit-limitations)

### Server and data isolation

These tests start **the real `server.js`**, frontend, migrations and catalog. Each case
receives a fresh SQLite database in a temporary directory and a free port bound to `127.0.0.1`.
The fixture enforces the server's `DB_PATH`, `HOST` and `PORT` variables; no personal URL or
database is accepted. The file-based database allows server restarts and persistence checks.

The browser, server, database and temporary backups are cleaned up after every case,
including failures. Two cases can run in parallel without sharing data.

### User actions and real networking

Tested actions go through application buttons and fields. Direct HTTP calls prepare
preconditions and verify saved data. For example, the questionnaire test creates the
program in the interface; workout tests prepare their program through the API, then
complete sets in the interface. No application API response is mocked.

Failure tests interrupt a real request, then retry against the server.

## Requirements

- Install the project and its local resources normally (main README).
- Check photos with `node scripts/download-exercise-images.js --check`; install them with the same command without `--check` if necessary. Animation journeys use real catalog photos.
- Have Playwright and a compatible browser available. Reuse an existing toolchain; no npm dependency is added to the project.
- On a minimal Linux server, also install system fonts (for example `dejavu-sans-fonts` and `liberation-sans-fonts` on Rocky). Without fonts, headless Chromium may render text without dimensions and invalidate clicks or visibility assertions.
- The resolver tries locally available Playwright, then global `playwright` and `@playwright/mcp` installations found through `npm root -g`.
- If installed elsewhere, set `WB_PLAYWRIGHT_PATH` to its `package.json` (for `playwright` or `@playwright/mcp`). Its environment must provide `playwright/test` and the Playwright CLI. A Playwright installation elsewhere provided by the team is also suitable; the resolver downloads nothing.
- `WB_E2E_BROWSER_CHANNEL=chromium` uses Chromium already installed with that same Playwright version. The default is the machine's installed `chrome` channel. `WB_E2E_HEADED=1` shows browser windows.
- On the current server, use `WB_PLAYWRIGHT_PATH=/usr/local/src/workoutbuddy-deploy/browser/node_modules/playwright/package.json` and `WB_E2E_BROWSER_CHANNEL=chromium-headless-shell` to reuse the installed Playwright and headless Chromium shell.

## Commands

From the repository root:

```sh
npm run test:e2e
npm run test:e2e -- programs
npm run test:e2e -- sessions history
npm run test:e2e -- equipment --project=mobile
npm run test:e2e -- settings --project=desktop
npm run test:e2e -- --list
npm run test:e2e:affected
npm run test:e2e:affected -- --base origin/main
npm run test:e2e:affected -- --domains exercises,motion
```

Each file runs in two projects: desktop 1280×900 and mobile 390×844, with Chrome,
French locale and Europe/Paris timezone. Scenarios favor accessible roles and labels,
expectations on visible state and genuinely persisted data. No arbitrary delays or
automatic retries conceal failures.

## Choosing the right domain

### `dashboard.spec.js`

Dashboard without clipped text or inaccessible actions: eight iPhone/Safari and desktop
sizes, enlarged program/day areas, shortcuts below the program, scrolling on short screens,
portrait/landscape, safe areas, six weeks, persistent selection and month/year changes,
return to today, no program, completed week, all statuses, multiple-session pagination;
exact labels for all five goals in French and English.

### `coach.spec.js`

Resizable input, desktop Enter to send, Shift+Enter and mobile Enter for a newline,
keyboard composition and narrow desktop window, animated thinking and reduced motion,
no avatars; navigation before and during a response, off-screen completion, no duplicates,
immediate tracking of long chunks and resizes, persistence and return to bottom after
navigation/reload; real API with a disposable local SSE provider.

### `programs.spec.js`

Questionnaire, preview, activation, unlimited duration, valid/invalid days, compatible
replacement.

### `sessions.spec.js`

Set completion/undo, resumption after reload and restart, full workout, next target for
the same exercise, request interrupted before/after write without duplication, retry
conflict, completion blocked during save, lost completion/cancellation responses, abrupt
shutdown, continue/leave without saving.

### `history.spec.js`

Persistent deletion and progress recalculation, undoing Skipped status, rescheduling,
resetting a completed workout.

### `equipment.spec.js`

Adding quantity/weight, persistent saving, invalid input and draft cancellation.

### `settings.spec.js`

Batch profile/preferences saving, theme, restart, network failure and recovery; logout
through HTTP proxy, draft cancellation and data preserved; button absent without authentication.

### `data.spec.js`

JSON download, RESET confirmation, reset/import and resumption, rollback on invalid reference.

### `exercises.spec.js`

Search, filters, equipment availability, return from details, exclusion and counter;
per-dumbbell weight instructions across the entire catalog, in French and English.

### `motion.spec.js`

Alternating real photos, pause/resume, reduced animations, stopping off-screen and
in-workout help.

### `security.spec.js`

Pinch/double tap without zoom, real touch scrolling preserved, compact fields at 16 px;
CSP, workouts and charts under protection, foreign origins, mandatory JSON, AI limit,
in-progress/interrupted import, service worker and browser/iPhone icon decoding.

### `stats.spec.js`

Counters and chart after a workout, grouping, empty state.

### `updates.spec.js`

Publishing a copy of assets: foreground detection, reload without hard refresh,
draft preserved, real network failure, login assets rejected; HTTP proxy with expired
session during navigation, API calls, foregrounding and upgrade of an old worker.

### `theme.spec.js`

Light theme saved through the interface, text and field contrast, visible focus,
navigation and calendar; completed set values remain readable.

### Access control in tests

`authProxy.js` provides a disposable HTTP proxy shared by settings and update tests. It
reproduces redirects and expiry; revocation of a real Authelia session is checked
separately with `deploy/linux/redhat-based/test-auth-sessions.py` or
`deploy/linux/debian-based/test-auth-sessions.py`, never using a personal identity.

### Selecting affected tests

`scripts/e2e-selection.js` describes dependencies. Chat, dashboard and a modified journey
file select their own domains; a cache version change alone is ignored (worker behavior
changes select `updates`). A progression-engine change runs workouts, history, data and
statistics; an equipment change also runs programs and exercises.

A shared file (API, store, navigation, styles, translations, database…) or new source
file triggers the full suite. Documentation-only changes do not trigger the browser.

Without `--base`, selection includes modified, staged and new files; with `--base`, it
compares that reference to the working tree, including uncommitted changes, and adds new
untracked files. After reviewing the diff, `--domains exercises,motion` can target a local
change in a shared file; retain full selection when its effect is global.

## Pre-push checks

```sh
npm run hooks:install
```

This command enables `.githooks` **for this repository only**. It refuses to replace another
hooks path or an existing pre-push hook.

Each subsequent push selects Node files and Playwright domains affected by the commits
actually pushed. `scripts/test-selection.js` follows unit test imports and explicit API
test dependencies; a new unclassified API test remains included for backend changes.
Global dependencies and unknown sources retain a full-suite fallback.

In-process mode, also used by default by `npm test`, runs Express and its routes without
opening ephemeral TCP ports for business logic/API tests; real HTTP networking remains
covered by Playwright. A new branch or unavailable remote reference triggers the full suite.
A failure blocks the push. Branch deletion does not run tests.

For routine development, run the affected domain or `test:e2e:affected`, with only affected
Node tests (`npm run test:affected`, preview with `-- --list`, or explicit `.test.js` files).
Avoid full suites after every change and repetitions without new changes; see `AGENTS.md`.
Test changes are also checked by running the affected file.

## Results and diagnosis

The latest run produces an HTML report in `test-results/report/`. Traces, failure screenshots
and server logs are in `test-results/e2e/`. These files are not versioned; they contain only
test data.

```sh
npm run test:e2e:report
npm run test:e2e:trace -- test-results/e2e/case-path/trace.zip
```

The [trace viewer documentation](https://playwright.dev/docs/trace-viewer) explains how
to find actions, screenshots and requests for a failure.

## Explicit limitations

This suite covers functional journeys in Chrome with an emulated mobile viewport. It
does not validate Safari/Firefox, physical phones, load performance or every possible error.
Keyboard regression cases simulate visual-viewport resize/pan events to check navigation visibility
and Coach composer placement on desktop and mobile; they do not open a real system keyboard.
The service worker is blocked by default so tests query the tested version's files and server.

Security and update cases explicitly allow it: installation, reload under CSP, publication
of a complete version, asset failure/authentication redirect and offline navigation.
Release tests copy `public/` to their temporary directory before modification; they never
modify the shared repository or deployed files. No external AI service is used.

Unit/API tests remain necessary for detailed exploration of engine rules.
