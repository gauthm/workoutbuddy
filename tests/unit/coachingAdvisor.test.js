import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { migrate } from '../../src/db/migrate.js'
import { seedExercises } from '../../src/seed/seed.js'
import { runAllSignalChecks } from '../../src/services/coachingAdvisor.js'

function createDb() {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  migrate(db)
  seedExercises(db)
  return db
}

const SETTINGS = {
  equipment_advice_cooldown_days: 1,
  equipment_advice_max_load_sessions: 3,
  equipment_advice_min_increment_pct: 5,
  equipment_advice_plateau_sessions: 4,
  plateau_detection_sessions: 4,
}

describe('runAllSignalChecks', () => {
  it('retourne 0 si pas de programme actif', () => {
    const db = createDb()
    assert.equal(runAllSignalChecks(db, SETTINGS), 0)
  })

  it('signal no_exercise_available si aucun équipement', () => {
    const db = createDb()
    db.prepare("INSERT INTO program (name,goal,level,days_per_week,progression_model,is_active) VALUES ('T','strength','beginner',3,'linear',1)").run()
    const n = runAllSignalChecks(db, SETTINGS)
    const advice = db.prepare("SELECT * FROM equipment_advice WHERE signal_type='no_exercise_available'").all()
    assert.ok(advice.length > 0, 'Des muscles sans exercice réalisable devraient générer un signal')
  })

  it('cooldown empêche les doublons', () => {
    const db = createDb()
    db.prepare("INSERT INTO program (name,goal,level,days_per_week,progression_model,is_active) VALUES ('T','strength','beginner',3,'linear',1)").run()
    runAllSignalChecks(db, SETTINGS)
    const count1 = db.prepare('SELECT COUNT(*) as n FROM equipment_advice').get().n
    runAllSignalChecks(db, { ...SETTINGS, equipment_advice_cooldown_days: 30 })
    const count2 = db.prepare('SELECT COUNT(*) as n FROM equipment_advice').get().n
    assert.equal(count1, count2, 'Pas de doublon avec cooldown actif')
  })
})
