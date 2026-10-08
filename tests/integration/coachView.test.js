import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import request from 'supertest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

// DB isolée (ce test remet le user_profile à NULL → ne doit pas toucher la DB utilisateur)
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

  it('GET /user-profile accessible et onboarding_completed=false', async () => {
    const res = await request(app).get('/api/v1/user-profile')
    assert.equal(res.status, 200)
    assert.equal(res.body.onboarding_completed, false)
  })

  it('POST /ai/apply-actions lot d\'onboarding', async () => {
    const res = await request(app).post('/api/v1/ai/apply-actions').send({
      actions: [
        {
          action: 'complete_user_profile', explanation: 'Profil onboarding.',
          data: { display_name: 'Alex', age: 28, sex: 'male', weight_kg: 78, height_cm: 180,
                  fitness_level: 'intermediate', primary_goal: 'hypertrophy',
                  sessions_per_week: 4, session_duration_min: 60,
                  prefers_exercise_variation: true, onboarding_completed: true,
                  onboarding_step: 'completed' }
        },
        {
          action: 'add_equipment', explanation: 'Barre olympique.',
          data: { category: 'barbell', name: 'Barre olympique 20kg', weight_kg: 20, count: 1 }
        },
        {
          action: 'create_program', explanation: 'Programme PPL sur mesure.',
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
    assert.equal(res.status, 201)
    assert.equal(res.body.applied, 3)
    assert.equal(res.body.errors.length, 0)
  })

  it('GET /user-profile après onboarding → completed=true', async () => {
    const res = await request(app).get('/api/v1/user-profile')
    assert.equal(res.status, 200)
    assert.equal(res.body.onboarding_completed, true)
    assert.equal(res.body.display_name, 'Alex')
  })

  it('GET /ai/advice retourne tableau', async () => {
    const res = await request(app).get('/api/v1/ai/advice')
    assert.equal(res.status, 200)
    assert.ok(Array.isArray(res.body.advice))
  })
})
