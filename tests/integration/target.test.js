import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import request from 'supertest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

// DB isolée (règle AGENT.md §8.3 : ne jamais toucher data/workoutbuddy.db)
process.env.DB_PATH = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'wb-t71-')), 'test.db')

const { migrate }       = await import('../../src/db/migrate.js')
const { getDb }         = await import('../../src/db/database.js')
const { seedExercises } = await import('../../src/seed/seed.js')
migrate(getDb())
seedExercises(getDb())

const { app } = await import('../../server.js')

const TPL_NAME = 'T71 Target Tpl'
const PROG_NAME = 'T71 Target Prog'

describe('T7.1 — GET /sessions/:id/target/:teId enrichi', () => {
  let sessionId, teId

  before(async () => {
    const db = getDb()
    const pRes = db.prepare(
      "INSERT INTO program (name, goal, level, days_per_week, progression_model) VALUES (?, 'strength', 'beginner', 3, 'linear')"
    ).run(PROG_NAME)
    const programId = pRes.lastInsertRowid

    const tRes = await request(app)
      .post(`/api/v1/programs/${programId}/templates`)
      .send({ name: TPL_NAME })
    const templateId = tRes.body.id

    const exRes = await request(app)
      .post(`/api/v1/templates/${templateId}/exercises`)
      .send({
        exercise_id: 'barbell_bench_press_medium_grip',
        target_sets: 3, target_reps_min: 5, target_reps_max: 5,
      })
    teId = exRes.body.id

    const sRes = await request(app)
      .post(`/api/v1/sessions/from-template/${templateId}`)
      .send({ scheduled_date: '2026-10-08' })
    sessionId = sRes.body.id
  })

  after(() => {
    const db = getDb()
    db.prepare('DELETE FROM session WHERE name = ?').run(TPL_NAME)
    db.prepare('DELETE FROM program WHERE name = ?').run(PROG_NAME)
  })

  it('premier essai → is_first_time=true + first_time_suggestion non null', async () => {
    const res = await request(app)
      .get(`/api/v1/sessions/${sessionId}/target/${teId}`)
    assert.equal(res.status, 200)
    assert.equal(res.body.is_first_time, true)
    assert.ok(res.body.first_time_suggestion !== null)
    assert.ok(typeof res.body.first_time_suggestion.reasoning === 'string')
    assert.ok(res.body.first_time_suggestion.reasoning.length > 10)
    assert.equal(typeof res.body.first_time_suggestion.weight_kg, 'number')
    // Les reps suivent la fourchette du template
    assert.equal(res.body.reps_min, 5)
    assert.equal(res.body.first_time_suggestion.reps, 5)
  })

  it('la réponse contient estimated_10rm_kg si weight et reps > 0', async () => {
    const res = await request(app)
      .get(`/api/v1/sessions/${sessionId}/target/${teId}`)
    assert.equal(res.status, 200)
    if (res.body.weight_kg > 0 && res.body.reps_min > 0) {
      assert.equal(typeof res.body.estimated_10rm_kg, 'number')
      assert.ok(res.body.estimated_10rm_kg > 0)
    } else {
      assert.equal(res.body.estimated_10rm_kg, null)
    }
  })

  it('après progression (state > 0) → is_first_time=false + suggestion null', async () => {
    const db = getDb()
    db.prepare(
      'UPDATE progression_state SET current_weight_kg = 60, current_target_reps = 5 WHERE template_exercise_id = ?'
    ).run(teId)

    const res = await request(app)
      .get(`/api/v1/sessions/${sessionId}/target/${teId}`)
    assert.equal(res.status, 200)
    assert.equal(res.body.is_first_time, false)
    assert.equal(res.body.first_time_suggestion, null)
    assert.equal(res.body.weight_kg, 60)
    // 60 kg × 5 reps (epley) : 1RM = 70 → 10RM = 70 / 1.333… ≈ 52.5
    assert.equal(res.body.estimated_10rm_kg, 52.5)
    assert.ok(typeof res.body.explanation === 'string' && res.body.explanation.length > 0)
  })

  it('session inexistante → 404', async () => {
    const res = await request(app).get('/api/v1/sessions/999999/target/1')
    assert.equal(res.status, 404)
    assert.equal(res.body.error, 'SESSION_NOT_FOUND')
  })
})
