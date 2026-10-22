// Exercise seed — src/seed/exercises.json (from scripts/import-exercises.js)
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createHash } from 'node:crypto'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function readFrenchTranslations() {
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, 'exercises.fr.json'), 'utf8'))
  } catch (err) {
    console.warn('[seed] French catalog unavailable:', err.message)
    return {}
  }
}

export function translationSource(exercise) {
  return createHash('sha256').update(JSON.stringify([exercise.name_en, exercise.instructions_en])).digest('hex')
}

export function readSeedCatalog() {
  const filePath = path.join(__dirname, 'exercises.json')
  if (!fs.existsSync(filePath)) {
    console.warn('[seed] src/seed/exercises.json missing.')
    console.warn('[seed] Run: node scripts/import-exercises.js <path-to-free-exercise-db>')
    return []
  }
  try {
    const exercises = JSON.parse(fs.readFileSync(filePath, 'utf8'))
    const translations = readFrenchTranslations()
    return exercises.map(ex => {
      const fr = translations[ex.id]
      // A source update must not reuse an outdated translation.
      if (!fr || fr.source !== translationSource(ex)) return ex
      return { ...ex, name_fr: fr.name, instructions_fr: fr.instructions }
    })
  } catch (err) {
    console.error('[seed] Failed to read exercises.json:', err.message)
    return []
  }
}

// Reference data only: identifiers, English text and user fields remain unchanged.
export function syncExerciseTranslations(db, exercises = readSeedCatalog()) {
  const translations = readFrenchTranslations()
  const update = db.prepare(`UPDATE exercise SET name_fr = @name_fr, instructions_fr = @instructions_fr
    WHERE id = @id AND is_custom = 0 AND name_en = @name_en AND instructions_en = @instructions_en
    AND (name_fr <> @name_fr OR instructions_fr <> @instructions_fr)`)
  return db.transaction(() => {
    let updated = 0
    for (const ex of exercises) {
      if (translations[ex.id]?.source !== translationSource(ex)) continue
      updated += update.run({
        id: ex.id, name_fr: ex.name_fr, name_en: ex.name_en,
        instructions_fr: JSON.stringify(ex.instructions_fr), instructions_en: JSON.stringify(ex.instructions_en),
      }).changes
    }
    return updated
  })()
}

export function insertExercises(db, exercises) {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO exercise
      (id, name_fr, name_en, category, force, mechanic, movement_pattern,
       primary_muscles, secondary_muscles, equipment_required,
       instructions_fr, instructions_en, image_paths, is_custom, is_unilateral)
    VALUES
      (@id, @name_fr, @name_en, @category, @force, @mechanic, @movement_pattern,
       @primary_muscles, @secondary_muscles, @equipment_required,
       @instructions_fr, @instructions_en, @image_paths, 0, @is_unilateral)
  `)

  const insert = db.transaction((list) => {
    let inserted = 0
    for (const ex of list) {
      const r = stmt.run({
        id:                 ex.id,
        name_fr:            ex.name_fr,
        name_en:            ex.name_en,
        category:           ex.category,
        force:              ex.force ?? null,
        mechanic:           ex.mechanic ?? null,
        movement_pattern:   ex.movement_pattern,
        primary_muscles:    JSON.stringify(ex.primary_muscles ?? []),
        secondary_muscles:  JSON.stringify(ex.secondary_muscles ?? []),
        equipment_required: JSON.stringify(ex.equipment_required ?? []),
        instructions_fr:    JSON.stringify(ex.instructions_fr ?? []),
        instructions_en:    JSON.stringify(ex.instructions_en ?? []),
        image_paths:        JSON.stringify(ex.image_paths ?? []),
        is_unilateral:      ex.is_unilateral ?? 0,
      })
      inserted += r.changes
    }
    return inserted
  })

  return { source: exercises.length, inserted: insert(exercises) }
}

// Insert on first startup, then synchronize only catalog translations.
export function seedExercises(db) {
  const count = db.prepare('SELECT COUNT(*) as n FROM exercise').get().n
  if (count > 0) {
    const updated = syncExerciseTranslations(db)
    console.log(`[seed] ${count} exercises present, ${updated} translations updated.`)
    return
  }

  const exercises = readSeedCatalog()
  if (exercises.length === 0) {
    console.warn('[seed] No seed file found.')
    console.warn('[seed] Run: node scripts/import-exercises.js <path-to-free-exercise-db>')
    return
  }

  const { inserted } = insertExercises(db, exercises)
  console.log(`[seed] ${inserted}/${exercises.length} exercises imported.`)
}
