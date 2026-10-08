import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { migrate } from '../../src/db/migrate.js'
import { seedExercises } from '../../src/seed/seed.js'

function createDb() {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  migrate(db)
  return db
}

describe('T1.3 — Seed', () => {
  it('insère les exercices si la table est vide', () => {
    const db = createDb()
    seedExercises(db)
    const count = db.prepare('SELECT COUNT(*) as n FROM exercise').get().n
    assert.ok(count >= 5, `Attendu ≥ 5, obtenu ${count}`)
  })

  it('est idempotent : re-seed ne duplique pas', () => {
    const db = createDb()
    seedExercises(db)
    seedExercises(db)
    const count = db.prepare('SELECT COUNT(*) as n FROM exercise').get().n
    assert.ok(count >= 5)
    // Pas de doublon
    const distinct = db.prepare('SELECT COUNT(DISTINCT id) as n FROM exercise').get().n
    assert.equal(count, distinct)
  })

  it('primary_muscles est du JSON valide', () => {
    const db = createDb()
    seedExercises(db)
    const row = db.prepare("SELECT primary_muscles FROM exercise WHERE id = 'barbell_bench_press_medium_grip'").get()
    assert.ok(row, 'barbell_bench_press_medium_grip doit exister')
    const muscles = JSON.parse(row.primary_muscles)
    assert.ok(Array.isArray(muscles))
    assert.ok(muscles.includes('chest'))
  })

  it('les mouvements polyarticulaires de base sont présents', () => {
    const db = createDb()
    seedExercises(db)
    const ids = [
      'barbell_bench_press_medium_grip', 'barbell_squat', 'barbell_deadlift',
      'pullups', 'barbell_shoulder_press'
    ]
    for (const id of ids) {
      const row = db.prepare('SELECT id FROM exercise WHERE id = ?').get(id)
      assert.ok(row, `Exercice manquant : ${id}`)
    }
  })
})
