# Reliability journeys

[Documentation home](INDEX.md) · [README](../README.md)

This suite runs user journeys with the real Express application: JSON parser,
validation, routes, SQLite and program/progression engine. API responses and the engine
are not mocked. Scenarios create and modify their data exclusively through application
routes.

## Running the suite

```sh
npm test
```

This includes unit tests, integration tests and these journeys. To run only the seven journeys:

```sh
npm run test:journeys
```

Each process uses a `:memory:` database, configured before imports and explicitly checked.
Each scenario resets its own data and sets up a test inventory. No ports are opened;
the running server, user database and user backups are not used. No AI service or network
access is required.

## Coverage

1. Questionnaire and preview without writes, creation, activation, changes to days and unlimited duration, consistent calendar; invalid changes leave data unchanged.
2. Completed workout, next progression and statistics; undo/redo of a set, exclusion of incomplete and warm-up sets from volume and records; duplicate completion rejected without a second progression.
3. Program deletion with history preserved, a new program retaining an exercise's progress, performance deletion and recalculation of statistics and targets.
4. Complete JSON export, reset, identical import and workout resumption with progression preserved: sessions, sets, bodyweight, records, per-exercise progression, calculation events and settings.
5. Batch saving of settings and profile: atomic rejection, correction, saving again, API key preserved when omitted and absent from responses/export.
6. Exercise replacement before a workout, prescription and history preserved; next workout uses the new exercise; replacement rejected during a workout.
7. Invalid import causing a foreign-key error after the transaction begins: all original data restored and the next workout still usable.

## During development

Run `npm test` after logic or data changes. Add a targeted case for each fixed bug and extend
these journeys when a change affects multiple features. Do not weaken an assertion to hide
a regression; adapt an expectation only when intended behavior or the API contract has
deliberately changed.

These journeys cover the API. For clicks, rendering, network interruptions and real server
restarts, use the isolated Playwright journeys in `tests/e2e/`: [guide](TESTS_E2E.md).
They run with desktop and mobile viewports and are selected by domain with `npm run
test:e2e:affected`.
