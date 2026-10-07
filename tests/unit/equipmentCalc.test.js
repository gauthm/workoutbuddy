import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { calculateAchievableLoads, roundDownToAchievable } from
  '../../src/services/equipmentCalc.js'

// Helpers
const barbell = (w) => ({ category: 'barbell', weight_kg: w, count: 1 })
const plate   = (w, c) => ({ category: 'plate', weight_kg: w, count: c })
const bilateral = { equipment_required: ['barbell'], is_unilateral: 0 }
const unilateral = { equipment_required: ['barbell'], is_unilateral: 1 }

describe('calculateAchievableLoads', () => {
  it('cas de référence : 2 barres 1kg + plaques 1/2/5kg bilatéral', () => {
    const items = [barbell(1), barbell(1), plate(1,4), plate(2,4), plate(5,2)]
    const r = calculateAchievableLoads(items, bilateral)
    assert.deepEqual(r.loads_kg, [1,3,5,7,9,11,13,15,17,19,21,23])
    assert.equal(r.min_increment_kg, 2)
    assert.equal(r.max_load_kg, 23)
  })

  it('cas de référence unilatéral : charges par bras', () => {
    const items = [barbell(1), plate(1,4), plate(2,4), plate(5,2)]
    const r = calculateAchievableLoads(items, unilateral)
    assert.deepEqual(r.loads_kg, [1,2,3,4,5,6,7,8,9,10,11,12])
    assert.equal(r.min_increment_kg, 1)
  })

  it('sans plaques : seul le poids de barre est atteignable', () => {
    const items = [barbell(20)]
    const r = calculateAchievableLoads(items, bilateral)
    assert.deepEqual(r.loads_kg, [20])
    assert.equal(r.min_increment_kg, 0)
  })

  it('exercice sans équipement requis : retourne [0]', () => {
    const r = calculateAchievableLoads([], { equipment_required: [], is_unilateral: 0 })
    assert.deepEqual(r.loads_kg, [0])
  })

  it('haltère réglable 5-30kg par pas de 2.5kg', () => {
    const items = [{
      category: 'dumbbell_adjustable',
      weight_min_kg: 5, weight_max_kg: 30, weight_step_kg: 2.5
    }]
    const ex = { equipment_required: ['dumbbell_adjustable'], is_unilateral: 1 }
    const r = calculateAchievableLoads(items, ex)
    assert.equal(r.loads_kg[0], 5)
    assert.equal(r.loads_kg[r.loads_kg.length - 1], 30)
    assert.equal(r.min_increment_kg, 2.5)
  })

  it('haltères fixes : une paire incluse, une seule ignorée', () => {
    const items = [
      { category: 'dumbbell_fixed', weight_kg: 10, count: 2 },
      { category: 'dumbbell_fixed', weight_kg: 15, count: 1 }, // impair → ignoré
    ]
    const ex = { equipment_required: ['dumbbell_fixed'], is_unilateral: 1 }
    const r = calculateAchievableLoads(items, ex)
    assert.deepEqual(r.loads_kg, [10])
  })
})

describe('roundDownToAchievable', () => {
  const loads = [20, 22.5, 25, 27.5, 30]

  it('retourne la charge exacte si disponible', () => {
    assert.equal(roundDownToAchievable(25, loads), 25)
  })

  it('retourne la charge inférieure la plus proche', () => {
    assert.equal(roundDownToAchievable(26, loads), 25)
  })

  it('retourne le minimum si cible < minimum', () => {
    assert.equal(roundDownToAchievable(15, loads), 20)
  })

  it('retourne 0 si liste vide', () => {
    assert.equal(roundDownToAchievable(50, []), 0)
  })
})
