# Testing and development

[Documentation home](INDEX.md) · [README](../README.md)

- [Commands from the repository root](#commands-from-the-repository-root)
- [Business logic and API tests](#business-logic-and-api-tests)
- [Browser tests](#browser-tests)
- [Additional visual checks](#additional-visual-checks)
- [Architecture and migrations](#architecture-and-migrations)
- [Repository navigation](#repository-navigation)
- [Secret scanning](#secret-scanning)

## Commands from the repository root

```sh
npm run test:affected     # Affected Node files only
npm run test:affected -- --list # Preview selection without running tests
npm run test:affected -- tests/unit/equipmentCalc.test.js # Specific file
npm test                  # Full Node suite for cross-cutting changes
npm run test:journeys     # Seven reliability journeys
npm run test:e2e          # Real browser journeys, desktop and mobile
npm run test:e2e -- sessions  # Workout domain only
npm run test:e2e:affected # Domains affected by modified files
npm run test:e2e:affected -- --domains exercises,motion # Local scope verified in the diff
npm run hooks:install    # Pre-push checks for this repository
npm run test:in-process   # Same full suite as npm test
```

## Business logic and API tests

Tests use isolated in-memory or temporary databases. By default, `npm test` runs Express
requests directly, without ephemeral TCP ports; Playwright covers real HTTP exchanges.
Complete journeys exercise the real API and engine without an AI service:
program/calendar, workout/progression, deletion/history, export/import, settings,
replacement and invalid-import rollback.

See [the journey guide](TESTS_JOURNEYS.md). `tests/integration/reliabilityStress.test.js` adds a
simulation of 24 workouts over twelve weeks, duplicate requests, historical corrections,
inconsistent imports, rollback and deload after fatigue. Historical time is set up in fixtures;
the server and calculations remain real. Results and limitations: [reliability
audit](RELIABILITY_AUDIT.md).

## Browser tests

Tests in `tests/e2e/` drive a browser against the real server and a separate temporary database
for each case, without mocked API responses. They are split by domain: programs,
workouts, history/calendar, equipment, settings, data, exercises and statistics. Journeys
also check reloads, restarts and network errors; they run in Chrome with desktop and mobile
viewports.

For routine changes, run only affected Node files and browser domains, without repeating
successful validation. Global dependencies or unknown sources retain a full-suite fallback.
The pre-push hook uses this selection for pushed commits, with Node tests without TCP ports,
then real HTTP servers for the browser.

A cache version change alone does not rerun release tests. See [setup, selection and
reports](TESTS_E2E.md).

## Additional visual checks

The older scenarios in `tests/ui/` provide additional visual checks; some use mocked
API responses. Browser tests remain separate from `npm test`.

## Architecture and migrations

The frontend uses JavaScript modules and Vue components with templates, without `.vue` files
or compilation. The backend uses Express and synchronous SQLite. Existing migrations
remain immutable; new schema changes take the form of numbered migrations.
Every change to `public/` must update the service worker cache.

Write documentation, source code, comments, test descriptions and developer messages in
English, including when a request is written in French. Keep localized UI content and
language-specific test fixtures in their intended languages.

Frontend messages belong in `public/locales/fr.json` and `public/locales/en.json` and use
`t()` from `public/js/i18n.js`. Backend messages belong in `src/locales/fr.json` and
`src/locales/en.json` and use `message()` from `src/utils/messages.js`, with named
`{{parameters}}`. Backend messages retain French by default to preserve existing API
responses and saved explanations; English is available through the helper's explicit locale
argument. Internal AI instructions are written in English while retaining the Coach's
response-language policy.

## Repository navigation

To navigate the repository: [CODEBASE.md](CODEBASE.md) is the code index, [AGENTS.md](../AGENTS.md)
contains development rules and [TASKS.md](TASKS.md) tracks tasks. The [latest reliability
audit](RELIABILITY_AUDIT.md) describes coverage and its limitations. Completed tasks and old
plans remain available in Git history.

## Secret scanning

The [public repository review](REPOSITORY_SECURITY.md) describes scanning files and history
for secrets, its limitations and the command to repeat the scan.
