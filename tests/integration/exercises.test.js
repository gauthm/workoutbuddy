import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import request from 'supertest'
import { app } from '../../server.js'

describe('T1.4 — API Exercices', () => {
  it('GET /exercises retourne un tableau', async () => {
    const res = await request(app).get('/api/v1/exercises')
    assert.equal(res.status, 200)
    assert.ok(Array.isArray(res.body.exercises))
    assert.ok(res.body.exercises.length >= 5)
  })

  it('GET /exercises?muscle=chest filtre correctement', async () => {
    const res = await request(app).get('/api/v1/exercises?muscle=chest')
    assert.equal(res.status, 200)
    assert.ok(res.body.exercises.every(e => e.primary_muscles.includes('chest')))
  })

  it('GET /exercises/:id retourne un exercice', async () => {
    const res = await request(app).get('/api/v1/exercises/bench_press_barbell')
    assert.equal(res.status, 200)
    assert.equal(res.body.id, 'bench_press_barbell')
    assert.ok(Array.isArray(res.body.primary_muscles))
  })

  it('GET /exercises/inconnu retourne 404', async () => {
    const res = await request(app).get('/api/v1/exercises/exercice_qui_nexiste_pas')
    assert.equal(res.status, 404)
    assert.equal(res.body.error, 'EXERCISE_NOT_FOUND')
  })

  it('POST /exercises crée un exercice custom', async () => {
    const res = await request(app)
      .post('/api/v1/exercises')
      .send({
        name_fr: 'Curl marteau',
        name_en: 'Hammer Curl',
        category: 'strength',
        movement_pattern: 'pull_vertical',
        primary_muscles: ['biceps'],
        equipment_required: ['dumbbell_fixed']
      })
    assert.equal(res.status, 201)
    assert.equal(res.body.is_custom, true)
    assert.equal(res.body.name_fr, 'Curl marteau')
  })

  it('POST /exercises sans name_fr retourne 400', async () => {
    const res = await request(app)
      .post('/api/v1/exercises')
      .send({ name_en: 'Test', category: 'strength',
              movement_pattern: 'other', primary_muscles: ['core'] })
    assert.equal(res.status, 400)
    assert.equal(res.body.error, 'MISSING_NAME_FR')
  })

  it('DELETE builtin retourne 403', async () => {
    const res = await request(app).delete('/api/v1/exercises/bench_press_barbell')
    assert.equal(res.status, 403)
    assert.equal(res.body.error, 'CANNOT_DELETE_BUILTIN_EXERCISE')
  })

  it('GET /exercises/:id/history retourne un tableau vide si aucune séance', async () => {
    const res = await request(app).get('/api/v1/exercises/bench_press_barbell/history')
    assert.equal(res.status, 200)
    assert.ok(Array.isArray(res.body.history))
  })

  it('GET /exercises/:id/rm-history retourne un tableau', async () => {
    const res = await request(app).get('/api/v1/exercises/squat_barbell/rm-history')
    assert.equal(res.status, 200)
    assert.ok(Array.isArray(res.body.history))
  })
})
