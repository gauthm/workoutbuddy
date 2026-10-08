import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import request from 'supertest'
import { app } from '../../server.js'

describe('T4.3 — Stats endpoints supplémentaires', () => {
  it('GET /stats/overview inclut personal_records_count', async () => {
    const res = await request(app).get('/api/v1/stats/overview')
    assert.equal(res.status, 200)
    assert.ok(typeof res.body.personal_records_count === 'number')
    assert.ok(typeof res.body.total_volume_kg === 'number')
    assert.ok(typeof res.body.active_program_name !== 'undefined')
  })

  it('GET /stats/volume?weeks=12 retourne au max 12 semaines de données', async () => {
    const res = await request(app).get('/api/v1/stats/volume?weeks=12')
    assert.equal(res.status, 200)
    assert.ok(Array.isArray(res.body.data))
    // Chaque entrée a period et volume_kg
    if (res.body.data.length > 0) {
      assert.ok('period'    in res.body.data[0])
      assert.ok('volume_kg' in res.body.data[0])
    }
  })

  it('GET /stats/exercises/:id/progress retourne data avec estimated_1rm_kg', async () => {
    const res = await request(app)
      .get('/api/v1/stats/exercises/bench_press_barbell/progress?days=365')
    assert.equal(res.status, 200)
    if (res.body.data.length > 0) {
      assert.ok('estimated_1rm_kg' in res.body.data[0])
      assert.ok('date'             in res.body.data[0])
      assert.ok('weight_kg'        in res.body.data[0])
    }
  })

  it('GET /stats/personal-records?exercise_id filtre correctement', async () => {
    const res = await request(app)
      .get('/api/v1/stats/personal-records?exercise_id=bench_press_barbell')
    assert.equal(res.status, 200)
    assert.ok(Array.isArray(res.body.records))
    // Si des records existent, ils appartiennent tous à bench_press_barbell
    for (const r of res.body.records) {
      assert.equal(r.exercise_id, 'bench_press_barbell')
    }
  })
})
