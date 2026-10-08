// Seed des exercices — src/seed/exercises.json (issu de scripts/import-exercises.js)
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export function readSeedCatalog() {
  const filePath = path.join(__dirname, 'exercises.json')
  if (!fs.existsSync(filePath)) {
    console.warn('[seed] src/seed/exercises.json manquant.')
    console.warn('[seed] Lancer : node scripts/import-exercises.js <path-to-free-exercise-db>')
    return []
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } catch (err) {
    console.error('[seed] Erreur lecture exercises.json :', err.message)
    return []
  }
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

// Seed au démarrage : seulement si la table exercise est vide
export function seedExercises(db) {
  const count = db.prepare('SELECT COUNT(*) as n FROM exercise').get().n
  if (count > 0) {
    console.log(`Exercices déjà présents (${count}), seed ignoré.`)
    return
  }

  const exercises = readSeedCatalog()
  if (exercises.length === 0) {
    console.warn('[seed] Aucun fichier seed trouvé.')
    console.warn('[seed] Lancer : node scripts/import-exercises.js <path-to-free-exercise-db>')
    return
  }

  const { inserted } = insertExercises(db, exercises)
  console.log(`[seed] ${inserted}/${exercises.length} exercices importés.`)
}
