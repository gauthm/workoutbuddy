import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { migrate } from '../../src/db/migrate.js'
import { seedExercises } from '../../src/seed/seed.js'
import { generateProgram } from '../../src/services/programGenerator.js'
import { findRotationCandidates } from '../../src/services/rotationEngine.js'

function createDb() {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  migrate(db)
  seedExercises(db)  // load the ~800 real exercises
  return db
}

function getRandomExercise(db, filters = '') {
  return db.prepare(
    `SELECT * FROM exercise WHERE is_custom=0 ${filters} LIMIT 1`
  ).get()
}

function parseEx(ex) {
  return {
    ...ex,
    primary_muscles:    JSON.parse(ex.primary_muscles    || '[]'),
    secondary_muscles:  JSON.parse(ex.secondary_muscles  || '[]'),
    equipment_required: JSON.parse(ex.equipment_required || '[]'),
    is_excluded:        ex.is_excluded === 1,
  }
}

describe('Exercise exclusion — unit tests', () => {

  it('an excluded exercise does not appear in program generation', () => {
    const db = createDb()

    // Fetch a barbell chest exercise and exclude it
    const target = db.prepare(`
      SELECT id FROM exercise
      WHERE primary_muscles LIKE '%"chest"%' AND equipment_required LIKE '%"barbell"%'
      AND is_custom = 0 LIMIT 1
    `).get()
    if (!target) return // skip if no barbell chest exercise exists in the DB

    db.prepare('UPDATE exercise SET is_excluded = 1 WHERE id = ?').run(target.id)

    const allRaw = db.prepare('SELECT * FROM exercise').all()
    const all    = allRaw.map(parseEx)
    const equip  = [
      { category: 'barbell', weight_kg: 20, count: 1 },
      { category: 'bench',   name: 'Bench', count: 1 },
      { category: 'plate',   weight_kg: 5, count: 4 },
    ]

    const draft = generateProgram(
      { goal: 'hypertrophy', level: 'intermediate', days_per_week: 3,
        priority_muscles: [], name: 'Test' },
      all, equip
    )

    const allIds = draft.templates.flatMap(t => t.exercises.map(e => e.exercise_id))
    assert.ok(
      !allIds.includes(target.id),
      `Excluded exercise "${target.id}" must not appear in the program`
    )
  })

  it('an excluded exercise is not a rotation candidate', () => {
    const db = createDb()

    // Use a push_horizontal exercise as the base
    const base = db.prepare(
      "SELECT * FROM exercise WHERE movement_pattern='push_horizontal' AND is_custom=0 LIMIT 1"
    ).get()
    if (!base) return

    const parsedBase = parseEx(base)

    // Exclude all other push_horizontal exercises
    db.prepare(`
      UPDATE exercise SET is_excluded = 1
      WHERE movement_pattern = 'push_horizontal' AND id != ?
    `).run(base.id)

    const allRaw = db.prepare('SELECT * FROM exercise').all()
    const all    = allRaw.map(parseEx)
    const equip  = [
      { category: 'barbell', weight_kg: 20, count: 1 },
      { category: 'dumbbell_fixed', weight_kg: 15, count: 2 },
      { category: 'bench', name: 'Bench', count: 1 },
    ]

    const candidates = findRotationCandidates(parsedBase, all, equip)
    const nonBase    = candidates.filter(c => c.id !== base.id)

    assert.ok(
      nonBase.every(c => !c.is_excluded),
      'No excluded exercise must appear as a rotation candidate'
    )
  })

  it('re-enabling an exercise returns it to selection', () => {
    const db  = createDb()
    const ex  = getRandomExercise(db)
    assert.ok(ex, 'Doit avoir au moins un exercice en DB')

    db.prepare('UPDATE exercise SET is_excluded = 1 WHERE id = ?').run(ex.id)
    let row = db.prepare('SELECT is_excluded FROM exercise WHERE id = ?').get(ex.id)
    assert.equal(row.is_excluded, 1)

    db.prepare('UPDATE exercise SET is_excluded = 0, exclusion_reason = NULL WHERE id = ?').run(ex.id)
    row = db.prepare('SELECT is_excluded FROM exercise WHERE id = ?').get(ex.id)
    assert.equal(row.is_excluded, 0)
  })

  it('all exercises default to is_excluded = 0', () => {
    const db = createDb()
    const excluded = db.prepare(
      'SELECT COUNT(*) as n FROM exercise WHERE is_excluded = 1'
    ).get()
    assert.equal(excluded.n, 0, 'No exercise must be excluded by default')
  })
})
