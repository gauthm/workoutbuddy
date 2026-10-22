# Sessions and progression

[Documentation home](INDEX.md) · [README](../README.md)

- [Scheduling and skipped sessions](#scheduling-and-skipped-sessions)
- [Log and resume a session](#log-and-resume-a-session)
- [Finish, abandon, or reset](#finish-abandon-or-reset)
- [Exercise help](#exercise-help)
- [Compare performance](#compare-performance)
- [Progression calculation](#progression-calculation)
- [Starting and adjusting loads](#starting-and-adjusting-loads)
- [Programming guidelines](#programming-guidelines)
- [Equipment and variation selection](#equipment-and-variation-selection)
- [History and retained progress](#history-and-retained-progress)
- [Repeated requests and network interruptions](#repeated-requests-and-network-interruptions)
- [Statistics](#statistics)

## Scheduling and skipped sessions

A session can start on a different day from the planned date. It then appears on its actual start
day; its original planned date remains stored, without recreating a session on that date or moving
other sessions. Resuming a session in progress preserves its start day.

A session marked “Skipped” can be returned to planned status from the calendar, then started or
moved; it retains its date and data.

## Log and resume a session

During a session, enter the load and repetitions for the proposed sets, then confirm them. A set
confirmed by mistake can be undone. Leaving a session without finishing keeps it in progress and
preserves confirmed sets. Unconfirmed input may be lost on reload. The Session tab lets you resume;
another session cannot start while the first remains in progress.

The timer measures time since the start, including while the app is closed, and progression waits
until the session ends. The Warm-up button displays instructions without adding a set to the program.

## Finish, abandon, or reset

The Finish button offers **Continue session**, **Quit without saving**, and **Finish and save**.
Quitting without saving deletes sets from this attempt and returns the same session to planned
status on its original planned date. Finishing saves confirmed sets and updates progression.

From a completed session's history details, **Reset session** deletes its results and returns it
to planned status; records and retained progress are recalculated from remaining sessions.
Confirmation and a backup precede the reset. Old set-entry requests are rejected to prevent sets
from reappearing after a reset.

## Exercise help

Exercise help during a session separates numbered instructions, the load to enter, advice for
finding a starting load, and the RM table when available. Advice encourages starting light,
keeping 2–3 repetitions in reserve, and adjusting in small increments; without equipment, start
without added weight and choose an easier variation if needed.

## Compare performance

The most recent session for the same exercise appears in a separate table. A 10RM column compares
performance using the selected formula; formulas are explained in advanced settings.

## Progression calculation

Progression uses actual recorded performance. It adjusts load and repetition targets while
maintaining continuity between exercises; reviews may suggest a lighter week. The AI Coach does
not decide these changes. Finishing a session and saving progress form a single transaction: if
calculation fails, the session remains in progress and can be finished again.

## Starting and adjusting loads

For beginners, the engine limits each exercise to three sets and uses double progression,
including for strength goals, with an initial range of 8–12 repetitions. Dumbbell weights are
expressed per dumbbell. Instructions repeat this on the details page and in session help
(2 dumbbells of 10 kg → enter 10 kg). Starting-load calculation distinguishes a two-dumbbell
movement from a one-arm movement.

Automatic increases remain limited to 10% of the load or 1 kg for small loads; if equipment
requires a larger jump, the load stays unchanged. A set taken to failure (RPE ≥ 9.5 or RIR = 0)
blocks another immediate increase. Targets adapt to current equipment without erasing past performance.

## Programming guidelines

These rules are programming choices informed by [ACSM
2026](https://pmc.ncbi.nlm.nih.gov/articles/PMC12965823/) recommendations: progressive training of
major muscle groups, appropriate volume, and no requirement to train to failure. They do not
provide individual validation of starting loads.

## Equipment and variation selection

During creation, the engine favors exercises using available equipment and distributes variations
across sessions, such as flat presses in A and incline presses in B with an adjustable bench.
Selection includes dumbbell squats and deadlifts, floor presses, and kettlebell rows.

Equipment requirements remain specific to each catalog movement: a dumbbell does not automatically
replace a kettlebell. Body-weight exercises remain possible when appropriate or when equipment is
unavailable. Time estimation counts both sides of unilateral exercises.

A load manually added to a body-weight exercise is saved; the engine does not yet automatically
suggest optional added weight.

## History and retained progress

Exercise progress is retained independently of the program: deleting a program and creating
another allows progression to resume for previously practiced movements. Editing, undoing, or
deleting a historical set, removing its exercise, or deleting its session recalculates retained
progress from remaining history and invalidates the relevant weekly review. Weeks follow the
local calendar.

A deleted session's slot remains marked as deleted to prevent automatic scheduling from recreating
it, including an old test session completed on a future date. For older sessions without saved
calculation context, recovery conservatively uses their actual performance.

## Repeated requests and network interruptions

An already saved set can be submitted again identically without duplication; resubmission with
different values is rejected to avoid silent overwrites. Finishing a session waits for pending
saves. If the network response to finishing or cancellation is lost, the interface checks the
actual saved state before continuing.

## Statistics

The home screen provides access to history. Statistics show volume, progression, records, and
body-weight tracking.
