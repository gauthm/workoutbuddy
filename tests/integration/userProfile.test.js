import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import request from 'supertest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

// Isolated DB (this test resets user_profile to NULL → must not touch the user DB)
process.env.DB_PATH = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'wb-t52-')), 'test.db')

const { migrate } = await import('../../src/db/migrate.js')
const { getDb }   = await import('../../src/db/database.js')
migrate(getDb())

const { app } = await import('../../server.js')

describe('T5.2 — User Profile', () => {

  before(() => {
    const db = getDb()
    migrate(db)
    db.prepare(`
      UPDATE user_profile SET
        display_name = NULL, age = NULL, sex = NULL, weight_kg = NULL, height_cm = NULL,
        fitness_level = NULL, primary_goal = NULL, secondary_goals = '[]',
        target_weight_kg = NULL, sport_practiced = NULL, sessions_per_week = NULL,
        session_duration_min = NULL, prefers_exercise_variation = 1,
        injury_notes = NULL, medical_notes = NULL,
        onboarding_completed = 0, onboarding_step = 'not_started'
      WHERE id = 1
    `).run()
  })

  it('GET /user-profile returns the singleton profile', async () => {
    const res = await request(app).get('/api/v1/user-profile')
    assert.equal(res.status, 200)
    assert.equal(res.body.id, 1)
    assert.ok('onboarding_completed' in res.body)
    assert.equal(res.body.onboarding_completed, false)
  })

  it('PUT /user-profile updates basic fields', async () => {
    const res = await request(app).put('/api/v1/user-profile').send({
      age: 28, sex: 'male', weight_kg: 80, height_cm: 178,
      fitness_level: 'intermediate', primary_goal: 'hypertrophy',
      sessions_per_week: 4, session_duration_min: 60,
    })
    assert.equal(res.status, 200)
    assert.equal(res.body.age, 28)
    assert.equal(res.body.fitness_level, 'intermediate')
    assert.equal(res.body.primary_goal, 'hypertrophy')
  })

  it('PUT /user-profile with secondary_goals array', async () => {
    const res = await request(app).put('/api/v1/user-profile')
      .send({ secondary_goals: ['strength','endurance'] })
    assert.equal(res.status, 200)
    assert.ok(Array.isArray(res.body.secondary_goals))
    assert.ok(res.body.secondary_goals.includes('strength'))
  })

  it('PUT /user-profile with unknown field → 400', async () => {
    const res = await request(app).put('/api/v1/user-profile')
      .send({ unknown_field: 'test' })
    assert.equal(res.status, 400)
  })

  it('PUT /user-profile with out-of-range age → 400', async () => {
    const res = await request(app).put('/api/v1/user-profile')
      .send({ age: 150 })
    assert.equal(res.status, 400)
  })

  it('PUT /user-profile onboarding_completed → true', async () => {
    const res = await request(app).put('/api/v1/user-profile')
      .send({ onboarding_completed: true, onboarding_step: 'completed' })
    assert.equal(res.status, 200)
    assert.equal(res.body.onboarding_completed, true)
  })
})
