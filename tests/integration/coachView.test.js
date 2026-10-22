import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import request from 'supertest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

// Isolated DB (this test resets user_profile to NULL → must not touch the user DB)
process.env.DB_PATH = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'wb-t55-')), 'test.db')

const { migrate }       = await import('../../src/db/migrate.js')
const { getDb }         = await import('../../src/db/database.js')
const { seedExercises } = await import('../../src/seed/seed.js')

const { app } = await import('../../server.js')

describe('T5.5 — Coach View API', () => {

  before(() => {
    const db = getDb()
    migrate(db)
    seedExercises(db)
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

  it('GET /user-profile accessible and onboarding_completed=false', async () => {
    const res = await request(app).get('/api/v1/user-profile')
    assert.equal(res.status, 200)
    assert.equal(res.body.onboarding_completed, false)
  })

  it('POST /ai/apply-actions rejects legacy onboarding batch', async () => {
    const res = await request(app).post('/api/v1/ai/apply-actions').send({
      actions: [
        {
          action: 'complete_user_profile', explanation: 'Profile onboarding.',
          data: { display_name: 'Alex', age: 28, sex: 'male', weight_kg: 78, height_cm: 180,
                  fitness_level: 'intermediate', primary_goal: 'hypertrophy',
                  sessions_per_week: 4, session_duration_min: 60,
                  prefers_exercise_variation: true, onboarding_completed: true,
                  onboarding_step: 'completed' }
        },
        {
          action: 'add_equipment', explanation: 'Olympic barbell.',
          data: { category: 'barbell', name: 'Olympic barbell 20kg', weight_kg: 20, count: 1 }
        },
        {
          action: 'create_program', explanation: 'Custom PPL program.',
          data: {
            name: 'PPL Onboarding Alex', goal: 'hypertrophy', level: 'intermediate',
            days_per_week: 4, progression_model: 'double_progression',
            templates: [{
              name: 'Push A',
              exercises: [
                { exercise_id: 'barbell_bench_press_medium_grip', target_sets: 4, target_reps_min: 8, target_reps_max: 12, rest_seconds: 120 },
                { exercise_id: 'barbell_shoulder_press', target_sets: 3, target_reps_min: 8, target_reps_max: 12 },
              ]
            }]
          }
        },
      ]
    })
    assert.equal(res.status, 403)
    assert.equal(res.body.error, 'COACH_READ_ONLY')
  })

  it('GET /user-profile after legacy batch → unchanged profile', async () => {
    const res = await request(app).get('/api/v1/user-profile')
    assert.equal(res.status, 200)
    assert.equal(res.body.onboarding_completed, false)
    assert.equal(res.body.display_name, null)
  })

  it('GET /ai/advice returns an array', async () => {
    const res = await request(app).get('/api/v1/ai/advice')
    assert.equal(res.status, 200)
    assert.ok(Array.isArray(res.body.advice))
  })
})
