import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { migrate } from '../../src/db/migrate.js'
import { seedExercises } from '../../src/seed/seed.js'
import { readSeedCatalog, syncExerciseTranslations, translationSource } from '../../src/seed/seed.js'
import { readFileSync } from 'node:fs'

function createDb() {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  migrate(db)
  return db
}

describe('T1.3 — Seed', () => {
  it('inserts exercises when table is empty', () => {
    const db = createDb()
    seedExercises(db)
    const count = db.prepare('SELECT COUNT(*) as n FROM exercise').get().n
    assert.ok(count >= 5, `Attendu ≥ 5, obtenu ${count}`)
  })

  it('is idempotent: reseeding creates no duplicates', () => {
    const db = createDb()
    seedExercises(db)
    seedExercises(db)
    const count = db.prepare('SELECT COUNT(*) as n FROM exercise').get().n
    assert.ok(count >= 5)
    // No duplicates
    const distinct = db.prepare('SELECT COUNT(DISTINCT id) as n FROM exercise').get().n
    assert.equal(count, distinct)
  })

  it('primary_muscles is valid JSON', () => {
    const db = createDb()
    seedExercises(db)
    const row = db.prepare("SELECT primary_muscles FROM exercise WHERE id = 'barbell_bench_press_medium_grip'").get()
    assert.ok(row, 'barbell_bench_press_medium_grip doit exister')
    const muscles = JSON.parse(row.primary_muscles)
    assert.ok(Array.isArray(muscles))
    assert.ok(muscles.includes('chest'))
  })

  it('basic compound movements are present', () => {
    const db = createDb()
    seedExercises(db)
    const ids = [
      'barbell_bench_press_medium_grip', 'barbell_squat', 'barbell_deadlift',
      'pullups', 'barbell_shoulder_press'
    ]
    for (const id of ids) {
      const row = db.prepare('SELECT id FROM exercise WHERE id = ?').get(id)
      assert.ok(row, `Missing exercise: ${id}`)
    }
  })
})

describe('French catalog and English source preservation', () => {
  const source = JSON.parse(readFileSync(new URL('../../src/seed/exercises.json', import.meta.url), 'utf8'))
  const fr = JSON.parse(readFileSync(new URL('../../src/seed/exercises.fr.json', import.meta.url), 'utf8'))
  it('covers every exercise and step without altering English or technical data', () => {
    const catalogue = readSeedCatalog()
    assert.deepEqual(Object.keys(fr).sort(), source.map(ex => ex.id).sort())
    for (let i = 0; i < source.length; i++) {
      const original = source[i], translated = catalogue[i]
      assert.equal(fr[original.id].source, translationSource(original), original.id)
      assert.ok(translated.name_fr.trim(), original.id)
      assert.equal(translated.instructions_fr.length, original.instructions_en.length, original.id)
      assert.ok(translated.instructions_fr.every((s, index) => typeof s === 'string' && (s.trim() || !original.instructions_en[index].trim())), original.id)
      if (original.instructions_en.length) assert.notDeepEqual(translated.instructions_fr, original.instructions_en, original.id)
      const { name_fr, instructions_fr, ...unchanged } = translated
      const { name_fr: oldName, instructions_fr: oldSteps, ...expected } = original
      assert.deepEqual(unchanged, expected, original.id)
    }
    assert.equal(catalogue.find(ex => ex.id === 'hammer_curls').name_fr, 'Curl marteau')
    assert.equal(catalogue.find(ex => ex.id === 'dumbbell_bench_press').name_fr, 'Développé couché avec haltères')
  })

  it('updates an old database without losing exclusions, sets or progression; second pass without writes', () => {
    const db = createDb()
    try {
      seedExercises(db)
      const id = 'dumbbell_bench_press'
      db.prepare('UPDATE exercise SET name_fr=name_en, instructions_fr=instructions_en, is_excluded=1, exclusion_reason=? WHERE id=?').run('Choix personnel', id)
      const sessionId = db.prepare("INSERT INTO session (name,scheduled_date,status) VALUES ('Archive','2026-01-01','completed')").run().lastInsertRowid
      const seId = db.prepare('INSERT INTO session_exercise (session_id,exercise_id) VALUES (?,?)').run(sessionId,id).lastInsertRowid
      db.prepare('INSERT INTO set_log (session_exercise_id,set_number,weight_kg,reps,is_completed) VALUES (?,1,16,10,1)').run(seId)
      db.prepare('INSERT INTO exercise_progression (exercise_id,current_weight_kg,current_target_reps,last_session_id) VALUES (?,18,8,?)').run(id,sessionId)
      const snapshot = () => ['session','session_exercise','set_log','exercise_progression'].map(table => db.prepare(`SELECT * FROM ${table}`).all())
      const before = snapshot(), english = db.prepare('SELECT name_en,instructions_en,equipment_required FROM exercise WHERE id=?').get(id)
      assert.equal(syncExerciseTranslations(db), 1)
      const row = db.prepare('SELECT * FROM exercise WHERE id=?').get(id)
      assert.equal(row.name_fr, 'Développé couché avec haltères')
      assert.equal(row.is_excluded, 1)
      assert.equal(row.exclusion_reason, 'Choix personnel')
      assert.deepEqual(db.prepare('SELECT name_en,instructions_en,equipment_required FROM exercise WHERE id=?').get(id), english)
      assert.deepEqual(snapshot(), before)
      assert.equal(syncExerciseTranslations(db), 0)
      assert.deepEqual(db.pragma('foreign_key_check'), [])
    } finally { db.close() }
  })

  it('does not replace instructions when the English source has changed', () => {
    const db = createDb()
    try {
      seedExercises(db)
      db.prepare("UPDATE exercise SET name_en='New source',name_fr='Traduction à revoir' WHERE id='dumbbell_bench_press'").run()
      assert.equal(syncExerciseTranslations(db), 0)
      assert.equal(db.prepare("SELECT name_fr FROM exercise WHERE id='dumbbell_bench_press'").get().name_fr, 'Traduction à revoir')
    } finally { db.close() }
  })
})
