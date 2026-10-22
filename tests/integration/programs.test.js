import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import request from 'supertest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

// Isolated DB (AGENTS.md §3: never touch data/workoutbuddy.db)
process.env.DB_PATH = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'wb-t21-')), 'test.db')

const { migrate }       = await import('../../src/db/migrate.js')
const { getDb }         = await import('../../src/db/database.js')
const { seedExercises } = await import('../../src/seed/seed.js')
migrate(getDb())
seedExercises(getDb())

const { app } = await import('../../server.js')

describe('T2.1 — Programs API', () => {
  let programId

  before(() => {
    const db = getDb()
    const existing = db.prepare("SELECT COUNT(*) as n FROM equipment_item WHERE category IN ('barbell','bench','rack','pullup_bar')").get()
    if (existing.n === 0) {
      db.prepare("INSERT INTO equipment_item (category, name) VALUES ('barbell','Olympic barbell'), ('bench','Flat bench'), ('rack','Squat rack'), ('pullup_bar','Pull-up bar')")
        .run()
    }
    const p = db.prepare(
      "INSERT INTO program (name, goal, level, days_per_week, progression_model) VALUES ('Test PPL', 'hypertrophy', 'intermediate', 3, 'double_progression')"
    ).run()
    programId = p.lastInsertRowid
  })

  it('GET /programs returns the list', async () => {
    const res = await request(app).get('/api/v1/programs')
    assert.equal(res.status, 200)
    assert.ok(Array.isArray(res.body.programs))
    assert.ok(res.body.programs.length >= 1)
  })

  it('GET /programs/:id returns program with templates', async () => {
    const res = await request(app).get(`/api/v1/programs/${programId}`)
    assert.equal(res.status, 200)
    assert.equal(res.body.id, programId)
    assert.ok(Array.isArray(res.body.templates))
  })

  it('POST /programs/:id/activate activates the program', async () => {
    const res = await request(app).post(`/api/v1/programs/${programId}/activate`)
    assert.equal(res.status, 200)
    const check = await request(app).get(`/api/v1/programs/${programId}`)
    assert.equal(check.body.is_active, true)
  })

  it('PUT /programs/:id locks fields other than duration', async () => {
    const res = await request(app).put(`/api/v1/programs/${programId}`).send({
      description: 'Modified program'
    })
    assert.equal(res.status, 403)
    assert.equal(res.body.error, 'PROGRAM_FIELDS_LOCKED')
  })

  it('POST /programs/:id/templates creates a template', async () => {
    const res = await request(app).post(`/api/v1/programs/${programId}/templates`).send({
      name: 'Workout A', order_index: 0
    })
    assert.equal(res.status, 201)
    assert.equal(res.body.name, 'Workout A')
    assert.equal(res.body.program_id, programId)
  })

  it('POST /templates/:id/exercises creates a template_exercise with progression_state', async () => {
    const tplRes = await request(app).post(`/api/v1/programs/${programId}/templates`).send({
      name: 'Workout B', order_index: 1
    })
    const templateId = tplRes.body.id

    const res = await request(app).post(`/api/v1/templates/${templateId}/exercises`).send({
      exercise_id: 'barbell_bench_press_medium_grip', target_sets: 4, target_reps_min: 6, target_reps_max: 10
    })
    assert.equal(res.status, 201)
    assert.equal(res.body.exercise_id, 'barbell_bench_press_medium_grip')

    const db = getDb()
    const state = db.prepare('SELECT * FROM progression_state WHERE template_exercise_id = ?').get(res.body.id)
    assert.ok(state, 'progression_state doit exister')
    assert.equal(state.current_weight_kg, 0)
  })

  it('GET /programs/:id/next-session returns the next template', async () => {
    const res = await request(app).get(`/api/v1/programs/${programId}/next-session`)
    assert.equal(res.status, 200)
    assert.ok(res.body.template_id)
    assert.ok(res.body.template_name)
    assert.ok(Array.isArray(res.body.exercises))
  })

  it('DELETE /programs/:id fails during an active workout', async () => {
    const db = getDb()
    db.prepare(
      "INSERT INTO session (program_id, name, scheduled_date, status) VALUES (?, 'Test', '2025-07-01', 'in_progress')"
    ).run(programId)

    const res = await request(app).delete(`/api/v1/programs/${programId}`)
    assert.equal(res.status, 409)
  })

  it('GET /programs/:id with missing ID returns 404', async () => {
    const res = await request(app).get('/api/v1/programs/999999')
    assert.equal(res.status, 404)
    assert.equal(res.body.error, 'PROGRAM_NOT_FOUND')
  })
})
