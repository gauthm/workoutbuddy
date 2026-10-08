import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { migrate } from '../../src/db/migrate.js'
import { calculateStreaks, isoWeek, previousIsoWeek, nextIsoWeek }
  from '../../src/services/streakCalculator.js'

function createDb() {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  migrate(db)
  return db
}

function insertCompletedSession(db, date) {
  db.prepare(`
    INSERT INTO session (name, scheduled_date, status, completed_at)
    VALUES ('Test', ?, 'completed', ?)
  `).run(date, date + 'T10:00:00')
}

describe('isoWeek', () => {
  it('2025-07-07 = W28', () => {
    assert.equal(isoWeek('2025-07-07'), '2025-W28')
  })
  it('2025-01-01 = W01', () => {
    assert.equal(isoWeek('2025-01-01'), '2025-W01')
  })
  it('2024-12-30 appartient à 2025-W01', () => {
    assert.equal(isoWeek('2024-12-30'), '2025-W01')
  })
})

describe('previousIsoWeek', () => {
  it('2025-W05 → 2025-W04', () => {
    assert.equal(previousIsoWeek('2025-W05'), '2025-W04')
  })
  it('2025-W01 → dernière semaine 2024', () => {
    const prev = previousIsoWeek('2025-W01')
    assert.ok(prev.startsWith('2024-W'), `Attendu 2024-Wxx, obtenu ${prev}`)
  })
})

describe('nextIsoWeek', () => {
  it('2025-W27 → 2025-W28', () => {
    assert.equal(nextIsoWeek('2025-W27'), '2025-W28')
  })
})

describe('calculateStreaks', () => {
  it('DB vide → tous à 0', () => {
    const db = createDb()
    const r  = calculateStreaks(db)
    assert.equal(r.current_week_streak, 0)
    assert.equal(r.longest_week_streak, 0)
    assert.equal(r.total_sessions, 0)
    assert.equal(r.total_weeks, 0)
  })

  it('1 séance = 1 semaine', () => {
    const db = createDb()
    insertCompletedSession(db, '2025-06-02')
    const r = calculateStreaks(db)
    assert.equal(r.total_sessions, 1)
    assert.equal(r.total_weeks, 1)
  })

  it('2 séances même semaine = 1 semaine distincte', () => {
    const db = createDb()
    insertCompletedSession(db, '2025-06-02')
    insertCompletedSession(db, '2025-06-04')
    const r = calculateStreaks(db)
    assert.equal(r.total_sessions, 2)
    assert.equal(r.total_weeks, 1)
  })

  it('longest_week_streak : 3 semaines consécutives', () => {
    const db = createDb()
    insertCompletedSession(db, '2025-06-02')  // W23
    insertCompletedSession(db, '2025-06-09')  // W24
    insertCompletedSession(db, '2025-06-16')  // W25
    const r = calculateStreaks(db)
    assert.equal(r.longest_week_streak, 3)
  })

  it('gap dans les semaines réinitialise le streak', () => {
    const db = createDb()
    insertCompletedSession(db, '2025-06-02')  // W23
    insertCompletedSession(db, '2025-06-09')  // W24
    // gap : W25 manquante
    insertCompletedSession(db, '2025-06-23')  // W26
    const r = calculateStreaks(db)
    assert.equal(r.longest_week_streak, 2)
  })
})
