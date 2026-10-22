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
  it('applies all 17 migrations to a fresh DB', () => {
    const db = createMemoryDb()
    migrate(db)
    const versions = db.prepare('SELECT version FROM schema_version ORDER BY version').all()
    assert.deepEqual(versions.map(r => r.version), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17])
  })

  it('is idempotent — rerunning migrate() raises no error', () => {
    const db = createMemoryDb()
    migrate(db)
    assert.doesNotThrow(() => migrate(db))
  })

  it('creates the exercise table', () => {
    const db = createMemoryDb()
    migrate(db)
    const row = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='exercise'"
    ).get()
    assert.ok(row)
  })

  it('inserts default settings', () => {
    const db = createMemoryDb()
    migrate(db)
    const row = db.prepare("SELECT value FROM settings WHERE key='unit'").get()
    assert.equal(JSON.parse(row.value), 'kg')
  })

  it('enables foreign keys', () => {
    const db = createMemoryDb()
    db.pragma('foreign_keys = ON')
    migrate(db)
    // Inserting a session_exercise with an invalid session_id must fail
    migrate(db)
    assert.throws(() => {
      db.prepare(
        "INSERT INTO session_exercise (session_id, exercise_id) VALUES (9999, 'x')"
      ).run()
    })
  })
})
