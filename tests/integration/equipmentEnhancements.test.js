import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import request from 'supertest'
import { app } from '../../server.js'
import { getDb } from '../../src/db/database.js'
import { migrate } from '../../src/db/migrate.js'
import { seedExercises } from '../../src/seed/seed.js'

describe('T1.9 — Équipement : nouvelles catégories', () => {

  before(() => {
    const db = getDb()
    migrate(db)
    seedExercises(db)
  })

  it('POST /equipment avec dumbbell_loadable → 201 avec count=2 forcé', async () => {
    const res = await request(app).post('/api/v1/equipment').send({
      category:  'dumbbell_loadable',
      name:      'Poignée haltère 2kg',
      weight_kg: 2,
      count:     99,   // doit être ignoré et remplacé par 2
    })
    assert.equal(res.status, 201)
    assert.equal(res.body.count, 2)
  })

  it('POST /equipment avec dumbbell_plate count impair → 400', async () => {
    const res = await request(app).post('/api/v1/equipment').send({
      category:  'dumbbell_plate',
      name:      'Disque 1.25kg',
      weight_kg: 1.25,
      count:     3,    // impair → erreur
    })
    assert.equal(res.status, 400)
    assert.equal(res.body.error, 'PLATE_COUNT_MUST_BE_EVEN')
  })

  it('POST /equipment avec bench_adjustable → 201 sans poids', async () => {
    const res = await request(app).post('/api/v1/equipment').send({
      category: 'bench_adjustable',
      name:     'Banc inclinable',
    })
    assert.equal(res.status, 201)
    assert.equal(res.body.category, 'bench_adjustable')
  })

  it('GET /equipment/achievable-loads avec dumbbell_loadable + dumbbell_plate', async () => {
    // Créer le matériel
    await request(app).post('/api/v1/equipment').send({
      category: 'dumbbell_loadable', name: 'Poignée 2kg test', weight_kg: 2
    })
    await request(app).post('/api/v1/equipment').send({
      category: 'dumbbell_plate', name: 'Disque haltère 1kg test', weight_kg: 1, count: 4
    })

    const res = await request(app)
      .get('/api/v1/equipment/achievable-loads?exercise_id=bench_press_barbell')
    // bench_press_barbell requiert barbell + bench — pas de haltères
    // Ce test vérifie surtout que la route ne plante pas
    assert.equal(res.status, 200)
    assert.ok(Array.isArray(res.body.loads_kg))
  })

  it('POST /equipment avec catégorie invalide → 400', async () => {
    const res = await request(app).post('/api/v1/equipment').send({
      category: 'super_machine', name: 'Test'
    })
    assert.equal(res.status, 400)
    assert.equal(res.body.error, 'INVALID_CATEGORY')
  })

  it('Migration 004 appliquée — table avec nouvelles catégories', async () => {
    // Vérifier que les nouvelles catégories sont acceptées par la DB
    const res1 = await request(app).post('/api/v1/equipment').send({ category: 'dumbbell_plate',   name: 'Test plate',   weight_kg: 0.5, count: 2 })
    const res2 = await request(app).post('/api/v1/equipment').send({ category: 'dumbbell_loadable', name: 'Test handle', weight_kg: 2 })
    const res3 = await request(app).post('/api/v1/equipment').send({ category: 'bench_adjustable',  name: 'Test bench' })
    assert.equal(res1.status, 201)
    assert.equal(res2.status, 201)
    assert.equal(res3.status, 201)
  })
})
