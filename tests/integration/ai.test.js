import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import request from 'supertest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

// DB isolée (la DB fichier partagée serait écrasée : settings IA, profil, programmes)
process.env.DB_PATH = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'wb-t53-')), 'test.db')

const { migrate }       = await import('../../src/db/migrate.js')
const { getDb }         = await import('../../src/db/database.js')
const { seedExercises } = await import('../../src/seed/seed.js')
migrate(getDb())
seedExercises(getDb())

const { app } = await import('../../server.js')

describe('T5.3 — API Chat Expert', () => {
  it('POST /ai/chat sans message → 400', async () => {
    const res = await request(app).post('/api/v1/ai/chat').send({})
    assert.equal(res.status, 400)
  })

  it('POST /ai/chat provider non configuré → 503', async () => {
    await request(app).put('/api/v1/settings').send({ ai_base_url: '', ai_model: '' })
    const res = await request(app).post('/api/v1/ai/chat').send({ message: 'Bonjour' })
    assert.equal(res.status, 503)
  })

  it('POST /ai/apply-action complete_user_profile', async () => {
    const res = await request(app).post('/api/v1/ai/apply-action').send({
      action: {
        action: 'complete_user_profile',
        explanation: 'Onboarding terminé.',
        data: { age: 30, sex: 'male', fitness_level: 'intermediate', primary_goal: 'hypertrophy', sessions_per_week: 4, onboarding_completed: true, onboarding_step: 'completed' }
      }
    })
    assert.equal(res.status, 201)
    assert.equal(res.body.applied, true)
  })

  it('POST /ai/apply-action create_program', async () => {
    const res = await request(app).post('/api/v1/ai/apply-action').send({
      action: {
        action: 'create_program',
        explanation: 'PPL pour hypertrophie.',
        data: {
          name: 'PPL Coach IA', goal: 'hypertrophy', level: 'intermediate', days_per_week: 3,
          templates: [{ name: 'Push', exercises: [{ exercise_id: 'barbell_bench_press_medium_grip', target_sets: 4, target_reps_min: 8, target_reps_max: 12 }] }]
        }
      }
    })
    assert.equal(res.status, 201)
    assert.ok(res.body.result.id > 0)
  })

  it('POST /ai/apply-action activate_program', async () => {
    const progRes = await request(app).post('/api/v1/ai/apply-action').send({
      action: { action: 'create_program', explanation: 'Test.', data: { name: 'Test', goal: 'strength', level: 'beginner', days_per_week: 3 } }
    })
    const pid = progRes.body.result.id
    const res = await request(app).post('/api/v1/ai/apply-action').send({
      action: { action: 'activate_program', explanation: 'Activer le programme.', data: { program_id: pid } }
    })
    assert.equal(res.status, 201)
  })

  it('POST /ai/apply-action add_equipment', async () => {
    const res = await request(app).post('/api/v1/ai/apply-action').send({
      action: { action: 'add_equipment', explanation: 'Ajout barre olympique.', data: { category: 'barbell', name: 'Barre olympique coach', weight_kg: 20, count: 1 } }
    })
    assert.equal(res.status, 201)
    assert.equal(res.body.result.type, 'equipment')
  })

  it('POST /ai/apply-action exercise_id invalide → 400', async () => {
    const res = await request(app).post('/api/v1/ai/apply-action').send({
      action: { action: 'create_program', explanation: 'Test.', data: { name: 'X', goal: 'strength', level: 'beginner', days_per_week: 3, templates: [{ name: 'A', exercises: [{ exercise_id: 'exercice_qui_nexiste_pas' }] }] } }
    })
    assert.equal(res.status, 400)
    assert.ok(res.body.details.some(d => d.includes('exercice_qui_nexiste_pas')))
  })

  it('POST /ai/apply-actions lot de 3 actions', async () => {
    const res = await request(app).post('/api/v1/ai/apply-actions').send({
      actions: [
        { action: 'complete_user_profile', explanation: 'Profil.', data: { age: 25 } },
        { action: 'add_equipment', explanation: 'Banc.', data: { category: 'bench', name: 'Banc réglable' } },
        { action: 'update_settings', explanation: 'Repos.', data: { default_rest_seconds: 120 } },
      ]
    })
    assert.equal(res.status, 201)
    assert.equal(res.body.applied, 3)
  })
})
