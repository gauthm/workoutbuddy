import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const MIGRATIONS_DIR = path.join(__dirname, 'migrations')

export function migrate(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)

  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()

  for (const file of files) {
    const version = parseInt(file.slice(0, 3), 10)
    const existing = db.prepare('SELECT version FROM schema_version WHERE version = ?').get(version)
    if (existing) {
      console.log(`Migration ${file.slice(0, 3)} déjà appliquée`)
      continue
    }
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8')
    db.transaction(() => {
      db.exec(sql)
      db.prepare('INSERT INTO schema_version (version) VALUES (?)').run(version)
    })()
    console.log(`Migration ${file.slice(0, 3)} appliquée`)
  }
}
