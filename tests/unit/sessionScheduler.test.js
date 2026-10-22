import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { migrate } from '../../src/db/migrate.js'
import { seedExercises } from '../../src/seed/seed.js'
import { scheduleWeeks } from '../../src/services/sessionScheduler.js'

function createDb() {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  migrate(db)
  seedExercises(db)
  return db
}

function createActiveProgram(db, daysPerWeek = 3) {
  const pRes = db.prepare(`
    INSERT INTO program (name, goal, level, days_per_week, progression_model, is_active)
    VALUES ('Test PPL', 'hypertrophy', 'intermediate', ?, 'double_progression', 1)
  `).run(daysPerWeek)
  const pid = pRes.lastInsertRowid

  const names = ['Push', 'Pull', 'Legs', 'Upper', 'Lower']
  for (let i = 0; i < daysPerWeek; i++) {
    db.prepare('INSERT INTO workout_template (program_id, name, order_index) VALUES (?,?,?)')
      .run(pid, names[i] || `Jour ${i+1}`, i)
  }
  return pid
}

describe('sessionScheduler', () => {
  it('no active program → returns 0', () => {
    const db = createDb()
    assert.equal(scheduleWeeks(db), 0)
  })

  it('creates workouts for 2 weeks', () => {
    const db  = createDb()
    const pid = createActiveProgram(db, 3)
    const n   = scheduleWeeks(db, pid)
    assert.ok(n >= 1 && n <= 6, `Attendu 1-6, obtenu ${n}`)
  })

  it('idempotent: second call creates nothing', () => {
    const db  = createDb()
    const pid = createActiveProgram(db, 3)
    scheduleWeeks(db, pid)
    const n2 = scheduleWeeks(db, pid)
    assert.equal(n2, 0, 'The second call must create no workout')
  })

  it('all created workouts have status=planned', () => {
    const db  = createDb()
    const pid = createActiveProgram(db, 3)
    scheduleWeeks(db, pid)
    const notPlanned = db.prepare(
      "SELECT COUNT(*) as n FROM session WHERE program_id = ? AND status != 'planned'"
    ).get(pid)
    assert.equal(notPlanned.n, 0)
  })

  it('created dates are >= today', () => {
    const db    = createDb()
    const pid   = createActiveProgram(db, 3)
    scheduleWeeks(db, pid)
    const today = new Date().toISOString().slice(0, 10)
    const pastSessions = db.prepare(
      'SELECT COUNT(*) as n FROM session WHERE program_id = ? AND scheduled_date < ?'
    ).get(pid, today)
    assert.equal(pastSessions.n, 0)
  })

  it('templates alternate in order', () => {
    const db  = createDb()
    const pid = createActiveProgram(db, 3)
    scheduleWeeks(db, pid)
    const sessions = db.prepare(
      'SELECT name FROM session WHERE program_id = ? ORDER BY scheduled_date ASC'
    ).all(pid)
    const names = sessions.slice(0, 3).map(s => s.name)
    assert.deepEqual(names, ['Push', 'Pull', 'Legs'])
  })

  it('4-day/week program creates up to 8 workouts over 2 weeks', () => {
    const db  = createDb()
    const pid = createActiveProgram(db, 4)
    const n   = scheduleWeeks(db, pid)
    assert.ok(n >= 1 && n <= 8, `Attendu 1-8, obtenu ${n}`)
  })
})
