# Programs and calendar

[Documentation home](INDEX.md) · [README](../README.md)

- [Create a program](#create-a-program)
- [Distribute muscle priorities](#distribute-muscle-priorities)
- [Personal measurements](#personal-measurements)
- [Activation and training week](#activation-and-training-week)
- [Home screen layout](#home-screen-layout)
- [Select days and sessions](#select-days-and-sessions)
- [Duration and extension](#duration-and-extension)
- [Editable settings](#editable-settings)

## Create a program

Creation follows a questionnaire with predefined choices: goal, experience level, training days,
session duration, total duration, muscle priorities, and personal measurements. Muscle priorities
are grouped into upper and lower body, with support for selecting an entire group or multiple
muscles without a two-muscle limit.

The engine aims to use the selected session time with suitable additional sets and exercises,
without exceeding that time or its volume limits; a warning explains shorter sessions. Goals have
explanations, and a preview lets you review sessions before creating the program.

## Distribute muscle priorities

A focus preserves basic work for the other part of the body. With two or three days, sessions
first reserve a push or pull and leg work, alternating across the week; remaining time goes to
priorities, distributed between sessions according to the direct work already planned. Four- to
six-day formats keep their upper/lower or push/pull/legs sessions.

Duration, frequency, rest periods, equipment, pain, and exclusions remain respected. Yellow messages
distinguish limited direct work, indirect work, and the absence of compatible exercises, and suggest
fewer priorities or longer sessions rather than adding days. Indirect work is counted separately
and is not presented as a direct focus.

Distribution guidelines are planning heuristics, not a guarantee of optimal volume for everyone.

## Personal measurements

Body weight entered during creation is added to body-weight tracking on the current local date.
An existing measurement for that day is preserved, with a warning if its value differs. Reference
weight and height remain stored in program settings independently of tracking: deleting a
measurement neither removes them nor recreates it on restart or import.

They are no longer displayed on the program details page. These changes apply to newly created
programs; existing programs retain their exercises and data.

## Activation and training week

Only one program is active at a time; a reminder appears in the list and on each details page.
Activation schedules sessions on the selected days. The home calendar shows sessions actually
completed or in progress, including those outside a program, and planned or skipped sessions from
the active program only.

When the number of sessions completed from Monday through Sunday reaches the program's planned
number, the home screen and program details indicate that all sessions for the week are complete.

## Home screen layout

The home screen and program details title use the exact goal label selected in the form, in the
interface language, and the home screen shows weekly frequency. The active program and today's
sessions areas are slightly larger to balance the calendar. Programs and History buttons appear
below the program, outside the header.

The “Active program” label is hidden on the home screen, the program and its shortcuts have no
separator, and the legend has more spacing without a border above it. The day panel uses the same
thin neutral border as the header. The calendar fills the remaining space and adapts to iPhone
safe areas; day information appears alongside it in landscape.

On short screens, the page scrolls to keep text and buttons readable.

## Select days and sessions

When several sessions share a date, arrows let you browse them one at a time, with a counter.
The session in progress appears first, followed by planned sessions; all actions remain available.
On the home screen, a day always remains selected: tapping the same cell again preserves the day
panel and displayed session.

Changing months selects the first day; returning to the current month selects today. Selection is
also preserved after rescheduling or marking a session as skipped. The separate calendar keeps
its full list.

## Duration and extension

Total duration can be limited or unlimited. A limited duration starts at first activation;
reactivation preserves that starting point. At the end, new sessions are blocked and history
remains accessible. Extending the program resumes scheduling.

## Editable settings

The program details page allows editing two settings: total duration and training days, while
preserving the original number of days. Experience level, goal, and session duration remain those
of the created program.
