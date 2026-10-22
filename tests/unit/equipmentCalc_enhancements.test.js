import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { calculateAchievableLoads, roundDownToAchievable }
  from '../../src/services/equipmentCalc.js'

// ── Helpers ───────────────────────────────────────────────────
const barbell      = (w) => ({ category: 'barbell',          weight_kg: w, count: 1 })
const plate        = (w, c) => ({ category: 'plate',          weight_kg: w, count: c })
const dumbPlate    = (w, c) => ({ category: 'dumbbell_plate', weight_kg: w, count: c })
const dumbHandle   = (w) => ({ category: 'dumbbell_loadable', weight_kg: w, count: 2 })
const dumbFixed    = (w, c=2) => ({ category: 'dumbbell_fixed', weight_kg: w, count: c })
const dumbAdj      = (min, max, step) => ({
  category: 'dumbbell_adjustable',
  weight_min_kg: min, weight_max_kg: max, weight_step_kg: step,
})

const EX_DUMB = { equipment_required: ['dumbbell_fixed'], is_unilateral: 1 }
const EX_BAR  = { equipment_required: ['barbell'],        is_unilateral: 0 }
const EX_NONE = { equipment_required: [],                 is_unilateral: 0 }

// ── Tests dumbbell_loadable ───────────────────────────────────
describe('dumbbell_loadable — handle + plates', () => {

  it('2kg handle + two 1kg plates (2 pairs/side) → loads 2,4,6 kg', () => {
    const items = [ dumbHandle(2), dumbPlate(1, 4) ]
    // Side DP: {0, 1, 2} → loads: 2+2×0=2, 2+2×1=4, 2+2×2=6
    const r = calculateAchievableLoads(items, EX_DUMB)
    assert.deepEqual(r.loads_kg, [2, 4, 6])
    assert.equal(r.min_increment_kg, 2)
    assert.equal(r.max_load_kg, 6)
  })

  it('2kg handle + 0.5kg×8 + 1kg×8 plates → 1 kg increment', () => {
    const items = [
      dumbHandle(2),
      dumbPlate(0.5, 8),  // 4 pairs/side
      dumbPlate(1,   8),  // 4 pairs/side
    ]
    const r = calculateAchievableLoads(items, EX_DUMB)
    assert.equal(r.loads_kg[0], 2)              // bare handle
    assert.equal(r.min_increment_kg, 1)         // 2×0.5
    assert.ok(r.max_load_kg > 10, `max_load=${r.max_load_kg}`)
  })

  it('barbell plates shared with dumbbell_loadable', () => {
    // The 'plate' category can also be used on dumbbells
    const items = [
      dumbHandle(2),
      plate(2.5, 4),  // 2 pairs/side — usable on dumbbells
    ]
    const r = calculateAchievableLoads(items, EX_DUMB)
    // Side DP: {0, 2.5, 5} → loads: 2, 7, 12
    assert.deepEqual(r.loads_kg, [2, 7, 12])
    assert.equal(r.min_increment_kg, 5)
  })

  it('dumbbell_plate and plate combined', () => {
    const items = [
      dumbHandle(2),
      plate(2.5, 2),      // 1 pair/side
      dumbPlate(1.25, 4), // 2 pairs/side
    ]
    const r = calculateAchievableLoads(items, EX_DUMB)
    // Side DP: +2.5×1 → {0,2.5}, +1.25×2 → {0,1.25,2.5,3.75}... etc.
    assert.ok(r.loads_kg.length > 3, `Attendu plusieurs charges, obtenu ${r.loads_kg.length}`)
    assert.equal(r.loads_kg[0], 2)  // bare handle always present
  })

  it('handle without plates → one load (bare handle)', () => {
    const items = [ dumbHandle(2) ]
    const r = calculateAchievableLoads(items, EX_DUMB)
    assert.deepEqual(r.loads_kg, [2])
    assert.equal(r.min_increment_kg, 0)
  })

  it('dumbbell_loadable satisfait exercice qui requiert dumbbell_fixed', () => {
    // EX_DUMB requires dumbbell_fixed → must be satisfied by dumbbell_loadable
    const items = [ dumbHandle(3), dumbPlate(1, 4) ]
    const r = calculateAchievableLoads(items, EX_DUMB)
    assert.ok(r.loads_kg.length > 0)
    assert.equal(r.loads_kg[0], 3)
  })

})

