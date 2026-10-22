import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import request from 'supertest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

// Isolated DB (AGENTS.md §3: never touch data/workoutbuddy.db)
process.env.DB_PATH = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'wb-t34-')), 'test.db')

const { migrate }       = await import('../../src/db/migrate.js')
const { getDb }         = await import('../../src/db/database.js')
const { seedExercises } = await import('../../src/seed/seed.js')
migrate(getDb())
seedExercises(getDb())

const { app } = await import('../../server.js')

describe('T3.4 — Calendar API', () => {
  let sessionId

  it('POST /sessions creates a planned workout', async () => {
    const res = await request(app).post('/api/v1/sessions').send({
      name: 'Push test', scheduled_date: '2025-07-15'
    })
    assert.equal(res.status, 201)
    assert.equal(res.body.status, 'planned')
    sessionId = res.body.id
  })

  it('GET /sessions?from=&to= returns workouts for the month', async () => {
    const res = await request(app)
      .get('/api/v1/sessions?from=2025-07-01&to=2025-07-31')
    assert.equal(res.status, 200)
    assert.ok(Array.isArray(res.body.sessions))
    const found = res.body.sessions.find(s => s.id === sessionId)
    assert.ok(found)
  })

  it('POST /sessions/:id/skip sets status to skipped', async () => {
    const res = await request(app).post(`/api/v1/sessions/${sessionId}/skip`)
    assert.equal(res.status, 200)
    assert.equal(res.body.status, 'skipped')
  })

  it('PUT /sessions/:id reschedules a planned workout', async () => {
    const res2 = await request(app).post('/api/v1/sessions').send({
      name: 'Push test 2', scheduled_date: '2025-07-20'
    })
    const res = await request(app)
      .put(`/api/v1/sessions/${res2.body.id}`)
      .send({ scheduled_date: '2025-07-22' })
    assert.equal(res.status, 200)
    assert.equal(res.body.scheduled_date, '2025-07-22')
  })

  it('POST /sessions/:id/skip on completed workout → 409', async () => {
    // Create and complete a workout
    const s = await request(app).post('/api/v1/sessions')
      .send({ name: 'Done', scheduled_date: '2025-07-10' })
    await request(app).post(`/api/v1/sessions/${s.body.id}/start`)
    await request(app).post(`/api/v1/sessions/${s.body.id}/complete`)
    const res = await request(app).post(`/api/v1/sessions/${s.body.id}/skip`)
    assert.equal(res.status, 409)
  })
})
