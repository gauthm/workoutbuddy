import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { migrate } from '../../src/db/migrate.js'
import { seedExercises } from '../../src/seed/seed.js'
import { shouldDeload, computeDeloadTargets } from '../../src/services/deloadEngine.js'

function createDb() {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  migrate(db)
  seedExercises(db)
  return db
}

describe('deloadEngine', () => {
  it('deload auto désactivé → jamais de deload planifié', () => {
    const db = createDb()
    const program = {
      id: 1, is_in_deload: 0, deload_auto_enabled: 0,
      deload_frequency_weeks: 6, last_deload_date: null,
      created_at: '2025-01-01',
    }
    const r = shouldDeload(program, { plateau_detection_sessions: 4 }, db)
    assert.equal(r.should, false)
  })

  it('deload planifié après N semaines', () => {
    const db = createDb()
    const pRes = db.prepare(
      "INSERT INTO program (name,goal,level,days_per_week,progression_model,deload_auto_enabled,deload_frequency_weeks) VALUES ('T','strength','beginner',3,'linear',1,4)"
    ).run()
    // Simuler last_deload_date il y a 5 semaines
    const oldDate = new Date()
    oldDate.setDate(oldDate.getDate() - 35)  // 35 jours = 5 semaines
    db.prepare("UPDATE program SET last_deload_date = ? WHERE id = ?")
      .run(oldDate.toISOString().slice(0, 10), pRes.lastInsertRowid)

    const program = db.prepare('SELECT * FROM program WHERE id = ?').get(pRes.lastInsertRowid)
    const r = shouldDeload(program, { plateau_detection_sessions: 4 }, db)
    assert.equal(r.should, true)
    assert.equal(r.reason, 'scheduled')
  })

  it('programme déjà en deload → pas de nouveau déclenchement', () => {
    const db = createDb()
    const program = {
      id: 1, is_in_deload: 1, deload_auto_enabled: 1,
      deload_frequency_weeks: 4, last_deload_date: '2025-01-01',
    }
    const r = shouldDeload(program, {}, db)
    assert.equal(r.should, false)
  })

  it('computeDeloadTargets : -20% charge, min 2 séries', () => {
    const te    = { target_sets: 4, target_reps_min: 8, target_reps_max: 12 }
    const state = { current_weight_kg: 100 }
    const prog  = { deload_load_reduction_pct: 20, deload_volume_reduction_pct: 40 }
    const sets  = { deload_min_sets: 2 }
    const loads = [75, 77.5, 80, 82.5, 85, 90, 100]

    const r = computeDeloadTargets(te, state, prog, sets, loads)
    // 100 * 0.8 = 80 → roundDown(80, loads) = 80
    assert.equal(r.weight_kg, 80)
    // 4 * 0.6 = 2.4 → round = 2, max(2, 2) = 2
    assert.equal(r.sets, 2)
    assert.equal(r.reps_min, 8)
  })
})
