# Exercises and equipment

[Documentation home](INDEX.md) · [README](../README.md)

- [Catalog and compatibility](#catalog-and-compatibility)
- [Languages and search](#languages-and-search)
- [Translation maintenance](#translation-maintenance)
- [Navigation and demonstrations](#navigation-and-demonstrations)
- [Inventory](#inventory)
- [Pain and exclusions](#pain-and-exclusions)
- [Replace an exercise](#replace-an-exercise)

## Catalog and compatibility

The interface and engine use only the catalog imported from free-exercise-db. Adding and editing
custom exercises is blocked by the API. Old “Curl marteau” duplicates are linked to Hammer Curls,
preserving sessions, sets, exclusions, and the most recent progression.

## Languages and search

All 876 exercises have French and English names and instructions, according to the language
selected in Settings. French names retain familiar terms such as curl, rowing, dips, and
kettlebell. Search covers both languages and ignores accents and case. Identifiers stay unchanged:
switching languages preserves history and progression.

## Translation maintenance

The source catalog remains in `src/seed/exercises.json`; static translations are in
`src/seed/exercises.fr.json`. Names were written in French; instructions were translated with local
assistance, with review of the generator's 71 exercise entries and technical vocabulary fixes.
No additional translator or model is needed to use the app.

At startup and with `npm run load:exercises`, only French fields of existing exercises are updated.
Each entry's fingerprint checks its match with the English source: after reimporting changed
English names or instructions, also update the translation and its fingerprint (`translationSource`
in `seed.js`). Tests verify catalog coverage.

## Navigation and demonstrations

The **Exercises and Equipment** page has three tabs: Exercises, Pain, and Equipment. Search and
filters let you select a muscle, movement, equipment family, or exercises possible with the
inventory. The Exercises tab counter shows movements remaining after filters, pain, and exclusions;
exclusions are indicated separately. The tabs, search and Filters button stay pinned below the
page title while scrolling. Filters expand over the exercise list without moving it, remain
available during scrolling, and collapse using the same button. On short screens, the panel
scrolls internally.

Opening an exercise and returning preserves filters and scroll position. Two photos alternate
automatically to show movement positions, both in the details page and in session help. A button
pauses or resumes playback; images load only once and animation stops off-screen, when the tab is
hidden, or when closed.

The reduced-motion preference is respected.

## Inventory

Inventory groups equipment into families without distinguishing home from gym. It supports:

- Fixed dumbbells: quantity and weight per dumbbell.
- Plate-loaded dumbbells: number and weight of handles, quantity and weight of plates.
- Kettlebells: quantity and weight.
- Resistance bands: quantity and resistance range.
- Other equipment: checkboxes, with a category for custom equipment.

Weight and resistance rows can be added. Equipment changes remain drafts: a floating “Unsaved
changes” bar lets you save everything or cancel. Cross buttons remove draft rows; checkboxes and
custom additions use the same grouped save. Suggested loads account for equipment and quantities
required by the movement.

Resistance-band resistance remains approximate.

## Pain and exclusions

Pain areas are saved and filter primary and secondary muscles during program creation and
alternative selection. Already planned sessions remain unchanged.

## Replace an exercise

From program details, an exercise can be replaced with a similar alternative compatible with
equipment and constraints. Replacement is blocked while its template session is in progress.
History retains the movement actually performed.
