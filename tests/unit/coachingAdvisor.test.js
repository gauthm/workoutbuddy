import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { migrate } from '../../src/db/migrate.js'
import { runAllSignalChecks } from '../../src/services/coachingAdvisor.js'

function createDb() {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  migrate(db)
  return db
}

// Controlled exercise catalog: one exercise requiring unowned equipment
function insertUnfeasibleExercise(db) {
  db.prepare(`
    INSERT INTO exercise (id, name_fr, name_en, category, movement_pattern,
                          primary_muscles, equipment_required, is_custom, is_unilateral)
    VALUES ('cable_crossover_fixture', 'Ecarté poulie', 'Cable Crossover', 'strength',
            'push_horizontal', '["chest"]', '["cable_machine"]', 0, 0)
  `).run()
}

const SETTINGS = {
  equipment_advice_cooldown_days: 1,
  equipment_advice_max_load_sessions: 3,
  equipment_advice_min_increment_pct: 5,
  equipment_advice_plateau_sessions: 4,
  plateau_detection_sessions: 4,
}

describe('runAllSignalChecks', () => {
  it('returns 0 without an active program', () => {
    const db = createDb()
    assert.equal(runAllSignalChecks(db, SETTINGS), 0)
  })

  it('no_exercise_available signal when equipment is missing', () => {
    const db = createDb()
    insertUnfeasibleExercise(db)
    db.prepare("INSERT INTO program (name,goal,level,days_per_week,progression_model,is_active) VALUES ('T','strength','beginner',3,'linear',1)").run()
    const n = runAllSignalChecks(db, SETTINGS)
    const advice = db.prepare("SELECT * FROM equipment_advice WHERE signal_type='no_exercise_available'").all()
    assert.ok(n > 0, 'Advice should be created')
    assert.ok(advice.length > 0, 'Muscles without an achievable exercise should generate a signal')
  })

  it('cooldown prevents duplicates', () => {
    const db = createDb()
    insertUnfeasibleExercise(db)
    db.prepare("INSERT INTO program (name,goal,level,days_per_week,progression_model,is_active) VALUES ('T','strength','beginner',3,'linear',1)").run()
    runAllSignalChecks(db, SETTINGS)
    const count1 = db.prepare('SELECT COUNT(*) as n FROM equipment_advice').get().n
    assert.ok(count1 > 0, 'The first pass must create advice')
    runAllSignalChecks(db, { ...SETTINGS, equipment_advice_cooldown_days: 30 })
    const count2 = db.prepare('SELECT COUNT(*) as n FROM equipment_advice').get().n
    assert.equal(count1, count2, 'No duplicate during active cooldown')
  })
})
