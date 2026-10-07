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
    const row = db.prepare("SELECT primary_muscles FROM exercise WHERE id = 'bench_press_barbell'").get()
    assert.ok(row, 'bench_press_barbell doit exister')
    const muscles = JSON.parse(row.primary_muscles)
    assert.ok(Array.isArray(muscles))
    assert.ok(muscles.includes('chest'))
  })

  it('les 5 exercices de référence sont présents', () => {
    const db = createDb()
    seedExercises(db)
    const ids = [
      'bench_press_barbell', 'squat_barbell', 'deadlift_barbell',
      'pullup_bodyweight', 'overhead_press_barbell'
    ]
    for (const id of ids) {
      const row = db.prepare('SELECT id FROM exercise WHERE id = ?').get(id)
      assert.ok(row, `Exercice manquant : ${id}`)
    }
  })
})
