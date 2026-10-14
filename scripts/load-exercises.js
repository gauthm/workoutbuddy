// Charge le catalogue de la DB courante (INSERT OR IGNORE, idempotent, ne touche pas aux exos customs)
// Usage: node scripts/load-exercises.js
// DB surchargeable via DB_PATH, comme le serveur

import { getDb, getDbPath } from '../src/db/database.js'
import { migrate } from '../src/db/migrate.js'
import { readSeedCatalog, insertExercises, syncExerciseTranslations } from '../src/seed/seed.js'

const exercises = readSeedCatalog()
if (exercises.length === 0) {
  console.error('Catalogue vide — lancer d\'abord : node scripts/import-exercises.js <path-to-free-exercise-db>')
  process.exit(1)
}

const db = getDb()
migrate(db)
const before = db.prepare('SELECT COUNT(*) as n FROM exercise').get().n
const { inserted } = insertExercises(db, exercises)
const translated = syncExerciseTranslations(db, exercises)
const after = db.prepare('SELECT COUNT(*) as n FROM exercise').get().n

console.log(`DB      : ${getDbPath()}`)
console.log(`Source  : ${exercises.length} exercices du catalogue`)
console.log(`Insérés : ${inserted} — ignorés (déjà présents) : ${exercises.length - inserted}`)
console.log(`Total   : ${before} -> ${after}`)
console.log(`Traductions actualisées : ${translated}`)

db.close()
