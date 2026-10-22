# Reliability audit — October 15, 2026

[Documentation home](INDEX.md) · [README](../README.md)

Scope: workouts and sets, per-exercise progression, weekly review, history, and
export/import. No test targets the personal database: API tests use an isolated database,
and browser journeys use a real server with a temporary SQLite file per case.

## Fixed defects

### Set submitted twice

**Risk observed in code or reproduced:** A lost set-creation response allowed the same
set number to be created twice.

**Fix and verification:** Immediate transaction: an identical retry returns the existing
set; different values produce an explicit conflict, without overwriting. Concurrent API
tests and browser tests after a real write followed by an interrupted response.

### Correction of a historical performance

**Risk observed in code or reproduced:** Editing or deleting a historical set updated
records but retained progression that was no longer correct.

**Fix and verification:** Recalculate achieved progress and workout-template targets in
the same transaction; covers editing, undoing/revalidating, set deletion, and
exercise deletion.

### Write after completion

**Risk observed in code or reproduced:** A new set arriving after completion could
change volume without applying new progression.

**Fix and verification:** Reject writes to completed or skipped workouts; the finish
button also waits for ongoing set saves.

### Stale weekly review

**Risk observed in code or reproduced:** A weekly review could describe deleted
workouts or performances.

**Fix and verification:** Invalidate after history edits, deletion, and reset.
An already triggered deload week remains preserved as a precaution; deleting history
must not automatically accelerate recovery.

### Local week boundary

**Risk observed in code or reproduced:** Local Monday could still be treated as UTC Sunday.

**Fix and verification:** Review boundaries and workout membership calculated by local
date. Exit a deload week after seven local calendar days.

### Workout validation

**Risk observed in code or reproduced:** Workout routes accepted some impossible dates
and incorrectly typed values.

**Fix and verification:** Validate before writing: creation, scheduled date, name, and notes.

### Inconsistent import

**Risk observed in code or reproduced:** An import could introduce inconsistent
measurements/sets or multiple active programs/workouts.

**Fix and verification:** Reject impossible dates, negative weights, fractional
repetitions, invalid effort values, and incompatible active states before import.
Reference errors retain the existing rollback.

### Lost completion response

**Risk observed in code or reproduced:** A response lost after completion or abandonment
left the interface on an operation that had already succeeded.

**Fix and verification:** Read saved state to confirm success, then navigate normally.
Test with a real transaction and interruption of its response.

## Added coverage

`tests/integration/reliabilityStress.test.js`:

- Twelve weeks and twenty-four workouts with resumption, volumes, progression, repeated completions, cached reviews, full export/import, workout deletion, then program deletion/recreation.
- Repeated start, set, and finish requests; only one active workout and one progression event.
- Correction, undo/revalidation, and deletion in history, returning to the progress achieved by the latest remaining performance.
- SQLite error injected during recalculation: the set, records, and all exported collections remain identical to their previous state.
- Invalid imports: no changes to existing collections.
- Repeated fatigue, deload without losing achieved progress, and local week boundaries, including the switch to winter time.

### Duration simulation

In the duration simulation, only historical timestamps are prepared in the database and
the review time is injected. Creation, data entry, completion, deletion, import, and
calculations use real routes and services. This test does not represent twelve weeks
of continuous execution.

### Browser journeys

`tests/e2e/sessions.spec.js`, on desktop and mobile: interruption before a write,
interruption after a write, identical or conflicting retry, waiting for a save before
completion, lost completion/abandonment response, and abrupt process termination with
workout and set recovery after restart. Business responses are not mocked.

## Validation and limitations

463 business/API tests and 66 desktop/mobile Playwright journeys passed. A backup was
created before restarting the personal server; the 22 sections of its export were
compared by hash and remained identical. Pre-push hook checks also run the affected
business and browser suites.

### Node execution mode

`npm test` now uses the existing direct Express mode to avoid unstable ephemeral TCP
ports in the development environment. Playwright retains tests over the real HTTP network.

### Uncovered scope

No reproduced defect remains open in this scope. These results do not demonstrate the
absence of all bugs: Safari/Firefox, physical devices, power loss during a disk write,
faulty storage, offline service worker caching, and multi-user load are not covered.
The tested abrupt termination occurs after write confirmation.

Historical duplicates from old exports are not merged automatically; the protection
prevents new duplicates.
