import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import request from 'supertest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

// DB isolée (règle AGENTS.md §3 : ne jamais toucher data/workoutbuddy.db)
process.env.DB_PATH = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'wb-t41-')), 'test.db')

const { migrate }       = await import('../../src/db/migrate.js')
const { getDb }         = await import('../../src/db/database.js')
const { seedExercises } = await import('../../src/seed/seed.js')
migrate(getDb())
seedExercises(getDb())

const { app } = await import('../../server.js')

describe('T4.1 — API Stats', () => {

  it('GET /stats/overview retourne la structure attendue', async () => {
    const res = await request(app).get('/api/v1/stats/overview')
    assert.equal(res.status, 200)
    assert.ok('total_sessions'      in res.body)
    assert.ok('current_week_streak' in res.body)
    assert.ok('longest_week_streak' in res.body)
    assert.ok('total_weeks_trained' in res.body)
    assert.ok('personal_records_count' in res.body)
  })

  it('GET /stats/streaks retourne current et longest', async () => {
    const res = await request(app).get('/api/v1/stats/streaks')
    assert.equal(res.status, 200)
    assert.ok(typeof res.body.current_week_streak === 'number')
    assert.ok(typeof res.body.longest_week_streak === 'number')
  })

  it('GET /stats/volume retourne un tableau data', async () => {
    const res = await request(app).get('/api/v1/stats/volume?weeks=4')
    assert.equal(res.status, 200)
    assert.ok(Array.isArray(res.body.data))
  })

  it('GET /stats/volume?group_by=muscle retourne des entrées avec muscle', async () => {
    const res = await request(app).get('/api/v1/stats/volume?group_by=muscle&weeks=4')
    assert.equal(res.status, 200)
    assert.ok(Array.isArray(res.body.data))
  })

  it('GET /stats/exercises/:id/progress retourne data + formula', async () => {
    const res = await request(app)
      .get('/api/v1/stats/exercises/barbell_bench_press_medium_grip/progress?days=30')
    assert.equal(res.status, 200)
    assert.ok(Array.isArray(res.body.data))
    assert.ok(typeof res.body.formula === 'string')
  })

  it('GET /stats/exercises/inconnu/progress → 404', async () => {
    const res = await request(app).get('/api/v1/stats/exercises/inexistant/progress')
    assert.equal(res.status, 404)
  })

  it('GET /stats/personal-records retourne un tableau', async () => {
    const res = await request(app).get('/api/v1/stats/personal-records')
    assert.equal(res.status, 200)
    assert.ok(Array.isArray(res.body.records))
  })

  it('GET /bodyweight retourne les entrées', async () => {
    const res = await request(app).get('/api/v1/bodyweight')
    assert.equal(res.status, 200)
    assert.ok(Array.isArray(res.body.entries))
  })

  it('POST /bodyweight crée une entrée', async () => {
    const res = await request(app).post('/api/v1/bodyweight')
      .send({ date: '2025-07-01', weight_kg: 75.5 })
    assert.equal(res.status, 201)
    assert.equal(res.body.weight_kg, 75.5)
  })

  it('POST /bodyweight doublon → 409', async () => {
    await request(app).post('/api/v1/bodyweight')
      .send({ date: '2025-07-02', weight_kg: 75.0 })
    const res = await request(app).post('/api/v1/bodyweight')
      .send({ date: '2025-07-02', weight_kg: 76.0 })
    assert.equal(res.status, 409)
  })
})
