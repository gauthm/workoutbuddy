import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import request from 'supertest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

process.env.DB_PATH = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'wb-t83-')), 'test.db')

const { migrate }       = await import('../../src/db/migrate.js')
const { getDb }         = await import('../../src/db/database.js')
migrate(getDb())

const { app } = await import('../../server.js')

describe('T8.3 — Profile: clearable fields and reset', () => {

  it('PUT accepts null for age/sex/fitness_level/primary_goal (previous rejection → 200)', async () => {
    // First populate
    await request(app).put('/api/v1/user-profile').send({
      age: 30, sex: 'male', fitness_level: 'beginner', primary_goal: 'strength',
      sessions_per_week: 3, session_duration_min: 60,
    })
    // Then clear
    const res = await request(app).put('/api/v1/user-profile').send({
      age: null, sex: null, fitness_level: null, primary_goal: null,
      sessions_per_week: null, session_duration_min: null,
      weight_kg: null, height_cm: null,
    })
    assert.equal(res.status, 200)
    assert.equal(res.body.age, null)
    assert.equal(res.body.sex, null)
    assert.equal(res.body.fitness_level, null)
  })

  it('PUT still rejects invalid enums', async () => {
    const res = await request(app).put('/api/v1/user-profile').send({ sex: 'inconnu' })
    assert.equal(res.status, 400)
    assert.equal(res.body.error, 'VALIDATION_ERRORS')
  })

  it('PUT still enforces bounds on nullable fields', async () => {
    const res = await request(app).put('/api/v1/user-profile').send({ age: 5 })
    assert.equal(res.status, 400)
  })

  it('DELETE /user-profile resets all fields', async () => {
    await request(app).put('/api/v1/user-profile').send({
      display_name: 'Alex', age: 30, sex: 'male', weight_kg: 80, height_cm: 180,
      fitness_level: 'advanced', primary_goal: 'hypertrophy',
      sessions_per_week: 5, session_duration_min: 45,
      injury_notes: 'shoulder', sport_practiced: 'climbing',
      onboarding_completed: true, onboarding_step: 'completed',
    })
    const res = await request(app).delete('/api/v1/user-profile')
    assert.equal(res.status, 200)
    assert.equal(res.body.display_name, null)
    assert.equal(res.body.age, null)
    assert.equal(res.body.injury_notes, null)
    assert.equal(res.body.secondary_goals.length, 0)
    assert.equal(res.body.onboarding_completed, false)
    assert.equal(res.body.onboarding_step, 'not_started')
  })

  it('DELETE does not remove the singleton row', async () => {
    const db = getDb()
    const row = db.prepare('SELECT id FROM user_profile WHERE id = 1').get()
    assert.ok(row)
  })

  it('partial PUT works after reset', async () => {
    const res = await request(app).put('/api/v1/user-profile').send({ age: 25 })
    assert.equal(res.status, 200)
    assert.equal(res.body.age, 25)
    assert.equal(res.body.sex, null)
  })
})

describe('Read-only advisor regardless of profile', () => {
  for (const completed of [false,true]) {
    it(`rejects changes even with onboarding_completed=${completed}`, async () => {
      await request(app).put('/api/v1/user-profile').send({onboarding_completed:completed})
      for (const action of ['create_program','add_equipment','complete_user_profile']) {
        const res = await request(app).post('/api/v1/ai/apply-action').send({action:{
          action,explanation:'Legacy action',data:{name:'Test',goal:'strength',level:'beginner',days_per_week:3,age:50}
        }})
        assert.equal(res.status,403)
        assert.equal(res.body.error,'COACH_READ_ONLY')
      }
    })
  }
})