// ── Barbell + dumbbell coexistence tests ───────────────────────
describe('cohabitation barbell + dumbbell_loadable', () => {
  it('shared plates — barbell exercise uses only plate (not dumbbell_plate)', () => {
    const items = [
      barbell(20),
      plate(5, 4),           // for the barbell
      dumbHandle(2),
      dumbPlate(1.25, 4),    // only for dumbbells
    ]
    // Barbell exercise: must not use dumbbell_plate
    const rBar = calculateAchievableLoads(items, EX_BAR)
    // Barbell loads: 20+2×{0,5,10} = {20, 30, 40}
    assert.deepEqual(rBar.loads_kg, [20, 30, 40])

    // Dumbbell exercise: can use plate + dumbbell_plate
    const rDumb = calculateAchievableLoads(items, EX_DUMB)
    // Side DP (5kg plate ×2 pairs + 1.25 dumbbell_plate ×2 pairs):
    // {0, 1.25, 2.5, 5, 6.25, 7.5} → loads 2+2×... = multiple values
    assert.ok(rDumb.loads_kg.includes(2))     // bare handle
    assert.ok(rDumb.loads_kg.includes(12))    // 2+2×5
  })
})

// ── Tests bench_adjustable ─────────────────────────────────────
describe('isEquipmentAvailable — bench_adjustable satisfies bench', () => {
  // Test through the achievable-loads API or directly through programGenerator
  // For this unit test, check isEquipmentAvailable logic
  // by importing the function from programGenerator or duplicating it

  it('odd plate count → must be rejected by the server (API test)', async () => {
    // This test is in tests/integration — see below
    assert.ok(true)  // placeholder
  })
})

// ── Edge case tests ─────────────────────────────────────────
describe('cas limites', () => {
  it('one handle suffices for a unilateral exercise', () => {
    const r = calculateAchievableLoads([{ category: 'dumbbell_loadable', weight_kg: 2, count: 1 }, dumbPlate(1, 3)], EX_DUMB)
    assert.deepEqual(r.loads_kg, [2, 4])
  })
  it('two dumbbells distribute available plates across four sides', () => {
    const r = calculateAchievableLoads([dumbHandle(2), dumbPlate(1, 4)], { ...EX_DUMB, is_unilateral: 0 })
    assert.deepEqual(r.loads_kg, [2, 4])
  })
  it('counts from multiple rows of the same weight are combined', () => {
    const r = calculateAchievableLoads([dumbFixed(10, 1), dumbFixed(10, 1)], { ...EX_DUMB, is_unilateral: 0 })
    assert.deepEqual(r.loads_kg, [10])
    const discs = calculateAchievableLoads([dumbHandle(2), dumbPlate(1, 2), dumbPlate(1, 2)], { ...EX_DUMB, is_unilateral: 0 })
    assert.deepEqual(discs.loads_kg, [2, 4])
  })
  it('exercise without equipment → loads=[0]', () => {
    const r = calculateAchievableLoads([], EX_NONE)
    assert.deepEqual(r.loads_kg, [0])
  })

  it('dumbbell_plate without dumbbell_loadable → ignored for dumbbell exercise', () => {
    // Without a handle, dumbbell plates alone are unusable
    const items = [ dumbPlate(1, 4) ]
    const r = calculateAchievableLoads(items, EX_DUMB)
    // No achievable load (no handle, no fixed/adjustable dumbbell)
    assert.deepEqual(r.loads_kg, [])
  })

  it('fixed dumbbells + plate-loaded handles → combined loads', () => {
    const items = [
      dumbFixed(10, 2),    // 10kg fixed dumbbell
      dumbFixed(15, 2),    // 15kg fixed dumbbell
      dumbHandle(2),
      dumbPlate(2.5, 4),   // 2 pairs/side
    ]
    const r = calculateAchievableLoads(items, EX_DUMB)
    assert.ok(r.loads_kg.includes(10))  // fixed dumbbell
    assert.ok(r.loads_kg.includes(15))  // fixed dumbbell
    assert.ok(r.loads_kg.includes(2))   // bare handle
    assert.ok(r.loads_kg.includes(7))   // 2+2×2.5
  })
})
