import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import request from 'supertest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

// Isolated DB (AGENTS.md §3: never touch data/workoutbuddy.db)
process.env.DB_PATH = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'wb-t75-')), 'test.db')

const { migrate }       = await import('../../src/db/migrate.js')
const { getDb }         = await import('../../src/db/database.js')
const { seedExercises } = await import('../../src/seed/seed.js')
migrate(getDb())
seedExercises(getDb())

const { app } = await import('../../server.js')

describe('T7.5 — Exercise exclusion API', () => {

  // Fetch a real ID from the DB instead of hardcoding it
  let realExerciseId1 = null
  let realExerciseId2 = null

  before(async () => {
    // Fetch two real existing exercises
    const res = await request(app).get('/api/v1/exercises?limit=5')
    if (res.body.exercises.length >= 2) {
      realExerciseId1 = res.body.exercises[0].id
      realExerciseId2 = res.body.exercises[1].id
    }
  })

  // ── GET /exercises ─────────────────────────────────────────
  it('GET /exercises returns is_excluded for each exercise', async () => {
    const res = await request(app).get('/api/v1/exercises?limit=10')
    assert.equal(res.status, 200)
    assert.ok(res.body.exercises.length > 0)
    // Every exercise must have the is_excluded field
    for (const ex of res.body.exercises) {
      assert.ok('is_excluded' in ex, `Missing is_excluded field for ${ex.id}`)
    }
    // All default to false (fresh DB)
    assert.ok(res.body.exercises.every(e => e.is_excluded === false))
  })

  // ── PUT toggle-exclusion ───────────────────────────────────
  it('PUT /exercises/:id/toggle-exclusion → exclude a real exercise', async () => {
    if (!realExerciseId1) return  // skip if DB is empty
    const res = await request(app)
      .put(`/api/v1/exercises/${realExerciseId1}/toggle-exclusion`)
      .send({ is_excluded: true, exclusion_reason: 'Test shoulder pain' })
    assert.equal(res.status, 200)
    assert.equal(res.body.is_excluded, true)
    assert.equal(res.body.exclusion_reason, 'Test shoulder pain')
    assert.equal(res.body.id, realExerciseId1)
  })

  it('GET /exercises?excluded=1 returns only excluded exercises', async () => {
    if (!realExerciseId1) return
    const res = await request(app).get('/api/v1/exercises?excluded=1')
    assert.equal(res.status, 200)
    assert.ok(res.body.exercises.length >= 1)
    assert.ok(
      res.body.exercises.every(e => e.is_excluded === true),
      'All returned exercises must be excluded'
    )
  })

  it('GET /exercises?excluded=0 omits excluded exercises', async () => {
    if (!realExerciseId1) return
    const res = await request(app).get('/api/v1/exercises?excluded=0')
    assert.equal(res.status, 200)
    assert.ok(
      res.body.exercises.every(e => e.is_excluded === false),
      'No excluded exercise in the results'
    )
    // The excluded exercise must not appear
    const found = res.body.exercises.find(e => e.id === realExerciseId1)
    assert.ok(!found, 'The excluded exercise must not appear in ?excluded=0 results')
  })

  it('PUT toggle-exclusion → re-enabling clears the reason', async () => {
    if (!realExerciseId1) return
    const res = await request(app)
      .put(`/api/v1/exercises/${realExerciseId1}/toggle-exclusion`)
      .send({ is_excluded: false })
    assert.equal(res.status, 200)
    assert.equal(res.body.is_excluded, false)
    assert.equal(res.body.exclusion_reason, null)
  })

  it('PUT toggle-exclusion on missing ID → 404', async () => {
    const res = await request(app)
      .put('/api/v1/exercises/id_that_really_does_not_exist/toggle-exclusion')
      .send({ is_excluded: true })
    assert.equal(res.status, 404)
    assert.equal(res.body.error, 'EXERCISE_NOT_FOUND')
  })

  it('PUT toggle-exclusion without is_excluded → 400', async () => {
    if (!realExerciseId1) return
    const res = await request(app)
      .put(`/api/v1/exercises/${realExerciseId1}/toggle-exclusion`)
      .send({ reason: 'oubli du champ' })
    assert.equal(res.status, 400)
    assert.equal(res.body.error, 'MISSING_IS_EXCLUDED')
  })

  it('chat can no longer exclude exercises', async () => {
    const before = getDb().prepare('SELECT * FROM exercise WHERE id=?').get(realExerciseId2)
    const res = await request(app).post('/api/v1/ai/apply-action').send({action:{
      action:'exclude_exercises', explanation:'Legacy action',data:{exercise_ids:[realExerciseId2],reason:'Test'}
    }})
    assert.equal(res.status,403)
    assert.equal(res.body.error,'COACH_READ_ONLY')
    assert.deepEqual(getDb().prepare('SELECT * FROM exercise WHERE id=?').get(realExerciseId2),before)
  })
})
