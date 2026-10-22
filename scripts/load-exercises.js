// Load the catalog into the current DB (INSERT OR IGNORE, idempotent, leaves custom exercises untouched)
// Usage: node scripts/load-exercises.js
// DB can be overridden with DB_PATH, like the server

import { getDb, getDbPath } from '../src/db/database.js'
import { migrate } from '../src/db/migrate.js'
import { readSeedCatalog, insertExercises, syncExerciseTranslations } from '../src/seed/seed.js'

const exercises = readSeedCatalog()
if (exercises.length === 0) {
  console.error('Empty catalog — first run: node scripts/import-exercises.js <path-to-free-exercise-db>')
  process.exit(1)
}

const db = getDb()
migrate(db)
const before = db.prepare('SELECT COUNT(*) as n FROM exercise').get().n
const { inserted } = insertExercises(db, exercises)
const translated = syncExerciseTranslations(db, exercises)
const after = db.prepare('SELECT COUNT(*) as n FROM exercise').get().n

console.log(`DB      : ${getDbPath()}`)
console.log(`Source  : ${exercises.length} catalog exercises`)
console.log(`Inserted: ${inserted} — skipped (already present): ${exercises.length - inserted}`)
console.log(`Total   : ${before} -> ${after}`)
console.log(`Translations updated: ${translated}`)

db.close()
