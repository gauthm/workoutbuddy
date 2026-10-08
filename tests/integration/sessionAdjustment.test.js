import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import request from 'supertest'
import fs from 'fs'
import path from 'path'
import os from 'os'

// DB isolée (règle AGENT.md §8.3 : ne jamais toucher data/workoutbuddy.db)
process.env.DB_PATH = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'wb-t73-')), 'test.db')

const { migrate } = await import('../../src/db/migrate.js')
const { getDb }   = await import('../../src/db/database.js')
const { seedExercises } = await import('../../src/seed/seed.js')
migrate(getDb())
seedExercises(getDb())

const { app } = await import('../../server.js')

async function planifierSeance({ goal, level, exerciseId, targetSets, repsMin, repsMax }) {
  const db = getDb()
  const pRes = db.prepare(
    "INSERT INTO program (name, goal, level, days_per_week, progression_model) VALUES (?, ?, ?, 3, 'double_progression')"
  ).run(`Programme ${exerciseId}`, goal, level)
  const programId = pRes.lastInsertRowid
  const tRes = await request(app)
    .post(`/api/v1/programs/${programId}/templates`)
    .send({ name: 'Template' })
  const teRes = await request(app)
    .post(`/api/v1/templates/${tRes.body.id}/exercises`)
    .send({
      exercise_id: exerciseId, target_sets: targetSets,
      target_reps_min: repsMin, target_reps_max: repsMax
    })
  const sRes = await request(app)
    .post(`/api/v1/sessions/from-template/${tRes.body.id}`)
    .send({ scheduled_date: new Date().toISOString().slice(0, 10) })
  return { programId, templateId: tRes.body.id, teId: teRes.body.id, sessionId: sRes.body.id }
}

describe('T7.3 — Ajustements au lancement de séance', () => {
  beforeEach(() => {
    // Une seule séance in_progress à la fois → on repart propre
    getDb().prepare("DELETE FROM session WHERE status = 'in_progress'").run()
  })

  it('POST /sessions/:id/start retourne adjustments[]', async () => {
    const { sessionId } = await planifierSeance({
      goal: 'hypertrophy', level: 'intermediate',
      exerciseId: 'barbell_bench_press_medium_grip', targetSets: 3, repsMin: 8, repsMax: 12
    })

    const startRes = await request(app).post(`/api/v1/sessions/${sessionId}/start`)

    assert.equal(startRes.status, 200)
    assert.ok('adjustments' in startRes.body, 'adjustments doit être dans la réponse')
    assert.ok(Array.isArray(startRes.body.adjustments))
  })

  it('premier essai → adjustment avec change_type=first_time', async () => {
    const { sessionId } = await planifierSeance({
      goal: 'strength', level: 'beginner',
      exerciseId: 'barbell_squat', targetSets: 3, repsMin: 5, repsMax: 5
    })

    const startRes = await request(app).post(`/api/v1/sessions/${sessionId}/start`)

    assert.equal(startRes.status, 200)
    const firstAdj = startRes.body.adjustments.find(a => a.change_type === 'first_time')
    assert.ok(firstAdj, 'Doit avoir un ajustement first_time')
    assert.equal(firstAdj.exercise_id, 'barbell_squat')
    assert.equal(firstAdj.is_first_time, true)
    assert.ok(typeof firstAdj.explanation === 'string')
    assert.ok(typeof firstAdj.target_reps === 'number')
  })

  it('séance sans template → adjustments = []', async () => {
    const sRes = await request(app).post('/api/v1/sessions').send({
      name: 'Libre', scheduled_date: new Date().toISOString().slice(0, 10)
    })
    const startRes = await request(app).post(`/api/v1/sessions/${sRes.body.id}/start`)
    assert.equal(startRes.status, 200)
    assert.deepEqual(startRes.body.adjustments, [])
  })
})
