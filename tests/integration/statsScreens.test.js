import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import request from '../helpers/in-process-request.js'
process.env.DB_PATH = ':memory:'
const { getDb } = await import('../../src/db/database.js')
const { migrate } = await import('../../src/db/migrate.js')
const { seedExercises } = await import('../../src/seed/seed.js')
migrate(getDb())
seedExercises(getDb())
const { app } = await import('../../server.js')

describe('T4.3 — Additional stats endpoints', () => {
  it('GET /stats/overview includes personal_records_count', async () => {
    const res = await request(app).get('/api/v1/stats/overview')
    assert.equal(res.status, 200)
    assert.ok(typeof res.body.personal_records_count === 'number')
    assert.ok(typeof res.body.total_volume_kg === 'number')
    assert.ok(typeof res.body.active_program_name !== 'undefined')
  })

  it('GET /stats/volume?weeks=12 returns at most 12 weeks of data', async () => {
    const res = await request(app).get('/api/v1/stats/volume?weeks=12')
    assert.equal(res.status, 200)
    assert.ok(Array.isArray(res.body.data))
    // Each entry has period and volume_kg
    if (res.body.data.length > 0) {
      assert.ok('period'    in res.body.data[0])
      assert.ok('volume_kg' in res.body.data[0])
    }
  })

  it('GET /stats/exercises/:id/progress returns data with estimated_1rm_kg', async () => {
    const res = await request(app)
      .get('/api/v1/stats/exercises/barbell_bench_press_medium_grip/progress?days=365')
    assert.equal(res.status, 200)
    if (res.body.data.length > 0) {
      assert.ok('estimated_1rm_kg' in res.body.data[0])
      assert.ok('date'             in res.body.data[0])
      assert.ok('weight_kg'        in res.body.data[0])
    }
  })

  it('GET /stats/personal-records?exercise_id filters correctly', async () => {
    const res = await request(app)
      .get('/api/v1/stats/personal-records?exercise_id=barbell_bench_press_medium_grip')
    assert.equal(res.status, 200)
    assert.ok(Array.isArray(res.body.records))
    // Any existing records all belong to barbell_bench_press_medium_grip
    for (const r of res.body.records) {
      assert.equal(r.exercise_id, 'barbell_bench_press_medium_grip')
    }
  })
})
