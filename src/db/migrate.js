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
      console.log(`Migration ${file.slice(0, 3)} already applied`)
      continue
    }
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8')
    // SQLite requires foreign keys disabled outside the transaction when rebuilding
    // a referenced table; otherwise DROP TABLE can cascade into workout history.
    const rebuild = sql.startsWith('-- foreign-keys: off\n')
    const foreignKeys = db.pragma('foreign_keys', { simple:true })
    if (rebuild) db.pragma('foreign_keys = OFF')
    try {
      db.transaction(() => {
        db.exec(sql)
        if (rebuild && db.pragma('foreign_key_check').length) {
          throw new Error(`Foreign key violation in migration ${file}`)
        }
        db.prepare('INSERT INTO schema_version (version) VALUES (?)').run(version)
      })()
    } finally {
      if (rebuild) db.pragma(`foreign_keys = ${foreignKeys ? 'ON' : 'OFF'}`)
    }
    console.log(`Migration ${file.slice(0, 3)} applied`)
  }
}
