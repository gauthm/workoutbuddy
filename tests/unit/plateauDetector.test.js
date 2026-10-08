import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { migrate } from '../../src/db/migrate.js'
import { seedExercises } from '../../src/seed/seed.js'
import { detectPlateau, detectProgramPlateau } from '../../src/services/plateauDetector.js'

function createDb() {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  migrate(db)
  seedExercises(db)
  return db
}

function insertSession(db, programId, date, weightKg, reps, exerciseId = 'bench_press_barbell') {
  const sRes = db.prepare(
    "INSERT INTO session (name, scheduled_date, program_id, status, completed_at) VALUES (?,?,?,'completed',?)"
  ).run('Test', date, programId, date + 'T10:00:00')

  const seRes = db.prepare(
    'INSERT INTO session_exercise (session_id, exercise_id, order_index) VALUES (?,?,0)'
  ).run(sRes.lastInsertRowid, exerciseId)

  db.prepare(
    'INSERT INTO set_log (session_exercise_id, set_number, weight_kg, reps, is_completed, is_warmup) VALUES (?,1,?,?,1,0)'
  ).run(seRes.lastInsertRowid, weightKg, reps)

  return sRes.lastInsertRowid
}

describe('plateauDetector', () => {
  it('pas assez de données → pas de plateau', () => {
    const db = createDb()
    const pRes = db.prepare(
      "INSERT INTO program (name,goal,level,days_per_week,progression_model) VALUES ('T','strength','beginner',3,'linear')"
    ).run()
    insertSession(db, pRes.lastInsertRowid, '2025-06-01', 80, 5)
    const r = detectPlateau('bench_press_barbell', pRes.lastInsertRowid, 4, db)
    assert.equal(r.is_plateau, false)
    assert.ok(r.sessions_checked < 4)
  })

  it('4 séances même RM → plateau détecté', () => {
    const db = createDb()
    const pRes = db.prepare(
      "INSERT INTO program (name,goal,level,days_per_week,progression_model) VALUES ('T','strength','beginner',3,'linear')"
    ).run()
    const pid = pRes.lastInsertRowid
    insertSession(db, pid, '2025-06-01', 80, 5)
    insertSession(db, pid, '2025-06-08', 80, 5)
    insertSession(db, pid, '2025-06-15', 80, 5)
    insertSession(db, pid, '2025-06-22', 80, 5)
    const r = detectPlateau('bench_press_barbell', pid, 4, db)
    assert.equal(r.is_plateau, true)
    assert.equal(r.sessions_checked, 4)
  })

  it('progression réelle → pas de plateau', () => {
    const db = createDb()
    const pRes = db.prepare(
      "INSERT INTO program (name,goal,level,days_per_week,progression_model) VALUES ('T','strength','beginner',3,'linear')"
    ).run()
    const pid = pRes.lastInsertRowid
    insertSession(db, pid, '2025-06-01', 80, 5)
    insertSession(db, pid, '2025-06-08', 82.5, 5)
    insertSession(db, pid, '2025-06-15', 85, 5)
    insertSession(db, pid, '2025-06-22', 87.5, 5)
    const r = detectPlateau('bench_press_barbell', pid, 4, db)
    assert.equal(r.is_plateau, false)
  })
})
