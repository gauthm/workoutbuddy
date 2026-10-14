import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import request from 'supertest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

// DB isolée (règle AGENT.md §8.3 : ne jamais toucher data/workoutbuddy.db)
process.env.DB_PATH = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'wb-t14-')), 'test.db')

const { migrate }       = await import('../../src/db/migrate.js')
const { getDb }         = await import('../../src/db/database.js')
const { seedExercises } = await import('../../src/seed/seed.js')
migrate(getDb())
seedExercises(getDb())

const { app } = await import('../../server.js')

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
    const res = await request(app).get('/api/v1/exercises/barbell_bench_press_medium_grip')
    assert.equal(res.status, 200)
    assert.equal(res.body.id, 'barbell_bench_press_medium_grip')
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
    const res = await request(app).delete('/api/v1/exercises/barbell_bench_press_medium_grip')
    assert.equal(res.status, 403)
    assert.equal(res.body.error, 'CANNOT_DELETE_BUILTIN_EXERCISE')
  })

  it('GET /exercises/:id/history retourne un tableau vide si aucune séance', async () => {
    const res = await request(app).get('/api/v1/exercises/barbell_bench_press_medium_grip/history')
    assert.equal(res.status, 200)
    assert.ok(Array.isArray(res.body.history))
  })

  it('GET /exercises/:id/rm-history retourne un tableau', async () => {
    const res = await request(app).get('/api/v1/exercises/barbell_squat/rm-history')
    assert.equal(res.status, 200)
    assert.ok(Array.isArray(res.body.history))
  })
})

describe('Equipment families and inventory availability', () => {
  it('covers every inventory category exactly once', async () => {
    const { ALL_EQUIPMENT_CATEGORIES, EQUIPMENT_FAMILIES } = await import('../../public/js/components/equipment/inventoryCatalog.js')
    const categories = EQUIPMENT_FAMILIES.flatMap(f => f.categories)
    assert.equal(new Set(categories).size, categories.length)
    assert.deepEqual([...categories].sort(), [...ALL_EQUIPMENT_CATEGORIES].sort())
  })
  it('filters by any required equipment in the selected family', async () => {
    const res = await request(app).get('/api/v1/exercises?equipment_family=free_weights&muscle=chest')
    assert.equal(res.status, 200)
    assert.ok(res.body.exercises.length > 0)
    const { EQUIPMENT_FAMILIES } = await import('../../public/js/components/equipment/inventoryCatalog.js')
    const categories = EQUIPMENT_FAMILIES[0].categories
    assert.ok(res.body.exercises.every(ex => ex.primary_muscles.includes('chest') && ex.equipment_required.some(c => categories.includes(c))))
  })
  it('without inventory returns only exercises requiring no equipment', async () => {
    const res = await request(app).get('/api/v1/exercises?available=1')
    assert.equal(res.status, 200)
    assert.ok(res.body.exercises.length > 0)
    assert.ok(res.body.exercises.every(ex => !ex.equipment_required.length))
    const bodyweight = await request(app).get('/api/v1/exercises?equipment_family=bodyweight')
    assert.deepEqual(res.body.exercises, bodyweight.body.exercises)
  })
  it('accounts for all requirements, inventory aliases and dumbbell quantities', async () => {
    const db = getDb()
    const add = category => db.prepare('INSERT INTO equipment_item (category, name, count, weight_kg) VALUES (?,?,?,?)').run(category, category, 1, 10).lastInsertRowid
    const dumbbell = add('dumbbell_fixed'), bench = add('bench_adjustable'), roman = add('roman_chair')
    try {
      const inventory = db.prepare('SELECT * FROM equipment_item').all()
      const { calculateAchievableLoads } = await import('../../src/services/equipmentCalc.js')
      const result = await request(app).get('/api/v1/exercises?available=1')
      assert.equal(result.status, 200)
      const all = (await request(app).get('/api/v1/exercises')).body.exercises
      const expected = all.filter(ex => calculateAchievableLoads(inventory, ex).loads_kg.length > 0)
      assert.deepEqual(result.body.exercises.map(ex => ex.id), expected.map(ex => ex.id))
      assert.ok(result.body.exercises.some(ex => ex.equipment_required.includes('pullup_bar')))
      assert.ok(!result.body.exercises.some(ex => !ex.is_unilateral && ex.equipment_required.includes('dumbbell_fixed')))
      db.prepare('UPDATE equipment_item SET count = 2 WHERE id = ?').run(dumbbell)
      const pair = await request(app).get('/api/v1/exercises?available=1&equipment_family=free_weights')
      assert.ok(pair.body.exercises.some(ex => !ex.is_unilateral && ex.equipment_required.includes('dumbbell_fixed')))
      assert.ok(!pair.body.exercises.some(ex => ex.equipment_required.includes('barbell')))
    } finally { for (const id of [dumbbell, bench, roman]) db.prepare('DELETE FROM equipment_item WHERE id = ?').run(id) }
  })
  it('rejects unknown family and invalid availability flags', async () => {
    for (const query of ['equipment_family=unknown','available=true']) {
      const res = await request(app).get('/api/v1/exercises?' + query)
      assert.equal(res.status, 400)
    }
  })
})
