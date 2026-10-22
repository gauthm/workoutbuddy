import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import request from 'supertest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

// DB isolée (règle docs/AGENT.md §3 : ne jamais toucher data/workoutbuddy.db)
process.env.DB_PATH = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'wb-t75-')), 'test.db')

const { migrate }       = await import('../../src/db/migrate.js')
const { getDb }         = await import('../../src/db/database.js')
const { seedExercises } = await import('../../src/seed/seed.js')
migrate(getDb())
seedExercises(getDb())

const { app } = await import('../../server.js')

describe('T7.5 — API exclusion exercices', () => {

  // Récupérer un ID réel depuis la DB au lieu de hardcoder
  let realExerciseId1 = null
  let realExerciseId2 = null

  before(async () => {
    // Récupérer deux exercices existants réels
    const res = await request(app).get('/api/v1/exercises?limit=5')
    if (res.body.exercises.length >= 2) {
      realExerciseId1 = res.body.exercises[0].id
      realExerciseId2 = res.body.exercises[1].id
    }
  })

  // ── GET /exercises ─────────────────────────────────────────
  it('GET /exercises retourne is_excluded pour chaque exercice', async () => {
    const res = await request(app).get('/api/v1/exercises?limit=10')
    assert.equal(res.status, 200)
    assert.ok(res.body.exercises.length > 0)
    // Tous les exercices doivent avoir le champ is_excluded
    for (const ex of res.body.exercises) {
      assert.ok('is_excluded' in ex, `Champ is_excluded manquant pour ${ex.id}`)
    }
    // Par défaut tous à false (DB fraîche)
    assert.ok(res.body.exercises.every(e => e.is_excluded === false))
  })

  // ── PUT toggle-exclusion ───────────────────────────────────
  it('PUT /exercises/:id/toggle-exclusion → exclure un exercice réel', async () => {
    if (!realExerciseId1) return  // skip si DB vide
    const res = await request(app)
      .put(`/api/v1/exercises/${realExerciseId1}/toggle-exclusion`)
      .send({ is_excluded: true, exclusion_reason: 'Test douleur épaule' })
    assert.equal(res.status, 200)
    assert.equal(res.body.is_excluded, true)
    assert.equal(res.body.exclusion_reason, 'Test douleur épaule')
    assert.equal(res.body.id, realExerciseId1)
  })

  it('GET /exercises?excluded=1 retourne seulement les exclus', async () => {
    if (!realExerciseId1) return
    const res = await request(app).get('/api/v1/exercises?excluded=1')
    assert.equal(res.status, 200)
    assert.ok(res.body.exercises.length >= 1)
    assert.ok(
      res.body.exercises.every(e => e.is_excluded === true),
      'Tous les exercices retournés doivent être exclus'
    )
  })

  it('GET /exercises?excluded=0 ne retourne pas les exclus', async () => {
    if (!realExerciseId1) return
    const res = await request(app).get('/api/v1/exercises?excluded=0')
    assert.equal(res.status, 200)
    assert.ok(
      res.body.exercises.every(e => e.is_excluded === false),
      'Aucun exercice exclu dans les résultats'
    )
    // L'exercice exclu ne doit pas apparaître
    const found = res.body.exercises.find(e => e.id === realExerciseId1)
    assert.ok(!found, 'L\'exercice exclu ne doit pas être dans les résultats ?excluded=0')
  })

  it('PUT toggle-exclusion → réactiver efface la raison', async () => {
    if (!realExerciseId1) return
    const res = await request(app)
      .put(`/api/v1/exercises/${realExerciseId1}/toggle-exclusion`)
      .send({ is_excluded: false })
    assert.equal(res.status, 200)
    assert.equal(res.body.is_excluded, false)
    assert.equal(res.body.exclusion_reason, null)
  })

  it('PUT toggle-exclusion sur ID inexistant → 404', async () => {
    const res = await request(app)
      .put('/api/v1/exercises/id_qui_nexiste_vraiment_pas/toggle-exclusion')
      .send({ is_excluded: true })
    assert.equal(res.status, 404)
    assert.equal(res.body.error, 'EXERCISE_NOT_FOUND')
  })

  it('PUT toggle-exclusion sans is_excluded → 400', async () => {
    if (!realExerciseId1) return
    const res = await request(app)
      .put(`/api/v1/exercises/${realExerciseId1}/toggle-exclusion`)
      .send({ reason: 'oubli du champ' })
    assert.equal(res.status, 400)
    assert.equal(res.body.error, 'MISSING_IS_EXCLUDED')
  })

  it('le chat ne peut plus exclure des exercices', async () => {
    const before = getDb().prepare('SELECT * FROM exercise WHERE id=?').get(realExerciseId2)
    const res = await request(app).post('/api/v1/ai/apply-action').send({action:{
      action:'exclude_exercises', explanation:'Ancienne action',data:{exercise_ids:[realExerciseId2],reason:'Test'}
    }})
    assert.equal(res.status,403)
    assert.equal(res.body.error,'COACH_READ_ONLY')
    assert.deepEqual(getDb().prepare('SELECT * FROM exercise WHERE id=?').get(realExerciseId2),before)
  })
})
