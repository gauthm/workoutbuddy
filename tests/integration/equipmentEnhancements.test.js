import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import request from 'supertest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

// DB isolée (règle docs/AGENT.md §3 : ne jamais toucher data/workoutbuddy.db)
process.env.DB_PATH = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'wb-t19-')), 'test.db')

const { migrate }       = await import('../../src/db/migrate.js')
const { getDb }         = await import('../../src/db/database.js')
const { seedExercises } = await import('../../src/seed/seed.js')
migrate(getDb())
seedExercises(getDb())

const { app } = await import('../../server.js')

describe('T1.9 — Équipement : nouvelles catégories', () => {

  before(() => {
    const db = getDb()
    migrate(db)
    seedExercises(db)
  })

  it('POST /equipment avec dumbbell_loadable → 201 avec la quantité fournie', async () => {
    const res = await request(app).post('/api/v1/equipment').send({
      category:  'dumbbell_loadable',
      name:      'Poignée haltère 2kg',
      weight_kg: 2,
      count:     3,    // quantité réelle de poignées
    })
    assert.equal(res.status, 201)
    assert.equal(res.body.count, 3)
  })

  it('POST /equipment avec dumbbell_plate quantité impaire acceptée', async () => {
    const res = await request(app).post('/api/v1/equipment').send({
      category:  'dumbbell_plate',
      name:      'Disque 1.25kg',
      weight_kg: 1.25,
      count:     3,    // inventaire réel, même si un disque reste inutilisé
    })
    assert.equal(res.status, 201)
    assert.equal(res.body.count, 3)
  })

  it('POST /equipment avec bench_adjustable → 201 sans poids', async () => {
    const res = await request(app).post('/api/v1/equipment').send({
      category: 'bench_adjustable',
      name:     'Banc inclinable',
    })
    assert.equal(res.status, 201)
    assert.equal(res.body.category, 'bench_adjustable')
  })

  it('les quantités de poignées et disques restent éditables', async () => {
    for (const category of ['dumbbell_loadable', 'dumbbell_plate']) {
      const created = await request(app).post('/api/v1/equipment').send({ category, name: 'Inventaire', weight_kg: 2, count: 1 })
      assert.equal(created.status, 201)
      assert.equal(created.body.count, 1)
      const updated = await request(app).put(`/api/v1/equipment/${created.body.id}`).send({ count: 3, weight_kg: 2.5 })
      assert.equal(updated.status, 200)
      assert.equal(updated.body.count, 3)
      assert.equal(updated.body.weight_kg, 2.5)
    }
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
      .get('/api/v1/equipment/achievable-loads?exercise_id=barbell_bench_press_medium_grip')
    // barbell_bench_press_medium_grip requiert une barre — pas de haltères
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


describe('Inventaire home gym / salle et fourchettes', () => {
  it('accepte toutes les cases du catalogue partagé', async () => {
    const { SIMPLE_CATEGORIES } = await import('../../public/js/components/equipment/inventoryCatalog.js')
    for (const category of SIMPLE_CATEGORIES) {
      const res = await request(app).post('/api/v1/equipment').send({category, name: category, count: 1})
      assert.equal(res.status, 201, category)
      assert.equal(res.body.category, category)
    }
  })
  it('enregistre et modifie plusieurs bandes avec leurs fourchettes', async () => {
    const first = await request(app).post('/api/v1/equipment').send({category:'resistance_band',name:'Bande légère',count:2,resistance_min_kg:5,resistance_max_kg:16})
    assert.equal(first.status,201)
    const second = await request(app).post('/api/v1/equipment').send({category:'resistance_band',name:'Bande forte',count:1,resistance_min_kg:10,resistance_max_kg:30})
    assert.equal(second.status,201)
    const updated = await request(app).put(`/api/v1/equipment/${first.body.id}`).send({count:3,resistance_max_kg:20})
    assert.equal(updated.status,200);assert.equal(updated.body.resistance_min_kg,5);assert.equal(updated.body.resistance_max_kg,20)
  })
  it('refuse une fourchette inversée, vide ou non numérique', async () => {
    for (const fields of [{resistance_min_kg:16,resistance_max_kg:5},{resistance_min_kg:5},{resistance_min_kg:'5',resistance_max_kg:16}]) {
      const response = await request(app).post('/api/v1/equipment').send({category:'resistance_band',name:'Invalide',...fields})
      assert.equal(response.status,400)
    }
  })
  it('enregistre un kettlebell unique et refuse une charge manquante', async () => {
    const response = await request(app).post('/api/v1/equipment').send({category:'kettlebell',name:'Kettlebell',count:1,weight_kg:16})
    assert.equal(response.status,201);assert.equal(response.body.count,1)
    assert.equal((await request(app).post('/api/v1/equipment').send({category:'kettlebell',name:'Vide'})).status,400)
  })
})
