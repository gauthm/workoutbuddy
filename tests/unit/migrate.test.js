import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { migrate } from '../../src/db/migrate.js'

function createMemoryDb() {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  return db
}

describe('T1.2 — Migrations', () => {
  it('applique les 3 migrations sur une DB vierge', () => {
    const db = createMemoryDb()
    migrate(db)
    const versions = db.prepare('SELECT version FROM schema_version ORDER BY version').all()
    assert.deepEqual(versions.map(r => r.version), [1, 2, 4])
  })

  it('est idempotent — re-exécuter migrate() ne génère pas d\'erreur', () => {
    const db = createMemoryDb()
    migrate(db)
    assert.doesNotThrow(() => migrate(db))
  })

  it('crée la table exercise', () => {
    const db = createMemoryDb()
    migrate(db)
    const row = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='exercise'"
    ).get()
    assert.ok(row)
  })

  it('insère les settings par défaut', () => {
    const db = createMemoryDb()
    migrate(db)
    const row = db.prepare("SELECT value FROM settings WHERE key='unit'").get()
    assert.equal(JSON.parse(row.value), 'kg')
  })

  it('active les foreign keys', () => {
    const db = createMemoryDb()
    db.pragma('foreign_keys = ON')
    migrate(db)
    // Tenter d'insérer une session_exercise avec session_id invalide doit échouer
    migrate(db)
    assert.throws(() => {
      db.prepare(
        "INSERT INTO session_exercise (session_id, exercise_id) VALUES (9999, 'x')"
      ).run()
    })
  })
})
